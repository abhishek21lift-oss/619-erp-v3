'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function RevenueForecastPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

function Inner() {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const [monthly, setMonthly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.reports
      .monthly(year)
      .then((r) => alive && setMonthly(Array.isArray(r) ? r : []))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year]);

  const series = useMemo(() => {
    const arr = MONTHS.map((name, i) => {
      const found = monthly.find((m: any) => parseInt(m.month_num) === i + 1);
      return {
        month: name,
        revenue: found ? Number(found.revenue) : 0,
        actual: i <= currentMonth,
      };
    });
    const realised = arr.filter((m, i) => i <= currentMonth);
    const avg =
      realised.reduce((s, m) => s + m.revenue, 0) / Math.max(realised.length, 1);
    // Simple forecast: future months = trailing average × 1.05
    return arr.map((m, i) => ({
      ...m,
      forecast: i > currentMonth ? Math.round(avg * 1.05) : null,
    }));
  }, [monthly, currentMonth]);

  const realisedTotal = series.reduce((s, m) => s + m.revenue, 0);
  const forecastRest = series.reduce(
    (s, m) => s + (m.forecast || 0),
    0,
  );
  const projectedYearTotal = realisedTotal + forecastRest;

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
                      <th>Type</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((m, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{m.month} {year}</td>
                        <td>
                          {m.actual ? (
                            <span className="badge badge-active">Actual</span>
                          ) : (
                            <span className="badge badge-trainer">Forecast</span>
                          )}
                        </td>
                        <td className="tabular" style={{ fontWeight: 700, color: m.actual ? 'var(--success)' : 'var(--info)' }}>
                          {m.actual ? fmt(m.revenue) : fmt(m.forecast)}
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
