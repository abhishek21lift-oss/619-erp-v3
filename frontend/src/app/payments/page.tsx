'use client';
/**
 * Payments Page — premium SaaS rebuild
 * Features:
 *  • KPI strip (total revenue, today's, this month, pending dues)
 *  • Date range filter (from/to)
 *  • Payment method filter
 *  • Record New Payment modal (admin/manager)
 *  • Sortable table with CSV export
 *  • Admin delete with confirm
 */
import { useEffect, useState, useCallback, useRef, useMemo, FormEvent } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  Plus, Download, Trash2, DollarSign, TrendingUp, Calendar,
  AlertCircle, ChevronLeft, ChevronRight, X, Search,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface Payment {
  id: string | number;
  receipt_no?: string;
  client_id?: number | string;
  client_name?: string;
  amount: number;
  method: string;
  date: string;
  notes?: string;
  trainer_name?: string;
}

interface ClientOption {
  id: number | string;
  name: string;
  balance_due?: number;
  balance_amount?: number;
}

const METHODS = ['ALL', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER'];
const PAGE_SIZE = 50;

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function isoToday() {
  return new Date().toISOString().split('T')[0];
}

function isoMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function exportCSV(payments: Payment[]) {
  const headers = ['Receipt', 'Member', 'Amount', 'Method', 'Date', 'Notes'];
  const rows = payments.map((p) => [p.receipt_no ?? '', p.client_name ?? '', p.amount, p.method, p.date, p.notes ?? '']);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `619_payments_${isoToday()}.csv`;
  a.click();
}

/* ─── KPI Card ──────────────────────────────────────────── */
function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="kpi-icon" style={{ color }}>{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ─── Skeleton Row ──────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[80, 140, 90, 80, 90, 120].map((w, i) => (
        <td key={i}><div className="skeleton" style={{ height: 13, width: w, borderRadius: 4 }} /></td>
      ))}
      <td />
    </tr>
  );
}

/* ─── Record Payment Modal ──────────────────────────────── */
function RecordPaymentModal({
  clients, onClose, onSaved,
}: {
  clients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = isoToday();
  const [form, setForm] = useState({ client_id: '', amount: '', method: 'CASH', date: today, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const S = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedClient = clients.find((c) => String(c.id) === form.client_id);
  const balanceDue = Number(selectedClient?.balance_due ?? selectedClient?.balance_amount ?? 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.client_id || !form.amount) { setError('Member and Amount are required.'); return; }
    setSaving(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Record New Payment</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger" style={{ fontSize: 13 }}>{error}</div>}

            <div className="form-group">
              <label className="form-label">Member *</label>
              <select className="input" value={form.client_id} onChange={S('client_id')} required>
                <option value="">Select member…</option>
                {clients.map((c) => {
                  const due = Number(c.balance_due ?? c.balance_amount ?? 0);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name}{due > 0 ? ` — Due: ${fmtAmount(due)}` : ''}
                    </option>
                  );
                })}
              </select>
              {balanceDue > 0 && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  Outstanding balance: {fmtAmount(balanceDue)}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  className="input" type="number" min="1" step="1"
                  value={form.amount} onChange={S('amount')} required
                  placeholder={balanceDue > 0 ? String(balanceDue) : '0'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Method</label>
                <select className="input" value={form.method} onChange={S('method')}>
                  <option>CASH</option>
                  <option>UPI</option>
                  <option>CARD</option>
                  <option>BANK_TRANSFER</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="input" type="date" value={form.date} onChange={S('date')} required />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="input" value={form.notes} onChange={S('notes')} placeholder="Optional note…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
function PaymentsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients]   = useState<ClientOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showModal, setShowModal] = useState(false);

  const [filterFrom, setFilterFrom]     = useState('');
  const [filterTo, setFilterTo]         = useState('');
  const [filterMethod, setFilterMethod] = useState('ALL');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const today      = isoToday();
  const monthStart = isoMonthStart();

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams();
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo)   params.set('to', filterTo);

      const [pRes, cRes] = await Promise.allSettled([
        fetch(`/api/payments?${params}`, { headers }),
        fetch('/api/clients', { headers }),
      ]);

      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const d = await pRes.value.json();
        setPayments(Array.isArray(d) ? d : (d.payments ?? []));
      }
      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        const d = await cRes.value.json();
        setClients(Array.isArray(d) ? d : (d.clients ?? []));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [filterFrom, filterTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setPage(1); }, [filterFrom, filterTo, filterMethod, search]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const all = payments;
    const total    = all.reduce((s, p) => s + Number(p.amount), 0);
    const todayRev = all.filter((p) => p.date === today).reduce((s, p) => s + Number(p.amount), 0);
    const monthRev = all.filter((p) => p.date >= monthStart).reduce((s, p) => s + Number(p.amount), 0);
    const dueTot   = clients.reduce((s, c) => s + Number(c.balance_due ?? c.balance_amount ?? 0), 0);
    return { total, todayRev, monthRev, dueTot };
  }, [payments, clients, today, monthStart]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let list = [...payments];
    if (filterMethod !== 'ALL') list = list.filter((p) => p.method === filterMethod);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        (p.client_name ?? '').toLowerCase().includes(q) ||
        (p.receipt_no ?? '').toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [payments, filterMethod, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch(`/api/payments/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPayments((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  }

  const methodColor: Record<string, string> = {
    CASH: 'badge-success', UPI: 'badge-info', CARD: 'badge-secondary', BANK_TRANSFER: 'badge-warning',
  };

  return (
    <AppShell title="Payments">
      <div className="page-container animate-fade-in">

        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Payments</h1>
            <p className="page-subtitle">Revenue & collection ledger</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => exportCSV(filtered)}>
              <Download size={14} /> Export CSV
            </button>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                <Plus size={14} /> Record Payment
              </button>
            )}
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
          <KpiCard label="Total Collected"  value={fmtAmount(kpis.total)}    icon={<DollarSign size={18} />}  color="var(--success)" />
          <KpiCard label="Today's Revenue"  value={fmtAmount(kpis.todayRev)} icon={<TrendingUp size={18} />}  color="var(--brand)" />
          <KpiCard label="This Month"       value={fmtAmount(kpis.monthRev)} icon={<Calendar size={18} />}    color="var(--info)" />
          <KpiCard label="Outstanding Dues" value={fmtAmount(kpis.dueTot)}   icon={<AlertCircle size={18} />} color="var(--danger)" />
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            {error}
            <button className="btn btn-ghost btn-sm" onClick={fetchAll}>Retry</button>
          </div>
        )}

        {/* ── Filters bar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="input-wrap" style={{ maxWidth: 260 }}>
            <span className="input-icon"><Search size={14} /></span>
            <input type="search" className="input" placeholder="Search member, receipt…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>From</span>
            <input className="input" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} style={{ maxWidth: 150 }} />
            <span>to</span>
            <input className="input" type="date" value={filterTo}   onChange={(e) => setFilterTo(e.target.value)}   style={{ maxWidth: 150 }} />
          </div>
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            {METHODS.map((m) => (
              <button key={m} className={`tab-btn ${filterMethod === m ? 'active' : ''}`} onClick={() => setFilterMethod(m)} style={{ fontSize: 11 }}>
                {m === 'ALL' ? 'All Methods' : m}
              </button>
            ))}
          </div>
          {(filterFrom || filterTo || filterMethod !== 'ALL' || search) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterMethod('ALL'); setSearch(''); }}>
              <X size={12} /> Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>
            {fmtAmount(filtered.reduce((s, p) => s + Number(p.amount), 0))} filtered
          </div>
        </div>

        {/* ── Table ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th>Notes</th>
                  {isAdmin && <th style={{ width: 40 }} />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6}>
                      <div className="empty-state">
                        <DollarSign size={32} className="empty-state-icon" />
                        <p className="empty-state-title">No payments found</p>
                        <p className="empty-state-desc">{search ? 'Try a different search term.' : 'No payments match the current filters.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                          {p.receipt_no ?? '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.client_name ?? '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>
                        {fmtAmount(p.amount)}
                      </td>
                      <td>
                        <span className={`badge ${methodColor[p.method] ?? 'badge-secondary'}`} style={{ fontSize: 11 }}>
                          {p.method}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDate(p.date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {p.notes ?? '—'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => setDeleteTarget(p)}
                            title="Delete payment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
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
              <span>{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm btn-icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={15} />
                </button>
                <span style={{ padding: '4px 10px', fontWeight: 600 }}>{page} / {totalPages}</span>
                <button className="btn btn-ghost btn-sm btn-icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Record Payment Modal ── */}
      {showModal && (
        <RecordPaymentModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll(); }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Payment</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)' }}>
                Delete payment of <strong>{fmtAmount(deleteTarget.amount)}</strong> from <strong>{deleteTarget.client_name}</strong>?
                The member's outstanding balance will be adjusted.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function PaymentsPage() {
  return <Guard><PaymentsContent /></Guard>;
}
