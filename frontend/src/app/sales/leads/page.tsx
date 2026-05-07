'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';
import { fmtDate } from '@/lib/format';

export default function LeadInboxPage() {
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.clients
      .list({})
      .then((r) => alive && setClients(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  /** Definition of a "lead": no membership end-date yet, or status === 'lead'. */
  const leads = useMemo(() => {
    const pool = clients.filter(
      (c) =>
        c.status === 'lead' ||
        !c.pt_end_date ||
        Number(c.final_amount || 0) === 0,
    );
    if (!search) return pool;
    const s = search.toLowerCase();
    return pool.filter(
      (c) =>
        c.name?.toLowerCase().includes(s) ||
        (c.mobile || '').includes(s) ||
        (c.interested_in || '').toLowerCase().includes(s),
    );
  }, [clients, search]);

  const summary = {
    total: leads.length,
    today: leads.filter(
      (c) =>
        c.joining_date &&
        new Date(c.joining_date).toDateString() === new Date().toDateString(),
    ).length,
    week: leads.filter((c) => {
      if (!c.joining_date) return false;
      const days = Math.floor(
        (Date.now() - new Date(c.joining_date).getTime()) / 86400000,
      );
      return days <= 7;
    }).length,
  };

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div
            className="kpi-grid mb-3"
            style={{ gridTemplateColumns: 'repeat(3,1fr)' }}
          >
            <Stat label="Open Leads" value={summary.total} tone="red" />
            <Stat label="Today" value={summary.today} tone="blue" />
            <Stat label="Last 7 Days" value={summary.week} tone="purple" />
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div
              style={{
                padding: '0.85rem 1.4rem',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <input
                className="input"
                placeholder="Search lead by name, mobile or interest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 320 }}
              />
              <div className="text-muted text-sm">{leads.length} leads</div>
            </div>

            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Loading…
                </div>
              ) : leads.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Inbox zero — every lead has been actioned.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Interested In</th>
                      <th>Source</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td className="text-muted tabular">{c.mobile || '—'}</td>
                        <td className="text-muted">{c.interested_in || '—'}</td>
                        <td className="text-muted">{c.reference_no || 'Walk-in'}</td>
                        <td className="text-muted tabular">{c.joining_date ? fmtDate(c.joining_date) : '—'}</td>
                        <td>
                          <Link
                            href={`/clients/${c.id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            Open →
                          </Link>
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'red' | 'blue' | 'purple';
}) {
  return (
    <div className={`kpi-card ${tone}`}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color:
            tone === 'red'
              ? 'var(--brand)'
              : tone === 'blue'
              ? 'var(--info)'
              : 'var(--purple)',
          letterSpacing: '-0.03em',
        }}
        className="tabular"
      >
        {value}
      </div>
      <div
        className="text-muted"
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
