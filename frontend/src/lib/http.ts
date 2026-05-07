// frontend/src/lib/http.ts
//
// Hardened fetch wrapper. Layers on top of the existing `api.ts` rather than
// replacing it, so existing pages keep working while new pages opt in.
//
// Adds:
//   - Typed ApiError with status + code
//   - In-flight request deduplication (no double-fetch on rapid mounts)
//   - In-memory cache with per-call TTL (idempotent GETs only)
//   - AbortSignal support so unmounting cancels the request
//   - Tiny exponential backoff retry for network blips on GET
//
// Intentionally framework-free: import from a hook, a server action, or
// directly inside an effect.

// Fall back to localhost when the env var is missing instead of a dead
// placeholder URL — it's much easier to debug "fetch refused on
// localhost:5000" than "404 Not Found from a domain that doesn't exist".
const BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

if (
  typeof window !== 'undefined' &&
  !process.env.NEXT_PUBLIC_API_URL &&
  window.location.hostname !== 'localhost'
) {
  console.warn(
    '[http] NEXT_PUBLIC_API_URL is not set — falling back to localhost. ' +
      'Set it in your Vercel project settings to point at your real backend.',
  );
}

// ──────────────────────────────────────────────────────────────────────
//  ApiError
// ──────────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  /** Server-provided error code, when present (e.g. "FORBIDDEN"). */
  code?: string;
  /** Raw payload from the server, useful for downstream display. */
  payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }

  /** Common branches a UI cares about. */
  get isAuth() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isServer() {
    return this.status >= 500;
  }
}

// ──────────────────────────────────────────────────────────────────────
//  Cache + in-flight dedup
//  Bounded LRU — Map preserves insertion order, so we evict the oldest
//  entry when we hit the cap. Without this the cache grows unbounded over
//  hours-long sessions and contributes to the "memory grows over time"
//  bug reports.
// ──────────────────────────────────────────────────────────────────────
type CacheEntry<T> = { value: T; expiresAt: number };

const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function cacheSetBounded(key: string, entry: CacheEntry<unknown>) {
  // Re-insert (delete + set) to bump the LRU position.
  if (cache.has(key)) cache.delete(key);
  cache.set(key, entry);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function token(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('619_token');
  } catch {
    return null;
  }
}

function handleAuthFailure() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('619_token');
    localStorage.removeItem('619_user');
  } catch {}
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

// ──────────────────────────────────────────────────────────────────────
//  Public types
// ──────────────────────────────────────────────────────────────────────
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** ms — when set on a GET, response is cached and reused until expiry. */
  cacheMs?: number;
  /** AbortSignal from a controller in the calling component. */
  signal?: AbortSignal;
  /** Number of retries on network failure (idempotent verbs only). 0 = no retry. */
  retries?: number;
  /** When true, bypasses any cached response (still writes the new one). */
  fresh?: boolean;
  /** Skip the global "redirect to /login on 401" behavior. */
  skipAuthRedirect?: boolean;
}

// ──────────────────────────────────────────────────────────────────────
//  Core
// ──────────────────────────────────────────────────────────────────────
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = `${method} ${path}`;

  // Cache hit
  if (isGet && opts.cacheMs && !opts.fresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
  }

  // De-dupe concurrent calls for the same key.
  if (isGet) {
    const existing = inflight.get(cacheKey);
    if (existing) return existing as Promise<T>;
  }

  const exec = doFetch<T>(path, opts);

  if (isGet) {
    inflight.set(cacheKey, exec);
    exec.finally(() => inflight.delete(cacheKey));
  }

  const result = await exec;

  if (isGet && opts.cacheMs) {
    cacheSetBounded(cacheKey, { value: result, expiresAt: Date.now() + opts.cacheMs });
  }

  return result;
}

async function doFetch<T>(path: string, opts: RequestOptions): Promise<T> {
  const tries = Math.max(0, opts.retries ?? 0) + 1;
  let lastErr: unknown;

  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await once<T>(path, opts);
    } catch (err) {
      lastErr = err;
      // Only retry on network / 5xx errors. ApiError 4xx should not retry.
      const isRetryable =
        err instanceof TypeError ||
        (err instanceof ApiError && err.isServer);
      if (!isRetryable || attempt === tries - 1) throw err;
      // Exponential backoff: 200ms, 400ms, 800ms…
      await sleep(200 * 2 ** attempt);
    }
  }
  throw lastErr;
}

async function once<T>(path: string, opts: RequestOptions): Promise<T> {
  const t = token();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body;
    } else {
      headers['Content-Type'] ??= 'application/json';
      body = JSON.stringify(opts.body);
    }
  }
  if (t) headers.Authorization = `Bearer ${t}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new TypeError('Network request failed');
  }

  let data: unknown = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (res.status === 401) {
    if (!opts.skipAuthRedirect) handleAuthFailure();
    throw new ApiError(
      messageOf(data) ?? 'Session expired, please log in again',
      401,
      codeOf(data),
      data,
    );
  }

  if (!res.ok) {
    throw new ApiError(
      messageOf(data) ?? `HTTP ${res.status}`,
      res.status,
      codeOf(data),
      data,
    );
  }

  return data as T;
}

function messageOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { error?: unknown; message?: unknown };
  if (typeof d.error === 'string') return d.error;
  if (d.error && typeof d.error === 'object') {
    const e = d.error as { message?: unknown };
    if (typeof e.message === 'string') return e.message;
  }
  if (typeof d.message === 'string') return d.message;
  return null;
}

function codeOf(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as { error?: unknown };
  if (d.error && typeof d.error === 'object') {
    const e = d.error as { code?: unknown };
    if (typeof e.code === 'string') return e.code;
  }
  return undefined;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ──────────────────────────────────────────────────────────────────────
//  Cache controls — call these from forms after a mutation to evict.
// ──────────────────────────────────────────────────────────────────────
export const httpCache = {
  /** Clear an exact key, e.g. "GET /api/clients?status=active". */
  invalidate(path: string, method: 'GET' = 'GET') {
    cache.delete(`${method} ${path}`);
  },
  /** Clear every cache entry whose path starts with `prefix`. */
  invalidatePrefix(prefix: string, method: 'GET' = 'GET') {
    const head = `${method} ${prefix}`;
    for (const key of cache.keys()) {
      if (key.startsWith(head)) cache.delete(key);
    }
  },
  clear() {
    cache.clear();
  },
};
