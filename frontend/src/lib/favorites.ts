// src/lib/favorites.ts
// LocalStorage-backed favorites list. Each user can pin any nav route to the
// top of their sidebar. Stored per browser, scoped by user id when available.

const KEY_PREFIX = '619_favs_';
const MAX_FAVS = 8;

function key(userId?: string | null) {
  return KEY_PREFIX + (userId || 'anon');
}

export function readFavorites(userId?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFavorites(userId: string | null | undefined, hrefs: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = Array.from(new Set(hrefs)).slice(0, MAX_FAVS);
    localStorage.setItem(key(userId), JSON.stringify(trimmed));
  } catch {
    /* quota exhausted, ignore */
  }
}

export function toggleFavorite(userId: string | null | undefined, href: string): string[] {
  const current = readFavorites(userId);
  const idx = current.indexOf(href);
  if (idx >= 0) current.splice(idx, 1);
  else if (current.length < MAX_FAVS) current.unshift(href);
  writeFavorites(userId, current);
  return current;
}

export function isFavorite(userId: string | null | undefined, href: string): boolean {
  return readFavorites(userId).includes(href);
}

// Sidebar collapsed state — kept here because it's the same "user UI prefs"
// surface and we already have window-guard helpers.
const COLLAPSE_KEY = '619_sidebar_collapsed';

export function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

export function writeSidebarCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
}
