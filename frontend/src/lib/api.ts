// src/lib/api.ts

// NEXT_PUBLIC_API_URL must be set on Vercel and in .env.local. The fallback
// is localhost so a missing env var fails fast in development with a clear
// error rather than 404-ing against a placeholder URL that doesn't exist.
const DEFAULT_API_BASE = 'http://localhost:5000';
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE;

function apiBase() {
  const trimmed = RAW_API_BASE.trim().replace(/\/+$/, '');
  const isPlaceholder = /your-619-api\.onrender\.com/i.test(trimmed);

  if (isPlaceholder && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.warn('[api] NEXT_PUBLIC_API_URL is still the placeholder Render URL. Falling back to localhost:5000.');
    return DEFAULT_API_BASE;
  }

  if (isPlaceholder) {
    throw new Error('NEXT_PUBLIC_API_URL is still set to the placeholder Render URL. Set it to the deployed backend URL.');
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    return url.origin;
  } catch {
    throw new Error(`Invalid NEXT_PUBLIC_API_URL: ${RAW_API_BASE}`);
  }
}

const BASE = apiBase();

// ================= TYPES =================

export type User = {
  id: string;
  name?: string;
  email: string;
  role?: string;
  trainer_id?: string;
  is_active?: boolean;
};

export type Client = {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  country_code?: string;
  mobile?: string;
  is_mobile_redacted?: boolean;
  alt_country_code?: string;
  alt_mobile?: string;
  email?: string;
  emergency_no?: string;
  gender?: string;
  dob?: string;
  anniversary?: string;
  weight?: number;
  reference_no?: string;
  aadhaar_no?: string;
  pan_no?: string;
  gst_no?: string;
  company_name?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  client_id?: string;
  member_code?: string;
  trainer_id?: string;
  trainer_name?: string;
  package_type?: string;
  status?: string;
  balance_amount?: number;
  frozen_from?: string;
  frozen_until?: string;
  pt_start_date?: string;
  pt_end_date?: string;
  joining_date?: string;
  base_amount?: number;
  discount?: number;
  final_amount?: number;
  paid_amount?: number;
  payment_method?: string;
  payment_date?: string;
  interested_in?: string;
  notes?: string;
  photo_url?: string;
  biometric_added?: boolean;
  biometric_code?: string;
  app_installed?: boolean;
  face_enrolled_at?: string;
};

export type Trainer = {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  role?: string;
  salary?: number;
  incentive_rate?: number;
  status?: string;
  biometric_added?: boolean;
  biometric_code?: string;
};

export type Payment = {
  id: string;
  amount: number;
  date: string;
  receipt_no?: string;
  client_name?: string;
  method?: string;
  trainer_id?: string;
  notes?: string;
};

export type Attendance = {
  id?: string;
  ref_id: string;
  status: string;
  check_in?: string;
};

// Mirror of the dashboard summary endpoint shape. Kept loose-typed
// (everything optional) because individual fields can be missing or zero
// when there's no data for a period — defensive UI code should still
// render gracefully instead of throwing on undefined access.
export interface DashSummary {
  period?: 'today' | '7d' | '30d' | '90d';
  clients?: {
    total?: number;
    active?: number;
    expired?: number;
    frozen?: number;
    new_this_month?: number;
  };
  revenue?: {
    today?: number;
    month?: number;
    year?: number;
    total?: number;
    period?: number;
  };
  expiring_soon?: number;
  total_dues?: number;
  attendance_today?: number;
  birthdays_today?: number;
  anniversaries_today?: number;
  pending_renewals?: number;
  active_pt_clients?: number;
  recent_payments?: Array<{
    id: string;
    amount: number;
    method?: string;
    date: string;
    receipt_no?: string;
    client_name?: string;
    trainer_name?: string;
  }>;
  monthly_chart?: Array<{ month: string; revenue: number; count: number }>;
  top_trainers?: Array<{
    id: string;
    name: string;
    specialization?: string;
    active_clients?: number;
    month_revenue?: number;
  }>;
}

export type FaceCheckInResponse = {
  success: boolean;
  message: string;
  member?: {
    id: string;
    name: string;
    status: string;
    photo_url?: string;
    member_code?: string;
    package_type?: string;
  };
  distance?: number;
  log_id?: string;
  error?: string;
};

// ================= HELPERS =================

function token() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('619_token');
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

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = token();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({ error: 'Bad response' }));
  if (res.status === 401) {
    const skipRedirect =
      path.endsWith('/api/auth/login') || path.endsWith('/api/auth/me');
    if (!skipRedirect) handleAuthFailure();
    throw new Error(data.error || 'Session expired, please log in again');
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

const qs = (p?: object) =>
  p
    ? '?' +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(p).filter(([, v]) => v != null && v !== '')
        )
      ).toString()
    : '';

// ================= API =================

export const api = {
  auth: {
    login: (email: string, password: string) =>
      req<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => req<{ user: User }>('/api/auth/me'),
    listUsers: () => req<User[]>('/api/auth/users'),
    createUser: (data: any) =>
      req('/api/auth/create-user', { method: 'POST', body: JSON.stringify(data) }),
    toggleUser: (id: string) =>
      req(`/api/auth/users/${id}/toggle`, { method: 'PUT' }),
    deleteUser: (id: string) =>
      req(`/api/auth/users/${id}`, { method: 'DELETE' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      req('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  dashboard: {
    summary: () => req<DashSummary>('/api/dashboard/summary'),
  },

  clients: {
    list: (p?: any) => req<Client[]>(`/api/clients${qs(p)}`),
    get: (id: string) => req<Client>(`/api/clients/${id}`),
    create: (data: any) =>
      req<{ message: string; client: Client }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    renew: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      req<{ message: string }>(`/api/clients/${id}`, { method: 'DELETE' }),

    // ── Membership action endpoints ─────────────────────────────────
    // All routes are mounted under `/api/clients/:id/<action>` and
    // implemented in backend/src/routes/client-actions.js. Going through
    // req() guarantees auth headers, JSON parsing, 401 redirects, and
    // proper rejection on 4xx / 5xx — which raw fetch() does not do.
    addSubscription: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/add-subscription`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    renewSubscription: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/renew-subscription`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    freeze: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/freeze`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    extension: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/extension`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    upgrade: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/upgrade`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    downgrade: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/downgrade`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    transfer: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    combo: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/combo`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    trial: (id: string, data: any) =>
      req<{ message: string }>(`/api/clients/${id}/trial`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    assignPt: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/assign-pt`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    renewPt: (id: string, data: any) =>
      req<{ message: string; client: Client }>(`/api/clients/${id}/renew-pt`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  trainers: {
    list: () => req<Trainer[]>('/api/trainers'),
    get: (id: string) => req<Trainer>(`/api/trainers/${id}`),
    create: (data: any) =>
      req<{ message: string; trainer: Trainer }>('/api/trainers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      req<{ message: string; trainer: Trainer }>(`/api/trainers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      req<{ message: string }>(`/api/trainers/${id}`, { method: 'DELETE' }),
  },

  payments: {
    list: (p?: any) => req<Payment[]>(`/api/payments${qs(p)}`),
    create: (data: any) =>
      req<{ message: string; payment: Payment }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      req<{ message: string }>(`/api/payments/${id}`, { method: 'DELETE' }),
  },

  attendance: {
    list: (p?: any) => req<Attendance[]>(`/api/attendance${qs(p)}`),
    mark: (data: any) =>
      req('/api/attendance', { method: 'POST', body: JSON.stringify(data) }),
    biometric: (data: { biometric_code: string; type?: 'client' | 'trainer' }) =>
      req<{ message: string; attendance: Attendance; person: { id: string; name: string; type: string } }>('/api/attendance/biometric', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // FACE CHECK-IN
  checkin: {
    face: (descriptor: number[]) =>
      req<FaceCheckInResponse>('/api/checkin/face', {
        method: 'POST',
        body: JSON.stringify({ descriptor }),
      }),
    enroll: (clientId: string, descriptor: number[]) =>
      req<{ message: string }>('/api/checkin/enroll', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, descriptor }),
      }),
    logs: (params?: { date?: string; limit?: number }) =>
      req<any[]>(`/api/checkin/logs${qs(params)}`),
  },

  reports: {
    monthly: (year?: number) =>
      req<any[]>(`/api/reports/monthly${year ? `?year=${year}` : ''}`),
    trainerSummary: () => req<any[]>('/api/reports/trainer-summary'),
    dues: () => req<any[]>('/api/reports/dues'),
  },
};
