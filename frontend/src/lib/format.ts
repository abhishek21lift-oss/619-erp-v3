// src/lib/format.ts
// Single source of truth for how the app shows dates and money.
// Rule: every visible date is rendered DD-MM-YYYY. We never leak ISO
// timestamps like "2026-05-03T00:00:00.000Z" into the UI.

/** Strip a trailing time-of-day off an ISO string ("...T00:00:00.000Z"). */
function stripTime(s: string): string {
  return s.replace(/T.*$/, '');
}

/**
 * Render any date-ish input as DD-MM-YYYY.
 *
 * Accepts:
 *  - ISO strings ("2026-05-03", "2026-05-03T00:00:00.000Z")
 *  - DD-MM-YYYY strings (returned untouched)
 *  - Date objects
 *  - null / undefined / empty → "—"
 */
export function fmtDate(value?: string | Date | null): string {
  if (!value) return '—';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    return toDDMMYYYY(value);
  }

  const raw = String(value).trim();
  if (!raw) return '—';

  // Already DD-MM-YYYY?
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw;

  // YYYY-MM-DD or with timestamp
  const noTime = stripTime(raw);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(noTime);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // Fall back to Date parsing
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return toDDMMYYYY(d);
  return raw;
}

function toDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Convert a DD-MM-YYYY string into the YYYY-MM-DD shape the backend
 * expects. Pass-through if it's already YYYY-MM-DD or empty.
 */
export function toApiDate(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return raw;
}

/**
 * The value an <input type="date"> needs is YYYY-MM-DD. Accepts any of
 * the formats fmtDate accepts and returns the input-friendly version.
 */
export function toInputDate(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const raw = stripTime(String(value).trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}

/** ₹ formatter with Indian grouping. */
export function fmtMoney(n: number | string | null | undefined): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * Today's date as DD-MM-YYYY (handy for top-of-page subtitles).
 */
export function todayDDMM(): string {
  return toDDMMYYYY(new Date());
}

/**
 * Simple date-only formatter — strips the time portion off ISO/Date inputs.
 *
 * Use when you want a plain YYYY-MM-DD string with no localization
 * (e.g. for backend payloads, log lines, or filenames).
 *
 *   formatDate("2026-05-06T00:00:00.000Z") → "2026-05-06"
 *   formatDate(new Date())                 → "2026-05-06"
 *
 * For UI rendering prefer `fmtDate` (DD-MM-YYYY) or `formatDateLocal`
 * (browser locale).
 */
export function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Localized date formatter — uses the browser's default locale.
 *
 *   formatDateLocal("2026-05-06T00:00:00.000Z") → "5/6/2026" (en-US)
 *                                                or "06/05/2026" (en-IN)
 */
export function formatDateLocal(value?: string | Date | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

/**
 * Single source of truth for plan-name → duration-in-days mapping.
 * Used by every subscription form so end-date auto-fill stays consistent
 * across Add / Renew / Upgrade / Downgrade / PT-Assign / PT-Renew / Combo.
 *
 * Pattern matching on the plan name is intentionally fuzzy so a stored
 * plan called "PT Half-Yearly", "PT - Half Yearly" or "Half Yearly Membership"
 * all resolve to 180 days.
 */
const DURATION_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  'half yearly': 180,
  'half-yearly': 180,
  halfyearly: 180,
  yearly: 365,
  annual: 365,
  pt: 90,
};

export function planDurationDays(planName?: string | null): number {
  if (!planName) return 0;
  const k = planName.toLowerCase();
  // longest-key-first so "half yearly" wins over "yearly"
  const keys = Object.keys(DURATION_DAYS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (k.includes(key)) return DURATION_DAYS[key];
  }
  return 0;
}

/**
 * Compute an end date from a start date + plan name. Returns YYYY-MM-DD
 * (suitable for <input type="date">). Falls back to '' when the inputs
 * can't be resolved.
 */
export function computeEndDate(startDate?: string | Date | null, planName?: string | null): string {
  const start = toInputDate(startDate);
  const days = planDurationDays(planName);
  if (!start || !days) return '';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return toInputDate(d);
}
