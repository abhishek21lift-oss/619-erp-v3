'use client';
/**
 * Clients (All Members) Page — premium SaaS rebuild
 * Features:
 *  • Debounced search (350 ms)
 *  • Segment filter tabs (all / active / expired / frozen / dues / expiring / birthdays)
 *  • Sortable columns
 *  • Pagination (PAGE_SIZE = 50)
 *  • CSV export
 *  • WhatsApp quick-link
 *  • Add Member button
 *  • Per-row action dropdown (view / add-sub / renew / freeze / enroll-face / delete)
 *  • Admin-only delete with confirmation
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Guard from '@/components/Guard';
import { useAuth } from '@/lib/auth-context';
import {
  Search, UserPlus, Download, MoreHorizontal, Eye, CreditCard,
  RefreshCw, Snowflake, ScanFace, Trash2, MessageCircle,
  ChevronLeft, ChevronRight, Users, CheckCircle, XCircle,
  AlertCircle, DollarSign, Clock, Cake,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'expired' | 'frozen' | 'pending';
  membership_plan?: string;
  expiry_date?: string;
  balance_due?: number;
  face_enrolled?: boolean;
  dob?: string;
  join_date?: string;
  trainer_name?: string;
}

type Segment = 'all' | 'active' | 'expired' | 'frozen' | 'dues' | 'expiring' | 'birthdays';
type SortKey = 'name' | 'status' | 'expiry_date' | 'balance_due' | 'join_date';
type SortDir = 'asc' | 'desc';

/* ─── Constants ─────────────────────────────────────────── */
const PAGE_SIZE = 50;

const SEGMENTS: { key: Segment; label: string; icon: React.ReactNode }[] = [
  { key: 'all',       label: 'All Members',   icon: <Users size={13} /> },
  { key: 'active',    label: 'Active',         icon: <CheckCircle size={13} /> },
  { key: 'expired',   label: 'Expired',        icon: <XCircle size={13} /> },
  { key: 'frozen',    label: 'Frozen',         icon: <Snowflake size={13} /> },
  { key: 'dues',      label: 'Has Dues',       icon: <DollarSign size={13} /> },
  { key: 'expiring',  label: 'Expiring Soon',  icon: <Clock size={13} /> },
  { key: 'birthdays', label: 'Birthdays',      icon: <Cake size={13} /> },
];

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(d?: string): number {
  if (!d) return 9999;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function isThisMonthBirthday(dob?: string): boolean {
  if (!dob) return false;
  const m = new Date(dob).getMonth();
  return m === new Date().getMonth();
}

function whatsappHref(phone?: string, name?: string) {
  if (!phone) return '#';
  const cleaned = phone.replace(/\D/g, '');
  const num = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
  const msg = encodeURIComponent(`Hi ${name ?? 'there'}, this is a message from 619 Fitness Studio.`);
  return `https://wa.me/${num}?text=${msg}`;
}

function exportCSV(clients: Client[]) {
  const headers = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Plan', 'Expiry', 'Balance Due', 'Face Enrolled', 'Join Date'];
  const rows = clients.map((c) => [
    c.id, c.name, c.email ?? '', c.phone ?? '',
    c.status, c.membership_plan ?? '',
    c.expiry_date ?? '', c.balance_due ?? 0,
    c.face_enrolled ? 'Yes' : 'No', c.join_date ?? '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `619_clients_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Status Badge ──────────────────────────────────────── */
function StatusBadge({ status }: { status: Client['status'] }) {
  const map: Record<string, string> = {
    active: 'badge-success', expired: 'badge-danger',
    frozen: 'badge-info', pending: 'badge-warning',
  };
  return <span className={`badge ${map[status] ?? 'badge-secondary'}`}>{status}</span>;
}

/* ─── Row Action Menu ───────────────────────────────────── */
function RowMenu({ client, onDelete }: { client: Client; onDelete: (c: Client) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const go = (path: string) => { setOpen(false); router.push(path); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Actions"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="dropdown-menu" style={{ right: 0, minWidth: 180 }}>
          <button className="dropdown-item" onClick={() => go(`/clients/${client.id}`)}>
            <Eye size={13} /> View profile
          </button>
          <button className="dropdown-item" onClick={() => go(`/clients/${client.id}/subscription/new`)}>
            <CreditCard size={13} /> Add subscription
          </button>
          <button className="dropdown-item" onClick={() => go(`/clients/${client.id}/renew`)}>
            <RefreshCw size={13} /> Renew membership
          </button>
          <button className="dropdown-item" onClick={() => go(`/clients/${client.id}/freeze`)}>
            <Snowflake size={13} /> Freeze membership
          </button>
          {client.phone && (
            <a
              className="dropdown-item"
              href={whatsappHref(client.phone, client.name)}
              target="_blank" rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          <button className="dropdown-item" onClick={() => go(`/checkin?enroll=${client.id}`)}>
            <ScanFace size={13} /> Enroll face
          </button>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item dropdown-item-danger"
                onClick={() => { setOpen(false); onDelete(client); }}
              >
                <Trash2 size={13} /> Delete member
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton Row ──────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[120, 80, 90, 80, 90, 70, 60].map((w, i) => (
        <td key={i}><div className="skeleton" style={{ height: 14, width: w, borderRadius: 4 }} /></td>
      ))}
      <td />
    </tr>
  );
}

/* ─── KPI Card ──────────────────────────────────────────── */
function KpiCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="kpi-icon" style={{ color }}>{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function ClientsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [clients, setClients]       = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [segment, setSegment]       = useState<Segment>('all');
  const [sortKey, setSortKey]       = useState<SortKey>('name');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [page, setPage]             = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const searchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  /* ── Debounce search ── */
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  /* ── Fetch clients ── */
  const fetchClients = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : (data.clients ?? []));
    } catch (e: any) {
      setError(e.message || 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  /* ── KPI counts ── */
  const kpis = useMemo(() => ({
    total:   clients.length,
    active:  clients.filter((c) => c.status === 'active').length,
    expired: clients.filter((c) => c.status === 'expired').length,
    frozen:  clients.filter((c) => c.status === 'frozen').length,
    dues:    clients.filter((c) => (c.balance_due ?? 0) > 0).length,
  }), [clients]);

  /* ── Filter + search ── */
  const filtered = useMemo(() => {
    let list = [...clients];

    /* segment filter */
    if (segment === 'active')    list = list.filter((c) => c.status === 'active');
    if (segment === 'expired')   list = list.filter((c) => c.status === 'expired');
    if (segment === 'frozen')    list = list.filter((c) => c.status === 'frozen');
    if (segment === 'dues')      list = list.filter((c) => (c.balance_due ?? 0) > 0);
    if (segment === 'expiring')  list = list.filter((c) => c.status === 'active' && daysUntil(c.expiry_date) <= 30);
    if (segment === 'birthdays') list = list.filter((c) => isThisMonthBirthday(c.dob));

    /* search */
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      );
    }

    /* sort */
    list.sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      if (sortKey === 'name')         { va = a.name; vb = b.name; }
      if (sortKey === 'status')       { va = a.status; vb = b.status; }
      if (sortKey === 'expiry_date')  { va = a.expiry_date ?? ''; vb = b.expiry_date ?? ''; }
      if (sortKey === 'balance_due')  { va = a.balance_due ?? 0; vb = b.balance_due ?? 0; }
      if (sortKey === 'join_date')    { va = a.join_date ?? ''; vb = b.join_date ?? ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [clients, segment, debouncedSearch, sortKey, sortDir]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* Reset page on filter change */
  useEffect(() => setPage(1), [segment, debouncedSearch, sortKey, sortDir]);

  /* ── Sort toggle ── */
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  /* ── Delete ── */
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch(`/api/clients/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  }

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <Guard>
      <AppShell title="Members">
        <div className="page-container animate-fade-in">

          {/* ── Page header ── */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Members</h1>
              <p className="page-subtitle">{kpis.total.toLocaleString()} total members</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => exportCSV(filtered)}
                title="Export filtered list as CSV"
              >
                <Download size={14} /> Export CSV
              </button>
              <Link href="/clients/new" className="btn btn-primary btn-sm">
                <UserPlus size={14} /> Add Member
              </Link>
            </div>
          </div>

          {/* ── KPI strip ── */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
            <KpiCard label="Total"   value={kpis.total}   icon={<Users size={18} />}         color="var(--brand)" />
            <KpiCard label="Active"  value={kpis.active}  icon={<CheckCircle size={18} />}   color="var(--success)" />
            <KpiCard label="Expired" value={kpis.expired} icon={<XCircle size={18} />}       color="var(--danger)" />
            <KpiCard label="Frozen"  value={kpis.frozen}  icon={<Snowflake size={18} />}     color="var(--info)" />
            <KpiCard label="Has Dues" value={kpis.dues}   icon={<AlertCircle size={18} />}   color="var(--warning)" />
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="alert alert-danger animate-slide-up" style={{ marginBottom: 16 }}>
              {error}
              <button className="btn btn-ghost btn-sm" onClick={fetchClients}>Retry</button>
            </div>
          )}

          {/* ── Segment tabs ── */}
          <div className="tab-bar" style={{ marginBottom: 16 }}>
            {SEGMENTS.map((s) => (
              <button
                key={s.key}
                className={`tab-btn ${segment === s.key ? 'active' : ''}`}
                onClick={() => setSegment(s.key)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* ── Search bar ── */}
          <div style={{ marginBottom: 16, maxWidth: 380 }}>
            <div className="input-wrap">
              <span className="input-icon"><Search size={14} /></span>
              <input
                type="search"
                className="input"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── Table ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Name <SortIcon k="name" />
                    </th>
                    <th>Phone</th>
                    <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Status <SortIcon k="status" />
                    </th>
                    <th>Plan</th>
                    <th onClick={() => toggleSort('expiry_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Expiry <SortIcon k="expiry_date" />
                    </th>
                    <th onClick={() => toggleSort('balance_due')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Balance <SortIcon k="balance_due" />
                    </th>
                    <th onClick={() => toggleSort('join_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Joined <SortIcon k="join_date" />
                    </th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <Users size={36} className="empty-state-icon" />
                          <p className="empty-state-title">No members found</p>
                          <p className="empty-state-desc">
                            {debouncedSearch ? 'Try a different search term.' : 'Add your first member to get started.'}
                          </p>
                          {!debouncedSearch && (
                            <Link href="/clients/new" className="btn btn-primary btn-sm">
                              <UserPlus size={14} /> Add Member
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((c) => {
                      const days = daysUntil(c.expiry_date);
                      return (
                        <tr
                          key={c.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/clients/${c.id}`)}
                        >
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                            {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                          </td>
                          <td>
                            {c.phone ? (
                              <a
                                href={whatsappHref(c.phone, c.name)}
                                target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                                title="Open WhatsApp"
                              >
                                {c.phone}
                              </a>
                            ) : '—'}
                          </td>
                          <td><StatusBadge status={c.status} /></td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            {c.membership_plan ?? '—'}
                          </td>
                          <td>
                            {c.expiry_date ? (
                              <span style={{ color: days <= 7 ? 'var(--danger)' : days <= 30 ? 'var(--warning)' : 'var(--text-secondary)', fontSize: 13 }}>
                                {fmtDate(c.expiry_date)}
                                {days <= 30 && days > 0 && (
                                  <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>({days}d)</span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            {(c.balance_due ?? 0) > 0 ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                ₹{(c.balance_due ?? 0).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--success)', fontSize: 13 }}>Cleared</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            {fmtDate(c.join_date)}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <RowMenu client={c} onDelete={setDeleteTarget} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {!loading && filtered.length > PAGE_SIZE && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderTop: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text-muted)',
              }}>
                <span>
                  {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span style={{ padding: '4px 10px', fontWeight: 600 }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Delete Confirmation Modal ── */}
        {deleteTarget && (
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
            <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3 className="modal-title">Delete Member</h3>
                <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </Guard>
  );
}
