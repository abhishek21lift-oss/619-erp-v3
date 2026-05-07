// src/lib/sheet-import.ts
// -------------------------------------------------------------
// Browser-side helper that lets the user import a sheet (xlsx /
// xls / csv) ONCE and then auto-fills the Add-Member form by
// looking up rows by mobile number.
//
// • Loads SheetJS (xlsx) from CDN on first use - no npm install
// • Heuristic header → form-field mapper, so column names like
//   "Mobile", "Phone No", "Contact" all map to `mobile`, etc.
// • Caches the parsed rows in localStorage so the user doesn't
//   have to re-import on every visit.
// -------------------------------------------------------------

const STORAGE_KEY = '619erp.sheetData.v1';
const SHEETJS_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

// ── Public types ─────────────────────────────────────────────
export interface SheetMember {
  // keys mirror the New-Member form fields
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  mobile?: string;
  alt_mobile?: string;
  emergency_no?: string;
  dob?: string;          // YYYY-MM-DD
  anniversary?: string;  // YYYY-MM-DD
  gender?: 'Male' | 'Female' | 'Other' | '';
  reference_no?: string;
  aadhaar_no?: string;
  pan_no?: string;
  gst_no?: string;
  company_name?: string;
  weight?: string;
  interested_in?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  package_type?: string;
  pt_start_date?: string;
  pt_end_date?: string;
  base_amount?: string;
  discount?: string;
  final_amount?: string;
  paid_amount?: string;
  payment_method?: string;
  payment_date?: string;
  notes?: string;
  // anything we couldn't map ends up here for transparency
  _raw?: Record<string, unknown>;
}

export interface SheetCache {
  rows: SheetMember[];
  importedAt: string; // ISO
  fileName: string;
  rowCount: number;
}

// ── SheetJS loader (singleton) ───────────────────────────────
let xlsxPromise: Promise<any> | null = null;
function loadSheetJS(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('SSR');
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS_CDN;
    s.async = true;
    s.onload = () => resolve((window as any).XLSX);
    s.onerror = () =>
      reject(new Error('Failed to load SheetJS from CDN'));
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

// ── Header → field mapping ───────────────────────────────────
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const HEADER_RULES: { field: keyof SheetMember; match: RegExp }[] = [
  { field: 'first_name',     match: /\b(first name|fname|first)\b/ },
  { field: 'last_name',      match: /\b(last name|lname|surname|last)\b/ },
  { field: 'name',           match: /\b(full name|member name|client name|name)\b/ },
  { field: 'alt_mobile',     match: /\b(alt|alternate|secondary)\b.*\b(mob|phone|contact)\b/ },
  { field: 'emergency_no',   match: /\bemergency\b/ },
  { field: 'mobile',         match: /\b(mobile|mob|phone|contact|whatsapp|cell)\b/ },
  { field: 'email',          match: /\b(email|e mail|mail|gmail)\b/ },
  { field: 'dob',            match: /\b(dob|date of birth|birth date|birthday)\b/ },
  { field: 'anniversary',    match: /\banniversary\b/ },
  { field: 'gender',         match: /\b(gender|sex)\b/ },
  { field: 'aadhaar_no',     match: /\b(aadhaar|aadhar|uid)\b/ },
  { field: 'pan_no',         match: /\bpan\b/ },
  { field: 'gst_no',         match: /\b(gst|gstin)\b/ },
  { field: 'company_name',   match: /\b(company|firm|organisation|organization)\b/ },
  { field: 'reference_no',   match: /\b(reference|ref no|ref|referred by)\b/ },
  { field: 'weight',         match: /\bweight|wt\b/ },
  { field: 'interested_in',  match: /\b(interest|goal|interested in)\b/ },
  { field: 'address',        match: /\b(address|flat|house|building)\b/ },
  { field: 'street',         match: /\b(street|area|locality|road)\b/ },
  { field: 'city',           match: /\bcity\b/ },
  { field: 'state',          match: /\bstate\b/ },
  { field: 'country',        match: /\bcountry\b/ },
  { field: 'pincode',        match: /\b(pincode|pin code|pin|zip|postal)\b/ },
  { field: 'package_type',   match: /\b(package|membership type|plan)\b/ },
  { field: 'pt_start_date',  match: /\b(start date|join date|joining|enrolled)\b/ },
  { field: 'pt_end_date',    match: /\b(end date|expiry|expires|valid till)\b/ },
  { field: 'final_amount',   match: /\b(total amount|net amount|final amount|grand total)\b/ },
  { field: 'discount',       match: /\bdiscount\b/ },
  { field: 'paid_amount',    match: /\b(paid|amount paid)\b/ },
  { field: 'base_amount',    match: /\b(base|fee|price|amount|cost)\b/ },
  { field: 'payment_method', match: /\b(payment method|payment mode|mode of payment|mode)\b/ },
  { field: 'payment_date',   match: /\b(payment date|paid on)\b/ },
  { field: 'notes',          match: /\b(notes|remarks|comments|description)\b/ },
];

function mapHeader(header: string): keyof SheetMember | null {
  const h = norm(header);
  for (const r of HEADER_RULES) if (r.match.test(h)) return r.field;
  return null;
}

// ── Value normalisers ────────────────────────────────────────
export function normalizeMobile(v: unknown): string {
  if (v == null) return '';
  const digits = String(v).replace(/\D+/g, '');
  // strip leading country code if 11-12 digits and starts with 91
  if (digits.length >= 11 && digits.startsWith('91'))
    return digits.slice(-10);
  return digits.slice(-10); // last 10 always
}

function toIsoDate(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime()))
    return v.toISOString().split('T')[0];
  // Excel serial number?
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = (parseInt(yy, 10) > 50 ? '19' : '20') + yy;
    return `${yy.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // already iso?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

function toGender(v: unknown): SheetMember['gender'] {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('m')) return 'Male';
  if (s.startsWith('f')) return 'Female';
  return 'Other';
}

function toStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

// ── Convert one sheet row → SheetMember ──────────────────────
function rowToMember(
  row: Record<string, unknown>,
  headerMap: Record<string, keyof SheetMember>
): SheetMember {
  const m: SheetMember = { _raw: row };
  for (const [origHeader, field] of Object.entries(headerMap)) {
    const raw = row[origHeader];
    if (raw == null || raw === '') continue;
    if (field === 'mobile' || field === 'alt_mobile' || field === 'emergency_no')
      (m as any)[field] = normalizeMobile(raw);
    else if (field === 'dob' || field === 'anniversary' || field === 'pt_start_date' ||
             field === 'pt_end_date' || field === 'payment_date')
      (m as any)[field] = toIsoDate(raw);
    else if (field === 'gender') m.gender = toGender(raw);
    else (m as any)[field] = toStr(raw);
  }
  // derive first_name/last_name from name when missing
  if ((!m.first_name || !m.last_name) && m.name) {
    const parts = m.name.trim().split(/\s+/);
    if (!m.first_name) m.first_name = parts[0] || '';
    if (!m.last_name && parts.length > 1) m.last_name = parts.slice(1).join(' ');
  }
  return m;
}

// ── Public API ───────────────────────────────────────────────
export async function importSheetFile(file: File): Promise<SheetCache> {
  const XLSX = await loadSheetJS();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const allRows: SheetMember[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });
    if (!json.length) continue;
    // build header map from first row's keys
    const headerMap: Record<string, keyof SheetMember> = {};
    for (const k of Object.keys(json[0])) {
      const f = mapHeader(k);
      if (f) headerMap[k] = f;
    }
    if (!headerMap || Object.keys(headerMap).length === 0) continue;
    for (const row of json) allRows.push(rowToMember(row, headerMap));
  }

  // de-dup by mobile (keep last occurrence — usually the most recent row)
  const seen = new Map<string, SheetMember>();
  for (const r of allRows) {
    const key = r.mobile || `_${seen.size}`;
    seen.set(key, r);
  }
  const rows = Array.from(seen.values());

  const cache: SheetCache = {
    rows,
    importedAt: new Date().toISOString(),
    fileName: file.name,
    rowCount: rows.length,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {/* quota — ignore */}
  return cache;
}

export function getSheetCache(): SheetCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SheetCache;
  } catch {
    return null;
  }
}

export function clearSheetCache() {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}

export function lookupByMobile(mobile: string): SheetMember | null {
  const m = normalizeMobile(mobile);
  if (m.length < 10) return null;
  const cache = getSheetCache();
  if (!cache) return null;
  return cache.rows.find(r => r.mobile === m) ?? null;
}

export function searchByName(query: string, limit = 10): SheetMember[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const cache = getSheetCache();
  if (!cache) return [];
  const out: SheetMember[] = [];
  for (const r of cache.rows) {
    const n = ((r.name || '') + ' ' + (r.first_name || '') + ' ' + (r.last_name || ''))
      .toLowerCase();
    if (n.includes(q)) {
      out.push(r);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Fields we are willing to auto-fill from the sheet. */
export const AUTOFILL_FIELDS: (keyof SheetMember)[] = [
  'first_name', 'last_name', 'email', 'mobile', 'alt_mobile', 'emergency_no',
  'dob', 'anniversary', 'gender', 'reference_no', 'aadhaar_no', 'pan_no',
  'gst_no', 'company_name', 'weight', 'interested_in',
  'address', 'street', 'city', 'state', 'country', 'pincode',
  'package_type', 'pt_start_date', 'pt_end_date',
  'base_amount', 'discount', 'final_amount', 'paid_amount',
  'payment_method', 'payment_date', 'notes',
];

/**
 * Merge a SheetMember into an existing form state, only filling
 * fields that are currently empty/zero/falsy. Returns:
 *   { merged, filledFields }
 */
export function mergeEmptyOnly<F extends Record<string, any>>(
  current: F,
  sheet: SheetMember
): { merged: F; filledFields: string[] } {
  const merged: any = { ...current };
  const filled: string[] = [];
  for (const k of AUTOFILL_FIELDS) {
    const incoming = (sheet as any)[k];
    if (incoming === undefined || incoming === null || incoming === '') continue;
    const existing = merged[k];
    const isEmpty =
      existing === undefined || existing === null || existing === '' ||
      (k === 'discount' && (existing === '0' || existing === 0));
    if (isEmpty) {
      merged[k] = incoming;
      filled.push(k);
    }
  }
  return { merged, filledFields: filled };
}
