'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/format';
import { memberWhatsAppMessage, whatsappHref } from '@/lib/whatsapp';

export default function ClientsPage() {
  return (
    <Guard>
      <ClientsContent />
    </Guard>
  );
}

type Segment = '' | 'active' | 'expired' | 'frozen' | 'dues' | 'expiring' | 'birthdays' | 'lead';

function ClientsContent() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';

  // Only push real status values to the API; synthetic segments are filtered client-side.
  const apiStatus = useMemo<string | undefined>(() => {
    if (segment === 'active' || segment === 'expired' || segment === 'frozen') return segment;
    return undefined;
  }, [segment]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClients(
        await api.clients.list({
          search: search || undefined,
          status: apiStatus,
        }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, apiStatus]);

  useEffect(() => {
    load();
  }, [load]);

  async function del(id: string, name: string) {
    if (!confirm(`Delete member "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api.clients.delete(id);
      setClients((c) => c.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  }

  const fmt = (n: number) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const now = Date.now();
  const visible = useMemo(() => {
    if (segment === 'dues') return clients.filter((c) => Number(c.balance_amount || 0) > 0);
    if (segment === 'expiring')
      return clients.filter((c) => {
        if (!c.pt_end_date || c.status !== 'active') return false;
        const days = Math.ceil(
          (new Date(c.pt_end_date).getTime() - now) / 86400000,
        );
        return days >= 0 && days <= 7;
      });
    if (segment === 'birthdays')
      return clients.filter((c) => {
        if (!c.dob) return false;
        const d = new Date(c.dob);
        const today = new Date();
        return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      });
    if (segment === 'lead') return clients.filter((c) => !c.pt_end_date);
    return clients;
  }, [clients, segment, now]);

  const counts = useMemo(
    () => ({
      all: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      expired: clients.filter((c) => c.status === 'expired').length,
      frozen: clients.filter((c) => c.status === 'frozen').length,
      dues: clients.filter((c) => Number(c.balance_amount || 0) > 0).length,
      expiring: clients.filter((c) => {
        if (!c.pt_end_date || c.status !== 'active') return false;
        const days = Math.ceil(
          (new Date(c.pt_end_date).getTime() - now) / 86400000,
        );
        return days >= 0 && days <= 7;
      }).length,
    }),
    [clients, now],
  );

  const pills: Array<{ label: string; val: Segment; count: number }> = [
    { label: 'All', val: '', count: counts.all },
    { label: 'Active', val: 'active', count: counts.active },
    { label: 'Expiring', val: 'expiring', count: counts.expiring },
    { label: 'Lapsed', val: 'expired', count: counts.expired },
    { label: 'Has Dues', val: 'dues', count: counts.dues },
    { label: 'Frozen', val: 'frozen', count: counts.frozen },
  ];

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div
            style={{
              display: 'flex',
              gap: '.45rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {pills.map((p) => (
              <button
                key={String(p.val)}
                onClick={() => setSegment(p.val)}
                className={`status-pill${segment === p.val ? ' is-active' : ''}`}
              >
                {p.label}
                {p.count > 0 ? ` · ${p.count}` : ''}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '.65rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <input
              className="input"
              style={{ maxWidth: 320 }}
              placeholder="Search name, mobile, ID, email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              {loading ? (
                <div
                  style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  <div className="pulse">Loading roster…</div>
                </div>
              ) : visible.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, marginBottom: 12, opacity: 0.5 }}>◐</div>
                  <div style={{ color: 'var(--muted)' }}>No members match this filter</div>
                  <Link
                    href="/clients/new"
                    className="btn btn-primary"
                    style={{ marginTop: '1rem', display: 'inline-flex' }}
                  >
                    + Add Member
                  </Link>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      {isAdmin && <th>Coach</th>}
                      <th>Plan</th>
                      <th>Ends</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => {
                      const daysLeft = c.pt_end_date
                        ? Math.ceil(
                            (new Date(c.pt_end_date).getTime() - Date.now()) /
                              86400000,
                          )
                        : null;
                      const soonExpiring =
                        daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                      const balance = Number(c.balance_amount || 0);

                      return (
                        <tr key={c.id} style={{ opacity: deleting === c.id ? 0.4 : 1 }}>
                          <td>
                            <span className="id-chip">{c.client_id || '—'}</span>
                          </td>
                          <td>
                            <Link
                              href={`/clients/${c.id}`}
                              style={{
                                fontWeight: 600,
                                color: 'var(--text)',
                                textDecoration: 'none',
                                letterSpacing: '-0.005em',
                              }}
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="text-muted tabular">
                            {c.mobile ? (
                              <a
                                href={whatsappHref(c.mobile, memberWhatsAppMessage(c), c.country_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="wa-inline-link"
                                title="Open WhatsApp"
                              >
                                {c.mobile}
                              </a>
                            ) : '—'}
                          </td>
                          {isAdmin && (
                            <td className="text-muted">{c.trainer_name || '—'}</td>
                          )}
                          <td>{c.package_type || '—'}</td>
                          <td>
                            <span
                              style={{
                                color: soonExpiring
                                  ? 'var(--warning)'
                                  : c.status === 'expired'
                                  ? 'var(--danger)'
                                  : 'var(--muted)',
                              }}
                              className="tabular"
                            >
                              {fmtDate(c.pt_end_date)}
                              {soonExpiring && (
                                <span style={{ marginLeft: 6, fontSize: 11 }}>
                                  · {daysLeft}d
                                </span>
                              )}
                            </span>
                          </td>
                          <td
                            style={{ color: 'var(--success)', fontWeight: 600 }}
                            className="tabular"
                          >
                            {fmt(c.paid_amount ?? 0)}
                          </td>
                          <td
                            style={{
                              color: balance > 0 ? 'var(--danger)' : 'var(--muted)',
                              fontWeight: balance > 0 ? 700 : 400,
                            }}
                            className="tabular"
                          >
                            {balance > 0 ? fmt(balance) : '✓'}
                          </td>
                          <td>
                            <span className={`badge badge-${c.status || 'active'}`}>
                              {c.status || '—'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Link
                                href={`/clients/${c.id}`}
                                className="btn btn-ghost btn-icon btn-sm"
                                title="View"
                              >
                                ◎
                              </Link>
                              <Link
                                href={`/clients/${c.id}?edit=1`}
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Edit"
                              >
                                ✎
                              </Link>
                              {c.mobile && (
                                <a
                                  href={whatsappHref(c.mobile, memberWhatsAppMessage(c), c.country_code)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-whatsapp btn-icon btn-sm"
                                  title="WhatsApp"
                                >
                                  WA
                                </a>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => del(c.id, c.name)}
                                  className="btn btn-danger btn-icon btn-sm"
                                  title="Delete"
                                  disabled={deleting === c.id}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="text-muted text-sm mt-1">
            {visible.length} member{visible.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
