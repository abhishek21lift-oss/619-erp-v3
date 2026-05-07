'use client';
import { useEffect, useState, useMemo } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

export default function OutstandingDuesPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

const fmt = (n: any) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function Inner() {
  const [dues, setDues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    api.reports
      .dues()
      .then((r) => alive && setDues(Array.isArray(r) ? r : []))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return dues;
    const s = search.toLowerCase();
    return dues.filter(
      (d: any) =>
        (d.name || '').toLowerCase().includes(s) ||
        (d.client_id || '').toLowerCase().includes(s) ||
        (d.mobile || '').includes(search),
    );
  }, [dues, search]);

  const total = filtered.reduce(
    (s: number, d: any) => s + Number(d.balance_amount || 0),
    0,
  );

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="kpi-grid mb-3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div className="kpi-card red">
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--danger)',
                  letterSpacing: '-0.03em',
                }}
                className="tabular"
              >
                {fmt(total)}
              </div>
              <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', marginTop: 4 }}>
                Total Outstanding
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand)', letterSpacing: '-0.03em' }} className="tabular">
                {filtered.length}
              </div>
              <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', marginTop: 4 }}>
                Members With Dues
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Search member, ID or mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 320 }}
              />
            </div>

            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.55 }}>✓</div>
                  No pending dues — every member is up to date.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Member</th>
                      <th>Mobile</th>
                      <th>Coach</th>
                      <th>Balance</th>
                      <th>Expiry</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d: any) => (
                      <tr key={d.id}>
                        <td><span className="id-chip">{d.client_id || '—'}</span></td>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td className="text-muted tabular">{d.mobile || '—'}</td>
                        <td className="text-muted">{d.trainer_name || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--danger)' }} className="tabular">
                          {fmt(d.balance_amount)}
                        </td>
                        <td className="text-muted tabular">{d.pt_end_date || '—'}</td>
                        <td>
                          <span className={`badge badge-${d.status || 'member'}`}>
                            {d.status || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
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
