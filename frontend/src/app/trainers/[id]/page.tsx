'use client';
/**
 * Trainer Profile Page
 * Shows trainer details, their assigned members list, and schedule.
 */
import React, { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft, User, Phone, Mail, Edit2, Trash2, Users,
  MessageCircle, Award, Calendar, Dumbbell, CheckCircle, XCircle,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface TrainerDetail {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  status: 'active' | 'inactive';
  join_date?: string;
  certifications?: string[];
  schedule?: string;
}

interface AssignedMember {
  id: number;
  name: string;
  status: 'active' | 'expired' | 'frozen' | 'pending';
  membership_plan?: string;
  expiry_date?: string;
  phone?: string;
}

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-success', expired: 'badge-danger',
    frozen: 'badge-info', pending: 'badge-warning', inactive: 'badge-secondary',
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
export default function TrainerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [trainer, setTrainer]   = useState<TrainerDetail | null>(null);
  const [members, setMembers]   = useState<AssignedMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'members'>('profile');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const headers = { Authorization: `Bearer ${token}` };
      const [tRes, mRes] = await Promise.allSettled([
        fetch(`/api/trainers/${id}`, { headers }),
        fetch(`/api/trainers/${id}/members`, { headers }),
      ]);
      if (tRes.status === 'fulfilled' && tRes.value.ok) {
        setTrainer(await tRes.value.json());
      } else throw new Error('Trainer not found');
      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        const d = await mRes.value.json();
        setMembers(Array.isArray(d) ? d : (d.members ?? []));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load trainer.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch(`/api/trainers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push('/trainers');
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
      setDeleting(false);
    }
  }

  const whatsappHref = () => {
    if (!trainer?.phone) return '#';
    const n = trainer.phone.replace(/\D/g, '');
    const num = n.startsWith('91') ? n : `91${n}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(`Hi ${trainer.name}, this is a message from 619 Fitness Studio.`)}`;
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  /* ── Loading ── */
  if (loading) {
    return (
      <Guard>
        <AppShell title="Trainer Profile">
          <div className="page-container">
            <div className="skeleton" style={{ height: 180, borderRadius: 12, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 350, borderRadius: 12 }} />
          </div>
        </AppShell>
      </Guard>
    );
  }

  if (error || !trainer) {
    return (
      <Guard>
        <AppShell title="Trainer Profile">
          <div className="page-container">
            <div className="empty-state">
              <User size={36} className="empty-state-icon" />
              <p className="empty-state-title">{error || 'Trainer not found'}</p>
              <button className="btn btn-primary btn-sm" onClick={() => router.back()}>Go back</button>
            </div>
          </div>
        </AppShell>
      </Guard>
    );
  }

  return (
    <Guard>
      <AppShell title="Trainer Profile">
        <div className="page-container animate-fade-in">

          {/* ── Back ── */}
          <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: 16 }}>
            <ArrowLeft size={14} /> Back to Trainers
          </button>

          {/* ── Header card ── */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div style={{
                width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700, color: '#fff',
              }}>
                {trainer.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{trainer.name}</h2>
                  <StatusBadge status={trainer.status} />
                </div>
                {trainer.specialization && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <Dumbbell size={12} /> {trainer.specialization}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {trainer.phone && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} /> {trainer.phone}
                    </span>
                  )}
                  {trainer.email && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} /> {trainer.email}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} /> {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {trainer.phone && (
                  <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                {isAdmin && (
                  <Link href={`/trainers/${id}/edit`} className="btn btn-outline btn-sm">
                    <Edit2 size={13} /> Edit
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="tab-bar" style={{ marginBottom: 16 }}>
            {(['profile', 'members'] as const).map((t) => (
              <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {t === 'members' ? `Members (${members.length})` : 'Profile'}
              </button>
            ))}
          </div>

          {/* ── Profile tab ── */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={14} /> Personal Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <InfoRow label="Full Name" value={trainer.name} />
                  <InfoRow label="Status" value={<StatusBadge status={trainer.status} />} />
                  <InfoRow label="Phone" value={trainer.phone} />
                  <InfoRow label="Email" value={trainer.email} />
                  <InfoRow label="Specialization" value={trainer.specialization} />
                  <InfoRow label="Joined" value={fmtDate(trainer.join_date)} />
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={14} /> Certifications & Schedule
                </h3>
                {trainer.certifications && trainer.certifications.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {trainer.certifications.map((c, i) => (
                      <span key={i} className="badge badge-info" style={{ fontSize: 12 }}>{c}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>No certifications listed.</p>
                )}
                <InfoRow label="Schedule / Timing" value={trainer.schedule} />
              </div>

              {trainer.bio && (
                <div className="card" style={{ padding: 20, gridColumn: '1/-1' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Bio</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{trainer.bio}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Members tab ── */}
          {activeTab === 'members' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Assigned Members ({members.length})
                </h3>
              </div>
              {members.length === 0 ? (
                <div className="empty-state">
                  <Users size={32} className="empty-state-icon" />
                  <p className="empty-state-title">No members assigned</p>
                  <p className="empty-state-desc">Assign members to this trainer from the Members page.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Plan</th>
                        <th>Expiry</th>
                        <th>Phone</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/clients/${m.id}`)}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                          <td><StatusBadge status={m.status} /></td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.membership_plan ?? '—'}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDate(m.expiry_date)}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.phone ?? '—'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <Link href={`/clients/${m.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                              View
                            </Link>
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

        {/* ── Delete Modal ── */}
        {deleteConfirm && (
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(false)}>
            <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3 className="modal-title">Remove Trainer</h3>
                <button className="modal-close" onClick={() => setDeleteConfirm(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)' }}>
                  Remove <strong>{trainer.name}</strong>? Their {members.length} assigned member{members.length !== 1 ? 's' : ''} will become unassigned.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Removing…' : 'Remove trainer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </Guard>
  );
}
