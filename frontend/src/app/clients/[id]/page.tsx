'use client';
/**
 * Client Profile Page
 * Shows full member details: personal info, membership status,
 * attendance history, payment history, face-enroll status, notes.
 */
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft, User, Phone, Mail, Calendar, CreditCard, Activity,
  ScanFace, RefreshCw, Snowflake, Trash2, Edit2, MessageCircle,
  CheckCircle, XCircle, Clock, AlertCircle, Dumbbell,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface ClientDetail {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  address?: string;
  status: 'active' | 'expired' | 'frozen' | 'pending';
  membership_plan?: string;
  expiry_date?: string;
  balance_due?: number;
  face_enrolled?: boolean;
  join_date?: string;
  trainer_name?: string;
  emergency_contact?: string;
  notes?: string;
  photo_url?: string;
}

interface AttendanceLog {
  id: number;
  date: string;
  check_in_time: string;
  check_out_time?: string;
  method: string;
}

interface PaymentLog {
  id: number;
  date: string;
  amount: number;
  plan: string;
  method: string;
  receipt?: string;
}

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(t?: string) {
  if (!t) return '—';
  const dt = new Date(t);
  if (isNaN(dt.getTime())) return t;
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function daysUntil(d?: string): number {
  if (!d) return 9999;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function StatusBadge({ status }: { status: ClientDetail['status'] }) {
  const map: Record<string, string> = {
    active: 'badge-success', expired: 'badge-danger',
    frozen: 'badge-info', pending: 'badge-warning',
  };
  return <span className={`badge ${map[status] ?? 'badge-secondary'}`}>{status}</span>;
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────── */
export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [client, setClient]       = useState<ClientDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [payments, setPayments]   = useState<PaymentLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'payments'>('overview');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const headers = { Authorization: `Bearer ${token}` };

      const [cRes, aRes, pRes] = await Promise.allSettled([
        fetch(`/api/clients/${id}`, { headers }),
        fetch(`/api/clients/${id}/attendance`, { headers }),
        fetch(`/api/clients/${id}/payments`, { headers }),
      ]);

      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        setClient(await cRes.value.json());
      } else {
        throw new Error('Member not found');
      }
      if (aRes.status === 'fulfilled' && aRes.value.ok) {
        const d = await aRes.value.json();
        setAttendance(Array.isArray(d) ? d : (d.logs ?? []));
      }
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const d = await pRes.value.json();
        setPayments(Array.isArray(d) ? d : (d.payments ?? []));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load member.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push('/clients');
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
      setDeleting(false);
    }
  }

  const whatsappHref = () => {
    if (!client?.phone) return '#';
    const n = client.phone.replace(/\D/g, '');
    const num = n.startsWith('91') ? n : `91${n}`;
    const msg = encodeURIComponent(`Hi ${client.name}, this is a message from 619 Fitness Studio.`);
    return `https://wa.me/${num}?text=${msg}`;
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <Guard>
        <AppShell title="Member Profile">
          <div className="page-container">
            <div className="skeleton" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />
          </div>
        </AppShell>
      </Guard>
    );
  }

  /* ── Error ── */
  if (error || !client) {
    return (
      <Guard>
        <AppShell title="Member Profile">
          <div className="page-container">
            <div className="empty-state">
              <User size={36} className="empty-state-icon" />
              <p className="empty-state-title">{error || 'Member not found'}</p>
              <button className="btn btn-primary btn-sm" onClick={() => router.back()}>Go back</button>
            </div>
          </div>
        </AppShell>
      </Guard>
    );
  }

  const days = daysUntil(client.expiry_date);
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  return (
    <Guard>
      <AppShell title="Member Profile">
        <div className="page-container animate-fade-in">

          {/* ── Back nav ── */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.back()}
            style={{ marginBottom: 16 }}
          >
            <ArrowLeft size={14} /> Back to Members
          </button>

          {/* ── Profile header card ── */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div style={{
                width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                background: 'var(--gradient-brand, linear-gradient(135deg,#dc2626,#b91c1c))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 700, color: '#fff',
              }}>
                {client.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              {/* Name / meta */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{client.name}</h2>
                  <StatusBadge status={client.status} />
                  {client.face_enrolled && (
                    <span className="badge badge-info" title="Face enrolled">
                      <ScanFace size={11} /> Face ID
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                  {client.phone && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} /> {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} /> {client.email}
                    </span>
                  )}
                  {client.membership_plan && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Dumbbell size={12} /> {client.membership_plan}
                    </span>
                  )}
                </div>

                {/* Expiry warning */}
                {client.status === 'active' && days <= 30 && (
                  <div className="alert alert-warning" style={{ marginTop: 10, padding: '6px 12px', fontSize: 12 }}>
                    <Clock size={12} />
                    Membership expires in {days} day{days !== 1 ? 's' : ''} — {fmtDate(client.expiry_date)}
                  </div>
                )}
                {client.status === 'expired' && (
                  <div className="alert alert-danger" style={{ marginTop: 10, padding: '6px 12px', fontSize: 12 }}>
                    <XCircle size={12} /> Membership expired on {fmtDate(client.expiry_date)}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {client.phone && (
                  <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                <Link href={`/clients/${id}/renew`} className="btn btn-outline btn-sm">
                  <RefreshCw size={13} /> Renew
                </Link>
                <Link href={`/checkin?enroll=${id}`} className="btn btn-outline btn-sm">
                  <ScanFace size={13} /> Enroll Face
                </Link>
                {isAdmin && (
                  <Link href={`/clients/${id}/edit`} className="btn btn-outline btn-sm">
                    <Edit2 size={13} /> Edit
                  </Link>
                )}
                {isAdmin && (
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="tab-bar" style={{ marginBottom: 16 }}>
            {(['overview', 'attendance', 'payments'] as const).map((t) => (
              <button
                key={t}
                className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Overview tab ── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

              {/* Personal info */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={14} /> Personal Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <InfoRow label="Date of Birth" value={fmtDate(client.dob)} />
                  <InfoRow label="Gender" value={client.gender} />
                  <InfoRow label="Phone" value={client.phone} />
                  <InfoRow label="Email" value={client.email} />
                  <div style={{ gridColumn: '1/-1' }}>
                    <InfoRow label="Address" value={client.address} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <InfoRow label="Emergency Contact" value={client.emergency_contact} />
                  </div>
                </div>
              </div>

              {/* Membership info */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={14} /> Membership
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <InfoRow label="Plan" value={client.membership_plan} />
                  <InfoRow label="Status" value={<StatusBadge status={client.status} />} />
                  <InfoRow label="Join Date" value={fmtDate(client.join_date)} />
                  <InfoRow label="Expiry Date" value={fmtDate(client.expiry_date)} />
                  <InfoRow label="Assigned Trainer" value={client.trainer_name} />
                  <InfoRow label="Balance Due" value={
                    (client.balance_due ?? 0) > 0
                      ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>₹{client.balance_due?.toLocaleString('en-IN')}</span>
                      : <span style={{ color: 'var(--success)' }}>Cleared</span>
                  } />
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <Link href={`/clients/${id}/subscription/new`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <CreditCard size={13} /> Add Subscription
                  </Link>
                  <Link href={`/clients/${id}/freeze`} className="btn btn-outline btn-sm">
                    <Snowflake size={13} /> Freeze
                  </Link>
                </div>
              </div>

              {/* Notes */}
              {client.notes && (
                <div className="card" style={{ padding: 20, gridColumn: '1/-1' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Notes</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {client.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Attendance tab ── */}
          {activeTab === 'attendance' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={14} /> Attendance History
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{attendance.length} records</span>
              </div>
              {attendance.length === 0 ? (
                <div className="empty-state">
                  <Activity size={32} className="empty-state-icon" />
                  <p className="empty-state-title">No attendance records</p>
                  <p className="empty-state-desc">Check-in history will appear here.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Method</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 100).map((a) => {
                        const inTime  = a.check_in_time ? new Date(a.check_in_time) : null;
                        const outTime = a.check_out_time ? new Date(a.check_out_time) : null;
                        const durMin  = inTime && outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : null;
                        return (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 500 }}>{fmtDate(a.date)}</td>
                            <td>{fmtTime(a.check_in_time)}</td>
                            <td>{fmtTime(a.check_out_time)}</td>
                            <td>
                              <span className={`badge ${a.method === 'face' ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: 11 }}>
                                {a.method}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                              {durMin !== null ? `${durMin} min` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Payments tab ── */}
          {activeTab === 'payments' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={14} /> Payment History
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{payments.length} records</span>
              </div>
              {payments.length === 0 ? (
                <div className="empty-state">
                  <CreditCard size={32} className="empty-state-icon" />
                  <p className="empty-state-title">No payment records</p>
                  <p className="empty-state-desc">Payment history will appear here.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{fmtDate(p.date)}</td>
                          <td>{p.plan}</td>
                          <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <span className="badge badge-secondary" style={{ fontSize: 11 }}>{p.method}</span>
                          </td>
                          <td>
                            {p.receipt ? (
                              <a href={p.receipt} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                                View
                              </a>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Delete Confirmation Modal ── */}
        {deleteConfirm && (
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(false)}>
            <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3 className="modal-title">Delete Member</h3>
                <button className="modal-close" onClick={() => setDeleteConfirm(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)' }}>
                  Permanently delete <strong>{client.name}</strong>? All their data including attendance and payments will be removed. This cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
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
