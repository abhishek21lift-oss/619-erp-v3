'use client';
import React, { use } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { request } from '@/lib/http';
import { fmtDate } from '@/lib/format';
import { Camera, User, Phone, Mail, Briefcase, Calendar, TrendingUp, Users, CheckCircle2, IndianRupee, Edit2, Trash2, Upload, RefreshCw } from 'lucide-react';

// Next.js 15+ made dynamic route `params` a Promise — must be unwrapped with
// React.use() in client components. Reading `params.id` directly yields
// `undefined` and triggers a spurious "not found" against /api/trainers/undefined.
export default function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Guard role="admin"><TrainerDetail id={id} /></Guard>;
}

function TrainerDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    api.trainers.get(id)
      .then((d: any) => {
        setData(d);
        // Load cached photo if no photo_url in backend data
        const cachedPhoto = localStorage.getItem(`trainer_photo_${id}`);
        if (cachedPhoto && !d.photo_url) {
          setData((prev: any) => ({ ...prev, photo_url: cachedPhoto }));
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch assigned clients for stats
  useEffect(() => {
    if (!data) return;
    setStatsLoading(true);
    api.clients.list({ limit: 500 })
      .then((all: any) => {
        const list = Array.isArray(all) ? all : (all?.clients ?? []);
        setAssignedClients(list.filter((c: any) => c.trainer_id === id));
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [data, id]);

  async function updatePhoto(photoUrl: string) {
    if (!data) return;
    setPhotoSaving(true); setError(''); setSuccess('');
    try {
      const updated = await request<any>(`/api/trainers/${id}`, {
        method: 'PUT',
        body: { ...data, photo_url: photoUrl },
        retries: 1,
      });
      setData((prev: any) => ({ ...prev, ...(updated.trainer || updated), photo_url: photoUrl }));
      // Persist to localStorage
      if (photoUrl) {
        localStorage.setItem(`trainer_photo_${id}`, photoUrl);
      } else {
        localStorage.removeItem(`trainer_photo_${id}`);
      }
      setSuccess('Photo updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setData((prev: any) => ({ ...prev, photo_url: photoUrl }));
      // Still persist even on error
      if (photoUrl) {
        localStorage.setItem(`trainer_photo_${id}`, photoUrl);
      } else {
        localStorage.removeItem(`trainer_photo_${id}`);
      }
      setSuccess('Photo updated (local only — will sync when backend is live).');
      setTimeout(() => setSuccess(''), 4000);
    } finally { setPhotoSaving(false); }
  }

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 1_500_000) { setError('Please choose an image smaller than 1.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => updatePhoto(String(reader.result || ''));
    reader.onerror = () => setError('Could not read the selected image.');
    reader.readAsDataURL(file);
  }

  function promptPhotoUrl() {
    const url = window.prompt('Paste an image URL for this trainer', data?.photo_url || '');
    if (url === null) return;
    updatePhoto(url.trim());
  }

  function removePhoto() { updatePhoto(''); }

  const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const fmtK = (n: any) => {
    const v = Number(n || 0);
    if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
    if (v >= 1000)   return '₹' + (v / 1000).toFixed(1) + 'K';
    return '₹' + v.toLocaleString('en-IN');
  };

  // Compute stats from assigned clients
  const today = new Date();
  const activePtClients = assignedClients.filter(c =>
    c.status === 'active' && c.pt_end_date && new Date(c.pt_end_date) >= today
  ).length;
  const thisMonthRev = assignedClients
    .filter(c => c.pt_end_date && new Date(c.pt_end_date) >= today)
    .reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
  const incentiveRate = thisMonthRev >= 50000 ? 50 : 40;

  if (loading) return (
    <AppShell>
      <div className="page-main">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="text-muted pulse">Loading trainer profile…</div>
        </div>
      </div>
    </AppShell>
  );

  if (!data || error) return (
    <AppShell>
      <div className="page-main">
        <div className="page-content">
          <div className="alert alert-error">{error || 'Trainer not found'}</div>
          <Link href="/trainers" className="btn btn-ghost">← Back to trainers</Link>
        </div>
      </div>
    </AppShell>
  );

  const t = data;
  const stats = data.stats || {};
  const clients: any[]  = data.clients || [];
  const payments: any[] = data.payments || [];
  const monthly: any[]  = data.monthly || [];
  const initials = (t.name || 'T').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const maxRev = Math.max(...monthly.map((m: any) => m.revenue), 1);

  return (
    <AppShell>
      <div className="page-main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => router.back()} className="btn btn-ghost btn-sm">←</button>
            <div>
              <div className="topbar-title">{t.name}</div>
              <div className="topbar-sub">{t.role || 'Personal Trainer'} · <span className={`badge badge-${t.status === 'active' ? 'active' : 'expired'}`}>{t.status}</span></div>
            </div>
          </div>
        </div>

        <div className="page-content fade-up">
          {error   && <div className="alert alert-error mb-2">{error}</div>}
          {success && <div className="alert alert-success mb-2">{success}</div>}

          {/* PREMIUM PROFILE HEADER */}
          <div className="trainer-profile-header">
            <div className="trainer-profile-banner" />
            <div className="trainer-profile-header-content">
              <div className="trainer-profile-photo-wrap">
                {t.photo_url
                  ? <img src={t.photo_url} alt={t.name} className="trainer-profile-img" />
                  : <div className="trainer-profile-initials">{initials}</div>
                }
                <div className="trainer-profile-photo-actions">
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="trainer-photo-btn"
                    title="Upload photo"
                    disabled={photoSaving}
                  >
                    <Camera size={14} />
                  </button>
                  {data.photo_url && (
                    <button
                      onClick={removePhoto}
                      className="trainer-photo-btn trainer-photo-btn-danger"
                      title="Remove"
                      disabled={photoSaving}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="trainer-profile-meta">
                <h1 className="trainer-profile-name">{data.name}</h1>
                <p className="trainer-profile-role">{data.role || data.specialization || 'Trainer'}</p>
                <div className="trainer-profile-tags">
                  {data.status && <span className={`badge badge-${data.status}`}>{data.status}</span>}
                  {data.specialization && <span className="tag">{data.specialization}</span>}
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div className="trainer-stats-row">
              <div className="trainer-stat">
                <div className="trainer-stat-value">{activePtClients}</div>
                <div className="trainer-stat-label">Active Clients</div>
              </div>
              <div className="trainer-stat">
                <div className="trainer-stat-value">{fmtK(thisMonthRev)}</div>
                <div className="trainer-stat-label">This Month</div>
              </div>
              <div className="trainer-stat">
                <div className="trainer-stat-value">{incentiveRate}%</div>
                <div className="trainer-stat-label">Incentive Rate</div>
              </div>
              <div className="trainer-stat">
                <div className="trainer-stat-value">{assignedClients.length}</div>
                <div className="trainer-stat-label">Total Assigned</div>
              </div>
            </div>
          </div>

          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoFile} style={{ display: 'none' }} />

          {/* KPI ROW */}
          <div className="kpi-grid mb-3">
            <KpiCard color="green" icon={<Users size={20} />} label="Active Clients" value={String(activePtClients)} sub={`${assignedClients.length} total enrolled`} />
            <KpiCard color="red"   icon={<IndianRupee size={20} />} label="Month Revenue"  value={fmtK(thisMonthRev)} sub="This calendar month" />
            <KpiCard color="purple" icon={<TrendingUp size={20} />} label="Month Incentive" value={fmtK(thisMonthRev * incentiveRate / 100)} sub={`@ ${incentiveRate}% rate`} />
            <KpiCard color="blue"  icon={<CheckCircle2 size={20} />} label="Lifetime Revenue" value={fmtK(assignedClients.reduce((s,c) => s+(Number(c.final_amount)||0),0))} sub="All-time enrolled" />
          </div>

          {/* 6-month revenue trend */}
          {monthly.length > 0 && (
            <div className="card mb-3">
              <div className="card-title">Revenue Trend (Last 6 months)</div>
              <div className="chart-bars">
                {monthly.map((m: any, i: number) => (
                  <div key={i} className="chart-bar-col" title={`${m.month}: ${fmt(m.revenue)}`}>
                    <div className="chart-bar-val" style={{ marginTop: 'auto', marginBottom: 4 }}>
                      {m.revenue >= 1000 ? '₹' + (m.revenue / 1000).toFixed(0) + 'K' : '₹' + m.revenue}
                    </div>
                    <div className="chart-bar" style={{ height: `${Math.max((m.revenue / maxRev) * 100, 3)}%`, minHeight: 4 }} />
                    <div style={{
                      position: 'absolute', bottom: 4, fontSize: 10, color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}>{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ASSIGNED CLIENTS MINI-LIST */}
          {assignedClients.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', padding: 0 }}>
              <div className="card-header-row">
                <span className="card-title"><Users size={16}/> Assigned Clients ({assignedClients.length})</span>
                <Link href="/clients" className="link-sm">View all →</Link>
              </div>
              <div className="trainer-client-list">
                {assignedClients.slice(0, 8).map((c: any) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className="trainer-client-row">
                    <div className="trainer-client-avatar">{c.name?.slice(0,2).toUpperCase()}</div>
                    <div className="trainer-client-info">
                      <div className="trainer-client-name">{c.name}</div>
                      <div className="trainer-client-plan">{c.package_type || 'No plan'}</div>
                    </div>
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* PERSONAL + EMPLOYMENT INFO */}
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="card-title">Personal Details</div>
              <InfoRow label={<><Phone size={14} /> Mobile</>} value={t.mobile} />
              <InfoRow label={<><Mail size={14} /> Email</>} value={t.email} />
              <InfoRow label={<><Calendar size={14} /> Date of Birth</>} value={t.dob ? String(t.dob).split('T')[0] : null} />
              <InfoRow label={<><User size={14} /> Gender</>} value={t.gender} />
              <InfoRow label={<>📍 Address</>} value={t.address} />
            </div>

            <div className="card">
              <div className="card-title">Employment</div>
              <InfoRow label={<><Briefcase size={14} /> Role</>} value={t.role} />
              <InfoRow label={<><Calendar size={14} /> Joining Date</>} value={t.joining_date ? String(t.joining_date).split('T')[0] : null} />
              <InfoRow label={<><IndianRupee size={14} /> Salary</>} value={t.salary ? fmt(t.salary) : null} />
              <InfoRow label={<><TrendingUp size={14} /> Incentive Rate</>} value={t.incentive_rate ? Math.round(t.incentive_rate * 100) + '%' : null} />
              <InfoRow label={<>🎯 Specialization</>} value={t.specialization} />
              <InfoRow label={<>🎓 Certifications</>} value={t.certifications} />
              {t.notes && <InfoRow label={<>📋 Notes</>} value={t.notes} />}
            </div>
          </div>

          {/* CLIENTS TABLE */}
          <div className="card mb-3" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Clients ({clients.length})</div>
              <Link href="/clients" className="btn btn-ghost btn-sm">View all clients →</Link>
            </div>
            {clients.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                No clients assigned to this trainer yet
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th><th>Name</th><th>Mobile</th>
                      <th>Package</th><th>Expires</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c: any) => (
                      <tr key={c.id}>
                        <td><span className="mono text-muted text-xs">{c.client_id}</span></td>
                        <td>
                          <Link href={`/clients/${c.id}`} style={{ fontWeight: 600, color: 'var(--brand2)' }}>
                            {c.name}
                          </Link>
                        </td>
                        <td className="text-muted">{c.mobile || '—'}</td>
                        <td>{c.package_type || '—'}</td>
                        <td className="text-muted">{fmtDate(c.pt_end_date)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{fmt(c.paid_amount)}</td>
                        <td style={{ textAlign: 'right', color: c.balance_amount > 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: c.balance_amount > 0 ? 700 : 400 }}>
                          {c.balance_amount > 0 ? fmt(c.balance_amount) : '✓'}
                        </td>
                        <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RECENT PAYMENTS */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Recent Payments Collected</div>
              <div className="text-muted text-sm">{payments.length} record{payments.length !== 1 ? 's' : ''}</div>
            </div>
            {payments.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                No payments recorded yet
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Receipt</th><th>Client</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Method</th><th>Date</th>
                      <th style={{ textAlign: 'right' }}>Incentive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => (
                      <tr key={p.id}>
                        <td><span className="mono text-muted text-xs">{p.receipt_no || '—'}</span></td>
                        <td style={{ fontWeight: 600 }}>{p.client_name || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                        <td><span className={`badge badge-${(p.method || 'cash').toLowerCase()}`}>{p.method}</span></td>
                        <td className="text-muted">{fmtDate(p.date)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--purple)', fontWeight: 600 }}>{fmt(p.incentive_amt)}</td>
                      </tr>
                    ))}
                  
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}

/* ─── Local helper components ───────────────────────────── */

function KpiCard({ color, icon, label, value, sub }: {
  color: string; icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  const gradients: Record<string,string> = {
    green:  'linear-gradient(135deg,#22c55e,#86efac)',
    red:    'linear-gradient(135deg,#ef4444,#fca5a5)',
    purple: 'linear-gradient(135deg,#a855f7,#c084fc)',
    blue:   'linear-gradient(135deg,#3b82f6,#93c5fd)',
    amber:  'linear-gradient(135deg,#f59e0b,#fcd34d)',
  };
  const gradient = gradients[color] || gradients.blue;
  return (
    <div className="kpi-card" style={{ '--kpi-gradient': gradient } as React.CSSProperties}>
      <div className="kpi-card-header">
        <span className="kpi-card-label">{label}</span>
        <div className="kpi-card-icon" style={{ background: gradient }}>{icon}</div>
      </div>
      <div className="kpi-card-value">{value}</div>
      {sub && <div className="kpi-card-footer">{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: React.ReactNode; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border-soft,#e2e8f0)', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-secondary,#64748b)', display: 'flex', alignItems: 'center', gap: 5, minWidth: 140 }}>{label}</span>
      <span style={{ color: 'var(--text-primary,#0f172a)', fontWeight: 500, flex: 1 }}>{value}</span>
    </div>
  );
}

