'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ReportsPage() {
  return (
    <Guard>
      <ReportsContent />
    </Guard>
  );
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

type Tab = 'monthly' | 'trainers' | 'dues' | 'staff';

function ReportsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const sp = useSearchParams();

  // Map URL ?view=... to tabs (so deep-links from the dashboard work)
  const initialTab = useMemo<Tab>(() => {
    const v = (sp.get('view') || '').toLowerCase();
    if (v === 'staff') return 'staff';
    if (v === 'dues') return 'dues';
    if (v === 'trainers' || v === 'coaches') return 'trainers';
    if (v === 'collection' || v === 'monthly' || v === 'revenue') return 'monthly';
    return 'monthly';
  }, [sp]);

  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [monthly, setMonthly] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [dues, setDues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.reports.monthly(year),
      api.reports.dues(),
      isAdmin ? api.reports.trainerSummary() : Promise.resolve([] as any[]),
    ])
      .then(([m, d, t]) => {
        setMonthly(m);
        setDues(d);
        setTrainers(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, isAdmin]);

  const fmt = (n: any) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const totalRevenue = monthly.reduce((s, m) => s + Number(m.revenue), 0);
  const maxRevenue = Math.max(...monthly.map((m) => Number(m.revenue)), 1);

  const fullYear = MONTHS.map((name, i) => {
    const found = monthly.find((m) => parseInt(m.month_num) === i + 1);
    return {
      month: name,
      revenue: found ? Number(found.revenue) : 0,
      count: found ? Number(found.payment_count) : 0,
    };
  });

  return (
    <AppShell>
      <div className="page-main">

        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div
            style={{
              display: 'flex',
              gap: '.4rem',
              marginBottom: '1.25rem',
              borderBottom: '1px solid var(--line)',
              paddingBottom: '.65rem',
              flexWrap: 'wrap',
            }}
          >
            {(
              [
                ['monthly', 'Monthly Revenue'],
                ['dues', 'Pending Dues'],
                ...(isAdmin
                  ? ([
                      ['trainers', 'Coach Summary'],
                      ['staff', 'Staff Attendance'],
                    ] as [Tab, string][])
                  : []),
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`btn ${tab === key ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <>
              {tab === 'monthly' && (
                <>
                  <div
                    className="kpi-grid mb-3"
                    style={{ gridTemplateColumns: 'repeat(3,1fr)' }}
                  >
                    <div className="card">
                      <div
                        className="text-muted"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '1.4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Total Revenue · {year}
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: 'var(--brand-hi)',
                          marginTop: 6,
                          letterSpacing: '-0.035em',
                        }}
                        className="tabular"
                      >
                        {fmt(totalRevenue)}
                      </div>
                    </div>
                    <div className="card">
                      <div
                        className="text-muted"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '1.4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Avg Monthly
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: 'var(--info)',
                          marginTop: 6,
                          letterSpacing: '-0.035em',
                        }}
                        className="tabular"
                      >
                        {fmt(totalRevenue / Math.max(monthly.length, 1))}
                      </div>
                    </div>
                    <div className="card">
                      <div
                        className="text-muted"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '1.4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Best Month
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: 'var(--success)',
                          marginTop: 6,
                          letterSpacing: '-0.035em',
                        }}
                      >
                        {fullYear.reduce(
                          (best, m) => (m.revenue > best.revenue ? m : best),
                          fullYear[0],
                        )?.month || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="card mb-3">
                    <div className="card-title">Monthly Revenue · {year}</div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '.4rem',
                        height: 180,
                      }}
                    >
                      {fullYear.map((m, i) => (
                        <div
                          key={i}
                          title={`${m.month}: ${fmt(m.revenue)} (${m.count} payments)`}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--muted)',
                              marginTop: 'auto',
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                            }}
                            className="tabular"
                          >
                            {m.revenue > 0
                              ? m.revenue >= 1000
                                ? '₹' + (m.revenue / 1000).toFixed(0) + 'K'
                                : '₹' + m.revenue
                              : ''}
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(
                                (m.revenue / maxRevenue) * 100,
                                m.revenue > 0 ? 3 : 0,
                              )}%`,
                              background:
                                m.revenue > 0
                                  ? 'linear-gradient(180deg, var(--brand-hi), var(--brand-lo))'
                                  : 'var(--bg-3)',
                              borderRadius: '4px 4px 0 0',
                              minHeight: m.revenue > 0 ? 6 : 2,
                              transition: 'filter .15s, height .4s',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '.4rem', marginTop: 10 }}>
                      {fullYear.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            fontSize: 10,
                            color: 'var(--muted)',
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {m.month}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Month</th>
                            <th>Payments</th>
                            <th>Revenue</th>
                            <th>Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullYear.map((m, i) => (
                            <tr key={i} style={{ opacity: m.revenue === 0 ? 0.4 : 1 }}>
                              <td style={{ fontWeight: 600 }}>
                                {m.month} {year}
                              </td>
                              <td className="text-muted tabular">{m.count || '—'}</td>
                              <td
                                style={{
                                  fontWeight: 700,
                                  color:
                                    m.revenue > 0
                                      ? 'var(--success)'
                                      : 'var(--muted)',
                                }}
                                className="tabular"
                              >
                                {m.revenue > 0 ? fmt(m.revenue) : '—'}
                              </td>
                              <td style={{ width: '32%' }}>
                                {m.revenue > 0 && (
                                  <div className="progress" style={{ width: '100%' }}>
                                    <div
                                      className="progress-fill red"
                                      style={{
                                        width: `${(m.revenue / maxRevenue) * 100}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>Total</td>
                            <td className="tabular">
                              {fullYear.reduce((s, m) => s + m.count, 0)}
                            </td>
                            <td style={{ color: 'var(--brand-hi)' }} className="tabular">
                              {fmt(totalRevenue)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {tab === 'dues' && (
                <div className="card" style={{ padding: 0 }}>
                  <div
                    style={{
                      padding: '0.95rem 1.4rem',
                      borderBottom: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div className="card-title" style={{ marginBottom: 0 }}>
                      Members with Pending Dues
                    </div>
                    <div
                      style={{ fontWeight: 700, color: 'var(--danger)' }}
                      className="tabular"
                    >
                      Total:{' '}
                      {fmt(
                        dues.reduce(
                          (s: number, d: any) => s + Number(d.balance_amount),
                          0,
                        ),
                      )}
                    </div>
                  </div>
                  <div className="table-wrap">
                    {dues.length === 0 ? (
                      <div
                        style={{
                          padding: '3rem',
                          textAlign: 'center',
                          color: 'var(--muted)',
                        }}
                      >
                        <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.55 }}>
                          ✓
                        </div>
                        No pending dues
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
                          {dues.map((d: any) => (
                            <tr key={d.id}>
                              <td>
                                <span className="id-chip">{d.client_id}</span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{d.name}</td>
                              <td className="text-muted tabular">{d.mobile || '—'}</td>
                              <td className="text-muted">{d.trainer_name || '—'}</td>
                              <td
                                style={{ fontWeight: 700, color: 'var(--danger)' }}
                                className="tabular"
                              >
                                {fmt(d.balance_amount)}
                              </td>
                              <td className="text-muted tabular">
                                {d.pt_end_date || '—'}
                              </td>
                              <td>
                                <span className={`badge badge-${d.status}`}>
                                  {d.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {tab === 'trainers' && isAdmin && (
                <div className="card" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Coach</th>
                          <th>Active</th>
                          <th>Total</th>
                          <th>Month Revenue</th>
                          <th>Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainers.map((t: any) => (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600 }}>{t.name}</td>
                            <td
                              style={{ color: 'var(--success)', fontWeight: 600 }}
                              className="tabular"
                            >
                              {t.active_clients}
                            </td>
                            <td className="text-muted tabular">{t.total_clients}</td>
                            <td
                              style={{ color: 'var(--brand-hi)', fontWeight: 700 }}
                              className="tabular"
                            >
                              {fmt(t.month_revenue)}
                            </td>
                            <td style={{ fontWeight: 700 }} className="tabular">
                              {fmt(t.total_revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          <td
                            style={{ color: 'var(--success)' }}
                            className="tabular"
                          >
                            {trainers.reduce(
                              (s: number, t: any) => s + Number(t.active_clients),
                              0,
                            )}
                          </td>
                          <td className="tabular">
                            {trainers.reduce(
                              (s: number, t: any) => s + Number(t.total_clients),
                              0,
                            )}
                          </td>
                          <td
                            style={{ color: 'var(--brand-hi)' }}
                            className="tabular"
                          >
                            {fmt(
                              trainers.reduce(
                                (s: number, t: any) => s + Number(t.month_revenue),
                                0,
                              ),
                            )}
                          </td>
                          <td className="tabular">
                            {fmt(
                              trainers.reduce(
                                (s: number, t: any) => s + Number(t.total_revenue),
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'staff' && isAdmin && <StaffAttendanceView />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── STAFF ATTENDANCE VIEW ──────────────────────────────────────────────────
function StaffAttendanceView() {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  })();

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [records, setRecords] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      // Backend stores staff/coach attendance under type='trainer' (not 'staff')
      api.attendance.list({ from, to, type: 'trainer' }) as Promise<any[]>,
      api.trainers.list(),
    ])
      .then(([recs, t]) => {
        setRecords(Array.isArray(recs) ? recs : []);
        setTrainers(t);
      })
      .catch((e) => setError(e.message || 'Failed to load staff attendance'))
      .finally(() => setLoading(false));
  }, [from, to]);

  const summary = useMemo(() => {
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    return { present, absent, late, total: records.length };
  }, [records]);

  // Per-trainer roll-up
  const perStaff = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; present: number; absent: number; late: number }
    >();
    for (const t of trainers) {
      map.set(t.id, { id: t.id, name: t.name, present: 0, absent: 0, late: 0 });
    }
    for (const r of records) {
      const id = String(r.ref_id || r.trainer_id || '');
      const name = r.ref_name || r.trainer_name || '';
      const row =
        map.get(id) ||
        (id ? { id, name, present: 0, absent: 0, late: 0 } : null);
      if (!row) continue;
      if (r.status === 'present') row.present++;
      else if (r.status === 'absent') row.absent++;
      else if (r.status === 'late') row.late++;
      map.set(id, row);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.present + b.late - (a.present + a.late),
    );
  }, [records, trainers]);

  const recent = useMemo(
    () =>
      [...records]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 30),
    [records],
  );

  const rangeDays = (() => {
    const a = new Date(from).getTime();
    const b = new Date(to).getTime();
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  })();

  return (
    <>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '.65rem',
          marginBottom: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          Date range
        </div>
        <input
          className="input"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <span className="text-muted">→</span>
        <input
          className="input"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <div
          className="text-muted text-xs"
          style={{ marginLeft: '.5rem', fontWeight: 600 }}
        >
          {rangeDays} day{rangeDays !== 1 ? 's' : ''} · {trainers.length} staff
        </div>
        <Link
          href="/attendance/staff"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
        >
          Mark staff attendance →
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Summary KPIs */}
      <div
        className="kpi-grid mb-3"
        style={{ gridTemplateColumns: 'repeat(4,1fr)' }}
      >
        <SummaryStat label="Present" value={summary.present} tone="green" />
        <SummaryStat label="Absent" value={summary.absent} tone="red" />
        <SummaryStat label="Late" value={summary.late} tone="yellow" />
        <SummaryStat label="Total Marked" value={summary.total} tone="blue" />
      </div>

      {/* Per-staff table */}
      <div className="card mb-3" style={{ padding: 0 }}>
        <div
          style={{
            padding: '0.95rem 1.4rem',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            Per-Staff Attendance
          </div>
          <div className="text-muted text-xs" style={{ fontWeight: 600 }}>
            {from} → {to}
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--muted)',
              }}
            >
              <div className="pulse">Loading staff attendance…</div>
            </div>
          ) : perStaff.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--muted)',
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.55 }}>◐</div>
              No staff attendance yet
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Attendance %</th>
                  <th>Workload</th>
                </tr>
              </thead>
              <tbody>
                {perStaff.map((s) => {
                  const total = s.present + s.late + s.absent;
                  const pct =
                    total > 0
                      ? Math.round(((s.present + s.late) / total) * 100)
                      : 0;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td
                        style={{ color: 'var(--success)', fontWeight: 700 }}
                        className="tabular"
                      >
                        {s.present}
                      </td>
                      <td
                        style={{ color: 'var(--warning)', fontWeight: 600 }}
                        className="tabular"
                      >
                        {s.late}
                      </td>
                      <td
                        style={{
                          color: s.absent > 0 ? 'var(--danger)' : 'var(--muted)',
                          fontWeight: s.absent > 0 ? 700 : 400,
                        }}
                        className="tabular"
                      >
                        {s.absent}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color:
                            pct >= 90
                              ? 'var(--success)'
                              : pct >= 70
                              ? 'var(--warning)'
                              : 'var(--danger)',
                        }}
                        className="tabular"
                      >
                        {total > 0 ? `${pct}%` : '—'}
                      </td>
                      <td style={{ width: '28%' }}>
                        <div className="progress">
                          <div
                            className={`progress-fill ${
                              pct >= 90 ? 'green' : pct >= 70 ? 'yellow' : 'red'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="tabular" style={{ color: 'var(--success)' }}>
                    {summary.present}
                  </td>
                  <td className="tabular" style={{ color: 'var(--warning)' }}>
                    {summary.late}
                  </td>
                  <td className="tabular" style={{ color: 'var(--danger)' }}>
                    {summary.absent}
                  </td>
                  <td className="tabular">{summary.total}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Recent log */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: '0.95rem 1.4rem',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            Recent Staff Check-ins
          </div>
        </div>
        <div className="table-wrap">
          {recent.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--muted)',
              }}
            >
              No staff check-ins in this date range
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r: any) => (
                  <tr key={r.id || `${r.ref_id}-${r.date}`}>
                    <td className="text-muted tabular">{r.date || '—'}</td>
                    <td style={{ fontWeight: 600 }}>
                      {r.ref_name || r.trainer_name || '—'}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-muted tabular">{r.check_in || '—'}</td>
                    <td className="text-muted text-sm">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'red' | 'yellow' | 'blue';
}) {
  const colorMap: Record<string, string> = {
    green: 'var(--success)',
    red: 'var(--danger)',
    yellow: 'var(--warning)',
    blue: 'var(--info)',
  };
  return (
    <div className={`kpi-card ${tone}`} style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: colorMap[tone],
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

function StatusBadge({ status }: { status?: string }) {
  const s = (status || '').toLowerCase();
  if (s === 'present') return <span className="badge badge-active">Present</span>;
  if (s === 'absent') return <span className="badge badge-expired">Absent</span>;
  if (s === 'late') return <span className="badge badge-bank_transfer">Late</span>;
  return <span className="badge badge-disabled">{status || '—'}</span>;
}
