'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';
import { fmtDate } from '@/lib/format';

export default function RenewalAnalysisPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

function Inner() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.clients
      .list({})
      .then((r) => alive && setClients(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = clients.filter((c) => c.status === 'active').length;
    const expired = clients.filter((c) => c.status === 'expired').length;
    const expiring7 = clients.filter((c) => {
      if (!c.pt_end_date || c.status !== 'active') return false;
      const days = Math.ceil((new Date(c.pt_end_date).getTime() - now) / 86400000);
      return days >= 0 && days <= 7;
    }).length;
    const expiring30 = clients.filter((c) => {
      if (!c.pt_end_date || c.status !== 'active') return false;
      const days = Math.ceil((new Date(c.pt_end_date).getTime() - now) / 86400000);
      return days >= 0 && days <= 30;
    }).length;
    const renewalRate =
      active + expired > 0 ? Math.round((active / (active + expired)) * 100) : 0;
    return { active, expired, expiring7, expiring30, renewalRate };
  }, [clients]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return clients
      .filter((c) => {
        if (!c.pt_end_date || c.status !== 'active') return false;
        const days = Math.ceil((new Date(c.pt_end_date).getTime() - now) / 86400000);
        return days >= 0 && days <= 30;
      })
      .sort(
        (a, b) =>
          new Date(a.pt_end_date!).getTime() - new Date(b.pt_end_date!).getTime(),
      );
  }, [clients]);

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="kpi-grid mb-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <Stat label="Active" value={stats.active} color="var(--success)" />
            <Stat label="Lapsed" value={stats.expired} color="var(--danger)" />
            <Stat label="Expiring · 7 d" value={stats.expiring7} color="var(--warning)" />
            <Stat label="Renewal Rate" value={`${stats.renewalRate}%`} color="var(--info)" />
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid var(--line)' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Members up for renewal in the next 30 days
              </div>
            </div>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
              ) : upcoming.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No active memberships expiring in the next 30 days.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Plan</th>
                      <th>Coach</th>
                      <th>Expires</th>
                      <th>Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((c) => {
                      const days = Math.ceil(
                        (new Date(c.pt_end_date!).getTime() - Date.now()) / 86400000,
                      );
                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td className="text-muted">{c.package_type || '—'}</td>
                          <td className="text-muted">{c.trainer_name || '—'}</td>
                          <td className="text-muted tabular">{fmtDate(c.pt_end_date)}</td>
                          <td
                            className="tabular"
                            style={{
                              fontWeight: 700,
                              color:
                                days <= 7
                                  ? 'var(--danger)'
                                  : days <= 14
                                  ? 'var(--warning)'
                                  : 'var(--success)',
                            }}
                          >
                            {days}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="kpi-card">
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em' }} className="tabular">
        {value}
      </div>
      <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
