'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

export default function CollectionPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function Inner() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthly, setMonthly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.reports
      .monthly(year)
      .then((r) => alive && setMonthly(Array.isArray(r) ? r : []))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year]);

  const fullYear = useMemo(
    () =>
      MONTHS.map((name, i) => {
        const found = monthly.find((m: any) => parseInt(m.month_num) === i + 1);
        return {
          month: name,
          revenue: found ? Number(found.revenue) : 0,
          count: found ? Number(found.payment_count) : 0,
        };
      }),
    [monthly],
  );

  const total = fullYear.reduce((s, m) => s + m.revenue, 0);
  const avg = total / Math.max(fullYear.filter((m) => m.revenue > 0).length, 1);

  return (
    <AppShell>
      <div className="page-main">

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Payments</th>
                      <th>Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullYear.map((m, i) => (
                      <tr key={i} style={{ opacity: m.revenue === 0 ? 0.45 : 1 }}>
                        <td style={{ fontWeight: 600 }}>{m.month} {year}</td>
                        <td className="text-muted tabular">{m.count || '—'}</td>
                        <td
                          style={{ fontWeight: 700, color: m.revenue > 0 ? 'var(--success)' : 'var(--muted)' }}
                          className="tabular"
                        >
                          {m.revenue > 0 ? fmt(m.revenue) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="tabular">{fullYear.reduce((s, m) => s + m.count, 0)}</td>
                      <td className="tabular" style={{ color: 'var(--brand)' }}>{fmt(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="kpi-card">
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em' }} className="tabular">{value}</div>
      <div
        className="text-muted"
        style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', marginTop: 4 }}
      >
        {label}
      </div>
    </div>
  );
}
