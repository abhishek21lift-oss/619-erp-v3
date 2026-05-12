'use client';
/**
 * Trainers Page — premium SaaS rebuild
 * Lists all trainers with their assigned member count, specializations,
 * contact info, and quick actions.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  Search, UserPlus, MoreHorizontal, Eye, Edit2, Trash2,
  Phone, Mail, Users, Award, MessageCircle, Dumbbell,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface Trainer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  specialization?: string;
  member_count?: number;
  status: 'active' | 'inactive';
  join_date?: string;
  photo_url?: string;
}

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function whatsappHref(phone?: string, name?: string) {
  if (!phone) return '#';
  const n = phone.replace(/\D/g, '');
  const num = n.startsWith('91') ? n : `91${n}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(`Hi ${name ?? 'there'}, this is a message from 619 Fitness Studio.`)}`;
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  );
}

/* ─── Row Action Menu ───────────────────────────────────── */
function RowMenu({ trainer, onDelete }: { trainer: Trainer; onDelete: (t: Trainer) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="dropdown-menu" style={{ right: 0, minWidth: 170 }}>
          <button className="dropdown-item" onClick={() => { setOpen(false); router.push(`/trainers/${trainer.id}`); }}>
            <Eye size={13} /> View profile
          </button>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button className="dropdown-item" onClick={() => { setOpen(false); router.push(`/trainers/${trainer.id}/edit`); }}>
              <Edit2 size={13} /> Edit
            </button>
          )}
          {trainer.phone && (
            <a className="dropdown-item" href={whatsappHref(trainer.phone, trainer.name)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          {user?.role === 'admin' && (
            <>
              <div className="dropdown-divider" />
              <button className="dropdown-item dropdown-item-danger" onClick={() => { setOpen(false); onDelete(trainer); }}>
                <Trash2 size={13} /> Remove trainer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Trainer Card (grid view) ──────────────────────────── */
function TrainerCard({ trainer, onDelete }: { trainer: Trainer; onDelete: (t: Trainer) => void }) {
  const router = useRouter();
  return (
    <div
      className="card animate-fade-in"
      style={{ padding: 20, cursor: 'pointer', transition: 'box-shadow 150ms' }}
      onClick={() => router.push(`/trainers/${trainer.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar name={trainer.name} size={44} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{trainer.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {trainer.specialization ?? 'General Fitness'}
            </div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RowMenu trainer={trainer} onDelete={onDelete} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Users size={12} /> {trainer.member_count ?? 0} members
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span className={`badge ${trainer.status === 'active' ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: 10 }}>
            {trainer.status}
          </span>
        </div>
        {trainer.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', gridColumn: '1/-1' }}>
            <Phone size={12} /> {trainer.phone}
          </div>
        )}
        {trainer.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', gridColumn: '1/-1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Mail size={12} /> {trainer.email}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <Link
          href={`/trainers/${trainer.id}`}
          className="btn btn-outline btn-sm"
          style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          View Profile
        </Link>
        {trainer.phone && (
          <a
            href={whatsappHref(trainer.phone, trainer.name)}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={(e) => e.stopPropagation()}
            title="WhatsApp"
          >
            <MessageCircle size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton Card ─────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 14, width: 140, borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 11, width: 100, borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 11, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 11, width: '70%', borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function TrainersPage() {
  const { user } = useAuth();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Trainer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView]         = useState<'grid' | 'list'>('grid');

  const fetchTrainers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch('/api/trainers', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrainers(Array.isArray(data) ? data : (data.trainers ?? []));
    } catch (e: any) {
      setError(e.message || 'Failed to load trainers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrainers(); }, [fetchTrainers]);

  const filtered = trainers.filter((t) => {
    if (filter === 'active' && t.status !== 'active') return false;
    if (filter === 'inactive' && t.status !== 'inactive') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q) || (t.specialization ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('619_token') ?? '';
      const res = await fetch(`/api/trainers/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTrainers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Guard>
      <AppShell title="Trainers">
        <div className="page-container animate-fade-in">

          {/* ── Header ── */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Trainers</h1>
              <p className="page-subtitle">{trainers.filter((t) => t.status === 'active').length} active trainers</p>
            </div>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <Link href="/trainers/new" className="btn btn-primary btn-sm">
                <UserPlus size={14} /> Add Trainer
              </Link>
            )}
          </div>

          {/* ── Filters ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="input-wrap" style={{ maxWidth: 300 }}>
              <span className="input-icon"><Search size={14} /></span>
              <input
                type="search" className="input"
                placeholder="Search trainers…"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="tab-bar" style={{ marginBottom: 0 }}>
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              {error}
              <button className="btn btn-ghost btn-sm" onClick={fetchTrainers}>Retry</button>
            </div>
          )}

          {/* ── Grid ── */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Dumbbell size={36} className="empty-state-icon" />
              <p className="empty-state-title">No trainers found</p>
              <p className="empty-state-desc">{search ? 'Try a different search.' : 'Add your first trainer to get started.'}</p>
              {!search && (user?.role === 'admin' || user?.role === 'manager') && (
                <Link href="/trainers/new" className="btn btn-primary btn-sm"><UserPlus size={14} /> Add Trainer</Link>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filtered.map((t) => <TrainerCard key={t.id} trainer={t} onDelete={setDeleteTarget} />)}
            </div>
          )}
        </div>

        {/* ── Delete Modal ── */}
        {deleteTarget && (
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
            <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3 className="modal-title">Remove Trainer</h3>
                <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)' }}>
                  Remove <strong>{deleteTarget.name}</strong>? Their {deleteTarget.member_count ?? 0} assigned members will become unassigned.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={deleting}>
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
