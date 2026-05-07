'use client';
import { useEffect, useState, useMemo } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

export default function TrainerRevenuePage() {
  return (
    <Guard role="admin">
      <Inner />
    </Guard>
  );
}

const fmt = (n: number) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const PKG_MONTHS: Record<string, number> = {
  'Monthly': 1, 'Quarterly': 3, 'Half Yearly': 6, 'Yearly': 12,
  'PT': 3, '3 months': 3, '6 months': 6, '12 months': 12,
};

function getPkgMonths(pkg: string): number {
  return PKG_MONTHS[pkg] ?? PKG_MONTHS[pkg?.toLowerCase?.()] ?? 1;
}

/** Returns true if date falls within the given month/year */
function inMonth(dateStr: string | undefined, year: number, month: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

interface TrainerData {
  id: string;
  name: string;
  photo_url?: string;
  clients_count: number;
  monthly_pt_revenue: number;
  incentive_rate: number;
  incentive_amount: number;
  revenue_percentage: number;
}

function Inner() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<any | null>(null);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
  const prevYear = curMonth === 1 ? curYear - 1 : curYear;

  const monthLabel = (y: number, m: number) =>
    new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.trainers.list().catch(() => []),
      api.clients.list({ limit: 2000 }).catch(() => []),
    ])
      .then(([td, cd]) => {
        if (!alive) return;
        const trainerList = Array.isArray(td) ? td : [];
        const clientList = Array.isArray(cd) ? cd : (cd as any)?.clients ?? (cd as any)?.data ?? [];
        setTrainers(trainerList);
        setClients(clientList);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const trainerRevenueData = useMemo((): TrainerData[] => {
    const ptClients = clients.filter((c: any) =>
      c.trainer_id && c.pt_end_date && c.status === 'active'
    );

    const byTrainer = new Map<string, any[]>();
    ptClients.forEach((c: any) => {
      const tid = c.trainer_id;
      if (!byTrainer.has(tid)) byTrainer.set(tid, []);
      byTrainer.get(tid)!.push(c);
    });

    const metrics: TrainerData[] = trainers.map((t: any) => {
      const tc = byTrainer.get(t.id) || [];
      let monthlyRevenue = 0;
      tc.forEach((c: any) => {
        const months = getPkgMonths(c.package_type);
        monthlyRevenue += (Number(c.final_amount) || 0) / months;
      });
      return {
        id: t.id, name: t.name, photo_url: t.photo_url,
        clients_count: tc.length,
        monthly_pt_revenue: monthlyRevenue,
        incentive_rate: monthlyRevenue >= 50000 ? 50 : 40,
        incentive_amount: monthlyRevenue >= 50000 ? monthlyRevenue * 0.5 : monthlyRevenue * 0.4,
        revenue_percentage: 0,
      };
    });

    const total = metrics.reduce((s, t) => s + t.monthly_pt_revenue, 0);
    return metrics.map((t) => ({
      ...t,
      revenue_percentage: total > 0 ? (t.monthly_pt_revenue / total) * 100 : 0,
    }));
  }, [trainers, clients]);

  const summaryKpis = useMemo(() => ({
    totalTrainers: trainers.length,
    totalClients: trainerRevenueData.reduce((s, t) => s + t.clients_count, 0),
    totalMonthlyRevenue: trainerRevenueData.reduce((s, t) => s + t.monthly_pt_revenue, 0),
    totalIncentives: trainerRevenueData.reduce((s, t) => s + t.incentive_amount, 0),
  }), [trainerRevenueData, trainers]);

  const sortedTrainers = useMemo(
    () => [...trainerRevenueData].sort((a, b) => b.monthly_pt_revenue - a.monthly_pt_revenue),
    [trainerRevenueData]
  );

  /** Clients for the detail panel */
  const detailClients = useMemo(() => {
    if (!selectedTrainer) return { cur: [], prev: [] };
    const tc = clients.filter((c: any) => c.trainer_id === selectedTrainer.id);
    const cur = tc.filter((c: any) =>
      inMonth(c.pt_start_date, curYear, curMonth) ||
      inMonth(c.joining_date, curYear, curMonth) ||
      (c.pt_end_date && new Date(c.pt_end_date) >= new Date(curYear, curMonth - 1, 1))
    );
    const prev = tc.filter((c: any) =>
      inMonth(c.pt_start_date, prevYear, prevMonth) ||
      inMonth(c.joining_date, prevYear, prevMonth)
    );
    return { cur, prev };
  }, [selectedTrainer, clients, curYear, curMonth, prevYear, prevMonth]);

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          {/* KPI Cards */}
          <div className="kpi-grid mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {[
              { label: 'Total Trainers',       val: summaryKpis.totalTrainers,        color: 'var(--brand)' },
              { label: 'Active PT Clients',    val: summaryKpis.totalClients,         color: 'var(--brand)' },
              { label: 'Monthly PT Revenue',   val: fmt(summaryKpis.totalMonthlyRevenue), color: 'var(--success)' },
              { label: 'Total Incentives',     val: fmt(summaryKpis.totalIncentives), color: 'var(--success)' },
            ].map((k) => (
              <div className="kpi-card" key={k.label}>
                <div style={{ fontSize: 28, fontWeight: 800, color: k.color, letterSpacing: '-0.03em' }} className="tabular">{k.val}</div>
                <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Main table + detail panel side by side */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

            {/* Trainer table */}
            <div className="card" style={{ padding: 0, flex: selectedTrainer ? '0 0 55%' : '1' }}>
              <div style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>Trainer PT Revenue Breakdown</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="table-wrap">
                {loading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
                ) : sortedTrainers.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>No PT clients assigned yet.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Trainer</th>
                        <th>PT Clients</th>
                        <th>Monthly Revenue</th>
                        <th>Incentive %</th>
                        <th>Incentive Amount</th>
                        <th>Revenue Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTrainers.map((trainer) => (
                        <tr
                          key={trainer.id}
                          onClick={() => setSelectedTrainer(selectedTrainer?.id === trainer.id ? null : trainer)}
                          style={{ cursor: 'pointer', background: selectedTrainer?.id === trainer.id ? 'var(--bg-3, #f9f9fb)' : '' }}
                        >
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                {trainer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <span style={{ color: 'var(--brand)', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{trainer.name}</span>
                            </div>
                          </td>
                          <td className="text-muted tabular">{trainer.clients_count}</td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }} className="tabular">{fmt(trainer.monthly_pt_revenue)}</td>
                          <td className="tabular">
                            <span className={`badge ${trainer.incentive_rate >= 50 ? 'badge-success' : 'badge-warning'}`}>{trainer.incentive_rate}%</span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }} className="tabular">{fmt(trainer.incentive_amount)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(trainer.revenue_percentage, 100)}%`, height: '100%', background: 'var(--brand)', transition: 'width .3s ease' }} />
                              </div>
                              <span className="text-muted tabular" style={{ fontSize: 12, minWidth: 30 }}>{trainer.revenue_percentage.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ padding: '0.85rem 1.4rem', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)' }}>
                💡 Click any trainer row to see their monthly client breakdown.
              </div>
            </div>

            {/* Detail panel */}
            {selectedTrainer && (
              <div className="card" style={{ flex: '1', padding: 0, minWidth: 0, animation: 'fadeSlideIn .2s ease' }}>
                {/* Panel header */}
                <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {selectedTrainer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{selectedTrainer.name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>PT Client Breakdown</div>
                  </div>
                  <button onClick={() => setSelectedTrainer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)', lineHeight: 1 }}>&#215;</button>
                </div>

                {/* Current month */}
                <ClientMonthSection
                  label={`📅 ${monthLabel(curYear, curMonth)} (Current)`}
                  clients={detailClients.cur}
                  accent="var(--success)"
                />

                {/* Previous month */}
                <ClientMonthSection
                  label={`🗓 ${monthLabel(prevYear, prevMonth)} (Previous)`}
                  clients={detailClients.prev}
                  accent="var(--brand)"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .badge-warning { background: #fef9c3; color: #a16207; font-size: .7rem; padding: .2rem .5rem; border-radius: 20px; font-weight: 700; }
      `}</style>
    </AppShell>
  );
}

function ClientMonthSection({ label, clients, accent }: { label: string; clients: any[]; accent: string }) {
  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const total = clients.reduce((s, c) => s + (Number(c.final_amount) || 0), 0);

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <div style={{ padding: '.65rem 1.2rem .5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '.8rem', color: accent }}>{label}</div>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: accent }}>{clients.length} clients &bull; {fmt(total)}</div>
      </div>
      {clients.length === 0 ? (
        <div style={{ padding: '.6rem 1.2rem 1rem', fontSize: '.78rem', color: 'var(--muted)' }}>No clients this month.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '.78rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2, #f8f9fa)' }}>
                <th style={{ padding: '.4rem 1.2rem', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '.68rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>Member</th>
                <th style={{ padding: '.4rem .75rem', textAlign: 'right', fontWeight: 600, color: 'var(--muted)', fontSize: '.68rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>Package</th>
                <th style={{ padding: '.4rem .75rem', textAlign: 'right', fontWeight: 600, color: 'var(--muted)', fontSize: '.68rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '.5rem 1.2rem', fontWeight: 600 }}>{c.name || c.client_name || 'Unknown'}</td>
                  <td style={{ padding: '.5rem .75rem', textAlign: 'right', color: 'var(--muted)' }}>{c.package_type || '—'}</td>
                  <td style={{ padding: '.5rem .75rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt(Number(c.final_amount) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
