'use client';
/**
 * MemberSegmentPage — shared component for all member sub-pages.
 * Segments: active | expiring | lapsed | birthdays
 * Rebuilt to use new design system tokens and API layer.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import {
  Search, RefreshCw, MessageCircle, Eye, Users,
  Grid3x3, List, Cake, Clock, UserX, CheckCircle,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status: 'active' | 'expired' | 'frozen' | 'pending';
  membership_plan?: string;
  package_type?: string;
  expiry_date?: string;
  pt_end_date?: string;
  dob?: string;
  trainer_name?: string;
  member_code?: string;
  client_id?: string;
  photo_url?: string;
}

type Segment = 'active' | 'expiring' | 'lapsed' | 'birthdays';

/* ─── Config ─────────────────────────────────────────────── */
const SEGMENT_META: Record<Segment, { title: string; subtitle: string; icon: React.ReactNode; emptyTitle: string; emptyDesc: string }> = {
  active:    { title: 'Active Members',    subtitle: 'Currently subscribed athletes',            icon: <CheckCircle size={16} />, emptyTitle: 'No active members',    emptyDesc: 'Add members and assign active subscriptions to see them here.' },
  expiring:  { title: 'Expiring Soon',     subtitle: 'Memberships ending in the next 30 days',  icon: <Clock size={16} />,        emptyTitle: 'No expiring members', emptyDesc: 'No memberships are expiring in the next 30 days.' },
  lapsed:    { title: 'Lapsed Members',    subtitle: 'Memberships that have expired',            icon: <UserX size={16} />,        emptyTitle: 'No lapsed members',   emptyDesc: 'All members are currently active.' },
  birthdays: { title: "Birthday Members",  subtitle: "Members with birthdays this month",        icon: <Cake size={16} />,         emptyTitle: 'No birthdays',        emptyDesc: 'No member birthdays found for this month.' },
};

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(d?: string): number {
  if (!d) return 9999;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function expiryColor(days: number): string {
  if (days < 0)  return 'var(--danger)';
  if (days <= 7) return 'var(--danger)';
  if (days <= 30) return 'var(--warning)';
  return 'var(--success)';
}

function nameGradient(name: string): string {
  const palettes = [
    'linear-gradient(135deg,#dc2626,#b91c1c)',
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#0ea5e9,#2563eb)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#d97706)',
    'linear-gradient(135deg,#ec4899,#a855f7)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return palettes[Math.abs(h) % palettes.length];
}

function whatsappHref(phone?: string, name?: string) {
  const p = (phone ?? '').replace(/\D/g, '');
  if (!p) return '#';
  const num = p.startsWith('91') ? p : `91${p}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(`Hi ${name ?? 'there'}, this is a message from 619 Fitness Studio.`)}`;
}

function getExpiry(c: Client) {
  return c.expiry_date ?? c.pt_end_date;
}

function getPhone(c: Client) {
  return c.phone ?? c.mobile;
}

function getPlan(c: Client) {
  return c.membership_plan ?? c.package_type;
}

/* ─── Member Card (grid) ────────────────────────────────── */
function MemberCard({ c }: { c: Client }) {
  const router = useRouter();
  const initials = c.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const expiry = getExpiry(c);
  const days   = daysUntil(expiry);
  const phone  = getPhone(c);

  return (
    <div
      className="card animate-fade-in"
      style={{ padding: 18, cursor: 'pointer', position: 'relative', transition: 'box-shadow 150ms' }}
      onClick={() => router.push(`/clients/${c.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
    >
      {/* Status dot */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        width: 8, height: 8, borderRadius: '50%',
        background: c.status === 'active' ? 'var(--success)' : c.status === 'frozen' ? 'var(--info)' : 'var(--danger)',
      }} title={c.status} />

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
        {c.photo_url ? (
          <img
            src={c.photo_url} alt={c.name}
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: '50%', marginBottom: 8,
            background: nameGradient(c.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
        )}
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, textAlign: 'center' }}>{c.name}</div>
        {(c.member_code ?? c.client_id) && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.member_code ?? c.client_id}</div>
        )}
      </div>

      {/* Meta */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {getPlan(c) && (
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
            {getPlan(c)}
          </div>
        )}
        {expiry && (
          <div style={{ textAlign: 'center', color: expiryColor(days), fontWeight: days <= 7 ? 600 : 400 }}>
            {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today!' : `${fmtDate(expiry)} (${days}d)`}
          </div>
        )}
        {c.trainer_name && (
          <div style={{ textAlign: 'center', opacity: 0.7 }}>{c.trainer_name}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
        <Link href={`/clients/${c.id}`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>
          <Eye size={11} /> View
        </Link>
        <Link href={`/clients/${c.id}/renew`} className="btn btn-ghost btn-sm btn-icon" title="Renew">
          <RefreshCw size={12} />
        </Link>
        {phone && (
          <a href={whatsappHref(phone, c.name)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm btn-icon" title="WhatsApp" onClick={(e) => e.stopPropagation()}>
            <MessageCircle size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton Card ─────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }} />
        <div className="skeleton" style={{ height: 13, width: 120, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 10, width: 80, borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ height: 10, borderRadius: 4, marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 10, width: '70%', borderRadius: 4 }} />
    </div>
  );
}

/* ─── Skeleton Row ──────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[140, 90, 80, 90, 70].map((w, i) => (
        <td key={i}><div className="skeleton" style={{ height: 13, width: w, borderRadius: 4 }} /></td>
      ))}
      <td />
    </tr>
  );
}

/* ─── Status Badge ──────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = { active: 'badge-success', expired: 'badge-danger', frozen: 'badge-info', pending: 'badge-warning' };
  return <span className={`badge ${m[status] ?? 'badge-secondary'}`}>{status}</span>;
}

/* ─── Inner component ───────────────────────────────────── */
function Inner({ segment }: { segment: Segment }) {
  const router = useRouter();
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const meta = SEGMENT_META[segment];

  const fetchClients = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('619_token') ?? '';
      // Fetch all clients; filter client-side for segment precision
      const res = await fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : (data.clients ?? []));
    } catch (e: any) {
      setError(e.message || 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  /* ── Segment filter ── */
  const visible = useMemo(() => {
    let pool: Client[];
    switch (segment) {
      case 'active':
        pool = clients.filter((c) => c.status === 'active');
        break;
      case 'lapsed':
        pool = clients.filter((c) => c.status === 'expired');
        break;
      case 'expiring':
        pool = clients.filter((c) => c.status === 'active' && daysUntil(getExpiry(c)) <= 30);
        break;
      case 'birthdays': {
        const now = new Date();
        pool = clients.filter((c) => {
          if (!c.dob) return false;
          const d = new Date(c.dob);
          return d.getMonth() === now.getMonth();
        });
        break;
      }
      default:
        pool = clients;
    }

    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (getPhone(c) ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.member_code ?? c.client_id ?? '').toLowerCase().includes(q)
    );
  }, [clients, segment, search]);

  return (
    <AppShell title={meta.title}>
      <div className="page-container animate-fade-in">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {meta.icon} {meta.title}
            </h1>
            <p className="page-subtitle">{meta.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={fetchClients} title="Refresh" disabled={loading}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <Grid3x3 size={14} />
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-danger animate-slide-up" style={{ marginBottom: 16 }}>
            {error}
            <button className="btn btn-ghost btn-sm" onClick={fetchClients}>Retry</button>
          </div>
        )}

        {/* ── Search bar ── */}
        <div style={{ marginBottom: 16, maxWidth: 380 }}>
          <div className="input-wrap">
            <span className="input-icon"><Search size={14} /></span>
            <input
              type="search" className="input"
              placeholder="Search name, phone, email…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Count badge ── */}
        {!loading && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {visible.length} member{visible.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </div>
        )}

        {/* ── GRID view ── */}
        {viewMode === 'grid' && (
          loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <Users size={36} className="empty-state-icon" />
              <p className="empty-state-title">{meta.emptyTitle}</p>
              <p className="empty-state-desc">{search ? 'Try a different search term.' : meta.emptyDesc}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {visible.map((c) => <MemberCard key={c.id} c={c} />)}
            </div>
          )
        )}

        {/* ── LIST view ── */}
        {viewMode === 'list' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Expiry</th>
                    <th>Trainer</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <Users size={32} className="empty-state-icon" />
                          <p className="empty-state-title">{meta.emptyTitle}</p>
                          <p className="empty-state-desc">{search ? 'Try a different search.' : meta.emptyDesc}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visible.map((c) => {
                      const expiry = getExpiry(c);
                      const days   = daysUntil(expiry);
                      const phone  = getPhone(c);
                      return (
                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/clients/${c.id}`)}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                            {phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{phone}</div>}
                          </td>
                          <td><StatusBadge status={c.status} /></td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{getPlan(c) ?? '—'}</td>
                          <td style={{ fontSize: 13, color: expiry ? expiryColor(days) : 'var(--text-muted)', fontWeight: days <= 7 ? 600 : 400 }}>
                            {expiry ? fmtDate(expiry) : '—'}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.trainer_name ?? '—'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Link href={`/clients/${c.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                                View
                              </Link>
                              {phone && (
                                <a href={whatsappHref(phone, c.name)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm btn-icon" title="WhatsApp">
                                  <MessageCircle size={12} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ─── Export ─────────────────────────────────────────────── */
export default function MemberSegmentPage({ segment }: { segment: Segment }) {
  return (
    <Guard>
      <Inner segment={segment} />
    </Guard>
  );
}
