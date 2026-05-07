'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';

export default function LeadSourcesPage() {
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

  const breakdown = useMemo(() => {
    const counts = new Map<string, { total: number; converted: number }>();
    for (const c of clients) {
      const src = (c.reference_no || 'Walk-in').trim() || 'Walk-in';
      const row = counts.get(src) || { total: 0, converted: 0 };
      row.total++;
      if (c.pt_end_date && Number(c.final_amount || 0) > 0) row.converted++;
      counts.set(src, row);
    }
    return Array.from(counts.entries())
      .map(([source, v]) => ({
        source,
        total: v.total,
        converted: v.converted,
        rate: v.total > 0 ? Math.round((v.converted / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [clients]);

  const totalLeads = breakdown.reduce((s, r) => s + r.total, 0);
  const totalConverted = breakdown.reduce((s, r) => s + r.converted, 0);

  return (
    <AppShell>
      <div className="page-main">

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Loading…
                </div>
              ) : breakdown.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No leads recorded yet.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Leads</th>
                      <th>Converted</th>
                      <th>Conversion %</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((r) => (
                      <tr key={r.source}>
                        <td style={{ fontWeight: 600 }}>{r.source}</td>
                        <td className="tabular">{r.total}</td>
                        <td className="tabular" style={{ color: 'var(--success)' }}>
                          {r.converted}
                        </td>
                        <td
                          className="tabular"
                          style={{
                            fontWeight: 700,
                            color:
                              r.rate >= 40
                                ? 'var(--success)'
                                : r.rate >= 20
                                ? 'var(--warning)'
                                : 'var(--danger)',
                          }}
                        >
                          {r.rate}%
                        </td>
                        <td style={{ width: '32%' }}>
                          <div className="progress">
                            <div
                              className="progress-fill red"
                              style={{
                                width: `${(r.total / Math.max(totalLeads, 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="kpi-card">
      <div
        style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em' }}
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
