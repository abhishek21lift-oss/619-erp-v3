'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Grid3x3, List, User, Calendar, RefreshCw, MessageCircle, Eye, Search, ChevronDown } from 'lucide-react';
import { SkeletonMemberCard } from '@/components/Skeleton';

type Segment = 'active' | 'expiring' | 'lapsed' | 'birthdays';

const TITLES: Record<Segment, { title: string; sub: string }> = {
  active:    { title: 'Active Members',    sub: 'Currently subscribed athletes' },
  expiring:  { title: 'Expiring Soon',     sub: 'Memberships ending in the next 7 days' },
  lapsed:    { title: 'Lapsed Members',    sub: 'Memberships that have expired' },
  birthdays: { title: "Today's Birthdays", sub: 'Send a quick wish to keep them feeling at home' },
};

export default function MemberSegmentPage({ segment }: { segment: Segment }) {
  return (
    <Guard>
      <Inner segment={segment} />
    </Guard>
  );
}

function nameColor(name: string) {
  const colors = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#3b82f6,#06b6d4)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#ec4899,#a855f7)',
    'linear-gradient(135deg,#14b8a6,#3b82f6)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

function expiryTone(dateStr?: string): 'red' | 'amber' | 'green' | 'muted' {
  if (!dateStr) return 'muted';
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'red';
  if (days <= 3) return 'red';
  if (days <= 14) return 'amber';
  return 'green';
}

function MemberCard({ c }: { c: Client }) {
  const initials = c.name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  const tone = expiryTone(c.pt_end_date);
  const toneColors = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e', muted: '#94a3b8' };
  
  return (
    <div className="member-card lift">
      {/* Status badge */}
      <span className={`member-card-status badge badge-${c.status || 'member'}`}>{c.status || 'member'}</span>
      
      {/* Avatar */}
      <div className="member-card-avatar-wrap">
        {c.photo_url ? (
          <img src={c.photo_url} alt={c.name} className="member-card-photo" />
        ) : (
          <div className="member-card-avatar" style={{ background: nameColor(c.name) }}>
            {initials}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="member-card-name">{c.name}</div>
      <div className="member-card-id">{c.member_code || c.client_id || '—'}</div>
      
      <div className="member-card-meta">
        <div className="member-card-meta-row">
          <User size={12} className="member-card-meta-icon" />
          <span>{c.trainer_name || 'No trainer'}</span>
        </div>
        <div className="member-card-meta-row">
          <Calendar size={12} className="member-card-meta-icon" />
          <span style={{ color: toneColors[tone] }}>
            {c.pt_end_date ? fmtDate(c.pt_end_date) : 'No expiry'}
          </span>
        </div>
        {c.package_type && (
          <div className="member-card-plan">{c.package_type}</div>
        )}
      </div>
      
      {/* Hover actions */}
      <div className="member-card-actions">
        <Link href={`/clients/${c.id}`} className="member-card-action">
          <Eye size={14} /> View
        </Link>
        <Link href={`/clients/${c.id}/renew-subscription`} className="member-card-action">
          <RefreshCw size={14} /> Renew
        </Link>
        {c.mobile && (
          <a href={`https://wa.me/91${c.mobile}`} target="_blank" rel="noreferrer" className="member-card-action member-card-action-wa">
            <MessageCircle size={14} /> Chat
          </a>
        )}
      </div>
    </div>
  );
}

function Inner({ segment }: { segment: Segment }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const status =
      segment === 'active' ? 'active' :
      segment === 'lapsed' ? 'expired' :
      undefined;
    api.clients
      .list(status ? { status } : {})
      .then((rows) => alive && setClients(rows))
      .catch((e) => alive && setError(e.message || 'Failed to load members'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [segment]);

  const now = Date.now();
  const visible = useMemo(() => {
    let pool: Client[];
    if (segment === 'expiring') {
      pool = clients.filter((c) => {
        if (!c.pt_end_date || c.status !== 'active') return false;
        const days = Math.ceil(
          (new Date(c.pt_end_date).getTime() - now) / 86400000,
        );
        return days >= 0 && days <= 7;
      });
    } else if (segment === 'birthdays') {
      const today = new Date();
      pool = clients.filter((c) => {
        if (!c.dob) return false;
        const d = new Date(c.dob);
        return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      });
    } else {
      pool = clients;
    }
    if (!search) return pool;
    const s = search.toLowerCase();
    return pool.filter(
      (c) =>
        c.name?.toLowerCase().includes(s) ||
        (c.mobile || '').includes(s) ||
        (c.client_id || '').toLowerCase().includes(s),
    );
  }, [clients, segment, now, search]);

  const meta = TITLES[segment];

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="card" style={{ padding: 0 }}>
            <div
              style={{
                padding: '0.85rem 1.4rem',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 280 }}>
                <Search size={18} className="text-muted" />
                <input
                  className="input"
                  placeholder="Search name, ID or mobile"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <div className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>
                  {visible.length} {visible.length === 1 ? 'member' : 'members'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                  title="Grid view"
                >
                  <Grid3x3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                  title="Table view"
                >
                  <List size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1.4rem' }}>
              {loading ? (
                viewMode === 'grid' ? (
                  <div className="member-cards-grid">
                    {[...Array(6)].map((_, i) => (
                      <SkeletonMemberCard key={i} />
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                    Loading…
                  </div>
                )
              ) : visible.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No members in this list right now.
                </div>
              ) : viewMode === 'grid' ? (
                <div className="member-cards-grid">
                  {visible.map((c) => (
                    <MemberCard key={c.id} c={c} />
                  ))}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Member</th>
                        <th>Mobile</th>
                        <th>Coach</th>
                        <th>Plan</th>
                        <th>Expiry</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.id}>
                          <td><span className="id-chip">{c.member_code || c.client_id || '—'}</span></td>
                          <td style={{ fontWeight: 600 }}>
                            <Link href={`/clients/${c.id}`}>{c.name}</Link>
                          </td>
                          <td className="text-muted tabular">{c.mobile || '—'}</td>
                          <td className="text-muted">{c.trainer_name || '—'}</td>
                          <td className="text-muted">{c.package_type || '—'}</td>
                          <td className="text-muted tabular">{fmtDate(c.pt_end_date)}</td>
                          <td>
                            <span className={`badge badge-${c.status || 'member'}`}>
                              {c.status || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
