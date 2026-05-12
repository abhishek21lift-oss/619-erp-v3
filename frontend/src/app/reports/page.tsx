'use client';
/**
 * Reports Page — premium SaaS rebuild
 * Tabs: Monthly Revenue | Pending Dues | Coach Summary | Staff Attendance
 * All data fetched via direct REST calls (no legacy api module).
 */
import { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart2, AlertCircle, Users, CalendarCheck,
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download,
  RefreshCw,
} from 'lucide-react';

/* ─── Constants ─────────────────────────────────────────── */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Tab = 'monthly' | 'dues' | 'trainers' | 'staff';

/* ─── Helpers ───────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmt(n: any) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function isoToday() { return new Date().toISOString().split('T')[0]; }
function iso30dAgo() {
  const d = new Date(); d.setDate(d.getDate() - 29);
  return d.toISOString().split('T')[0];
}
function isoMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function authHeaders() {
  const token = localStorage.getItem('619_token') ?? '';
  return { Authorization: `Bearer ${token}` };
}

/* ─── KPI Card ──────────────────────────────────────────── */
function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="kpi-value" style={{ color }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ─── Bar Chart (pure CSS) ──────────────────────────────── */
function RevenueBarChart({ data, maxVal }: { data: { month: string; revenue: number; count: number }[]; maxVal: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, padding: '0 4px' }}>
        {data.map((m, i) => {
          const pct = maxVal > 0 ? Math.max((m.revenue / maxVal) * 100, m.revenue > 0 ? 4 : 0) : 0;
          return (
            <div
              key={i}
              title={`${m.month}: ${fmtAmt(m.revenue)} (${m.count} payments)`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', cursor: m.revenue > 0 ? 'default' : 'default' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && m.revenue > 0 && (
                <div style={{
                  fontSize: 10, color: 'var(--text-primary)', fontWeight: 700,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 5px', marginBottom: 2, whiteSpace: 'nowrap',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {m.revenue >= 1000 ? `₹${(m.revenue/1000).toFixed(1)}K` : fmtAmt(m.revenue)}
                </div>
              )}
              {hovered !== i && (
                <div style={{ marginTop: 'auto', fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {m.revenue > 0 ? (m.revenue >= 1000 ? `₹${(m.revenue/1000).toFixed(0)}K` : '') : ''}
                </div>
              )}
              <div style={{
                width: '100%',
                height: `${pct}%`,
                background: m.revenue > 0 ? 'linear-gradient(180deg, var(--brand) 0%, rgba(220,38,38,0.5) 100%)' : 'var(--bg-subtle)',
                borderRadius: '4px 4px 0 0',
                minHeight: m.revenue > 0 ? 6 : 2,
                transition: 'opacity 150ms',
                opacity: hovered !== null && hovered !== i ? 0.5 : 1,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, padding: '0 4px' }}>
        {data.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
            {m.month}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Monthly Revenue Tab ───────────────────────────────── */
function MonthlyTab({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const [monthly, setMonthly]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const fetchMonthly = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/reports/monthly?year=${year}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setMonthly(Array.isArray(d) ? d : (d.data ?? []));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchMonthly(); }, [fetchMonthly]);

  const fullYear = MONTHS.map((name, i) => {
    const found = monthly.find((m) => parseInt(m.month_num) === i + 1);
    return { month: name, revenue: found ? Number(found.revenue) : 0, count: found ? Number(found.payment_count) : 0 };
  });

  const totalRevenue = fullYear.reduce((s, m) => s + m.revenue, 0);
  const avgMonthly   = totalRevenue / Math.max(monthly.length, 1);
  const maxRevenue   = Math.max(...fullYear.map((m) => m.revenue), 1);
  const bestMonth    = fullYear.reduce((best, m) => m.revenue > best.revenue ? m : best, fullYear[0]);
  const thisMonth    = fullYear[new Date().getMonth()];

  function exportMonthly() {
    const csv = ['Month,Payments,Revenue',
      ...fullYear.map((m) => `${m.month} ${year},${m.count},${m.revenue}`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `619_revenue_${year}.csv`;
    a.click();
  }

  if (error) return <div className="alert alert-danger">{error} <button className="btn btn-ghost btn-sm" onClick={fetchMonthly}>Retry</button></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Year nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setYear(year - 1)}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{year}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()}><ChevronRight size={15} /></button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={exportMonthly}><Download size={14} /> Export CSV</button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <KpiCard label={`Total ${year}`}      value={fmtAmt(totalRevenue)} color="var(--brand)" />
        <KpiCard label="Avg / Month"          value={fmtAmt(avgMonthly)}   color="var(--info)" />
        <KpiCard label="Best Month"           value={bestMonth?.month ?? '—'} color="var(--success)" sub={bestMonth ? fmtAmt(bestMonth.revenue) : ''} />
        <KpiCard label={`${MONTHS[new Date().getMonth()]}`} value={fmtAmt(thisMonth?.revenue ?? 0)} color="var(--warning)" sub={`${thisMonth?.count ?? 0} payments`} />
      </div>

      {/* Bar chart */}
      <div className="card" style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Monthly Revenue — {year}
        </div>
        {loading ? <div className="skeleton" style={{ height: 160, borderRadius: 8 }} /> : <RevenueBarChart data={fullYear} maxVal={maxRevenue} />}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Payments</th>
                <th>Revenue</th>
                <th style={{ width: '30%' }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={4}><div className="skeleton" style={{ height: 13, borderRadius: 4 }} /></td></tr>
                ))
              ) : (
                fullYear.map((m, i) => (
                  <tr key={i} style={{ opacity: m.revenue === 0 ? 0.45 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{m.month} {year}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.count || '—'}</td>
                    <td style={{ fontWeight: 700, color: m.revenue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {m.revenue > 0 ? fmtAmt(m.revenue) : '—'}
                    </td>
                    <td>
                      {m.revenue > 0 && (
                        <div style={{ background: 'var(--bg-subtle)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${(m.revenue / maxRevenue) * 100}%`, height: '100%', background: 'var(--brand)', borderRadius: 4, transition: 'width 400ms' }} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td style={{ color: 'var(--text-muted)' }}>{fullYear.reduce((s, m) => s + m.count, 0)}</td>
                <td style={{ color: 'var(--brand)' }}>{fmtAmt(totalRevenue)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Pending Dues Tab ──────────────────────────────────── */
function DuesTab() {
  const [dues, setDues]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const fetchDues = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/reports/dues', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setDues(Array.isArray(d) ? d : (d.data ?? []));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDues(); }, [fetchDues]);

  const filtered = search.trim()
    ? dues.filter((d) => d.name?.toLowerCase().includes(search.toLowerCase()) || (d.mobile ?? '').includes(search))
    : dues;

  const totalDues = filtered.reduce((s: number, d: any) => s + Number(d.balance_amount || d.balance_due || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="input-wrap" style={{ maxWidth: 280 }}>
          <input type="search" className="input" placeholder="Search member, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>
          Total outstanding: {fmtAmt(totalDues)}
        </div>
      </div>
      {error && <div className="alert alert-danger">{error} <button className="btn btn-ghost btn-sm" onClick={fetchDues}>Retry</button></div>}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Phone</th>
                <th>Trainer</th>
                <th>Balance Due</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 13, borderRadius: 4 }} /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <AlertCircle size={28} className="empty-state-icon" style={{ color: 'var(--success)' }} />
                    <p className="empty-state-title">No pending dues</p>
                    <p className="empty-state-desc">All members have cleared their balances.</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map((d: any, i: number) => {
                  const due = Number(d.balance_amount || d.balance_due || 0);
                  return (
                    <tr key={d.id || i}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.mobile || d.phone || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.trainer_name || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmtAmt(due)}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDate(d.pt_end_date || d.expiry_date)}</td>
                      <td>
                        <span className={`badge ${d.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{d.status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Trainer Summary Tab ───────────────────────────────── */
function TrainerSummaryTab() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const fetch_ = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/reports/trainers', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTrainers(Array.isArray(d) ? d : (d.data ?? []));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const totals = trainers.reduce((s: any, t: any) => ({
    active:       s.active       + Number(t.active_clients || 0),
    total:        s.total        + Number(t.total_clients  || 0),
    monthRev:     s.monthRev     + Number(t.month_revenue  || 0),
    totalRev:     s.totalRev     + Number(t.total_revenue  || 0),
  }), { active: 0, total: 0, monthRev: 0, totalRev: 0 });

  return (
    <div>
      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error} <button className="btn btn-ghost btn-sm" onClick={fetch_}>Retry</button></div>}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Active Members</th>
                <th>Total Members</th>
                <th>This Month</th>
                <th>All-time Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 13, borderRadius: 4 }} /></td></tr>
                ))
              ) : trainers.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <Users size={28} className="empty-state-icon" />
                    <p className="empty-state-title">No trainer data</p>
                  </div>
                </td></tr>
              ) : (
                trainers.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{t.active_clients}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.total_clients}</td>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmtAmt(t.month_revenue)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtAmt(t.total_revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && trainers.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ color: 'var(--success)' }}>{totals.active}</td>
                  <td>{totals.total}</td>
                  <td style={{ color: 'var(--brand)' }}>{fmtAmt(totals.monthRev)}</td>
                  <td>{fmtAmt(totals.totalRev)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Staff Attendance Tab ──────────────────────────────── */
function StaffTab() {
  const [from, setFrom]         = useState(iso30dAgo());
  const [to, setTo]             = useState(isoToday());
  const [records, setRecords]   = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const headers = authHeaders();
      const [rRes, tRes] = await Promise.allSettled([
        fetch(`/api/attendance?from=${from}&to=${to}&type=trainer`, { headers }),
        fetch('/api/trainers', { headers }),
      ]);
      if (rRes.status === 'fulfilled' && rRes.value.ok) {
        const d = await rRes.value.json();
        setRecords(Array.isArray(d) ? d : (d.logs ?? []));
      }
      if (tRes.status === 'fulfilled' && tRes.value.ok) {
        const d = await tRes.value.json();
        setTrainers(Array.isArray(d) ? d : (d.trainers ?? []));
      }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const summary = useMemo(() => ({
    present: records.filter((r) => r.status === 'present').length,
    absent:  records.filter((r) => r.status === 'absent').length,
    late:    records.filter((r) => r.status === 'late').length,
    total:   records.length,
  }), [records]);

  const perStaff = useMemo(() => {
    const map = new Map<string, { id: string; name: string; present: number; absent: number; late: number }>();
    trainers.forEach((t) => map.set(String(t.id), { id: String(t.id), name: t.name, present: 0, absent: 0, late: 0 }));
    records.forEach((r) => {
      const id = String(r.ref_id || r.trainer_id || '');
      const name = r.ref_name || r.trainer_name || '';
      const row = map.get(id) ?? (id ? { id, name, present: 0, absent: 0, late: 0 } : null);
      if (!row) return;
      if (r.status === 'present') row.present++;
      else if (r.status === 'absent') row.absent++;
      else if (r.status === 'late') row.late++;
      map.set(id, row);
    });
    return Array.from(map.values()).sort((a, b) => (b.present + b.late) - (a.present + a.late));
  }, [records, trainers]);

  const BadgeStatus = ({ s }: { s?: string }) => {
    const v = (s ?? '').toLowerCase();
    const c = v === 'present' ? 'badge-success' : v === 'absent' ? 'badge-danger' : v === 'late' ? 'badge-warning' : 'badge-secondary';
    return <span className={`badge ${c}`} style={{ fontSize: 11 }}>{s ?? '—'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>From</span>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 150 }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>to</span>
        <input className="input" type="date" value={to}   onChange={(e) => setTo(e.target.value)}   style={{ maxWidth: 150 }} />
        <Link href="/attendance/staff" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>
          <CalendarCheck size={13} /> Mark Staff Attendance
        </Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <KpiCard label="Present" value={String(summary.present)} color="var(--success)" />
        <KpiCard label="Late"    value={String(summary.late)}    color="var(--warning)" />
        <KpiCard label="Absent"  value={String(summary.absent)}  color="var(--danger)" />
        <KpiCard label="Total Marked" value={String(summary.total)} color="var(--info)" />
      </div>

      {/* Per-staff table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          Per-Trainer Attendance
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Attendance %</th>
                <th style={{ width: '25%' }}>Workload</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 13, borderRadius: 4 }} /></td></tr>
                ))
              ) : perStaff.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <CalendarCheck size={28} className="empty-state-icon" />
                    <p className="empty-state-title">No attendance records</p>
                  </div>
                </td></tr>
              ) : (
                perStaff.map((s) => {
                  const total = s.present + s.late + s.absent;
                  const pct   = total > 0 ? Math.round(((s.present + s.late) / total) * 100) : 0;
                  const pctColor = pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)';
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{s.present}</td>
                      <td style={{ color: 'var(--warning)' }}>{s.late}</td>
                      <td style={{ color: s.absent > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: s.absent > 0 ? 600 : 400 }}>{s.absent}</td>
                      <td style={{ fontWeight: 700, color: pctColor }}>{total > 0 ? `${pct}%` : '—'}</td>
                      <td>
                        <div style={{ background: 'var(--bg-subtle)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pctColor, borderRadius: 4 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent log */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
          Recent Staff Check-ins
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
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
              {[...records]
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                .slice(0, 30)
                .map((r: any, i: number) => (
                  <tr key={r.id || i}>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.ref_name || r.trainer_name || '—'}</td>
                    <td><BadgeStatus s={r.status} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.check_in ?? r.check_in_time ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.notes ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
function ReportsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const sp = useSearchParams();
  const [year, setYear] = useState(new Date().getFullYear());

  const initialTab = useMemo<Tab>(() => {
    const v = (sp.get('view') ?? '').toLowerCase();
    if (v === 'dues') return 'dues';
    if (v === 'trainers' || v === 'coaches') return 'trainers';
    if (v === 'staff') return 'staff';
    return 'monthly';
  }, [sp]);

  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const TABS: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'monthly',  label: '📊 Monthly Revenue' },
    { key: 'dues',     label: '⚠️ Pending Dues' },
    { key: 'trainers', label: '👥 Coach Summary', adminOnly: true },
    { key: 'staff',    label: '📋 Staff Attendance', adminOnly: true },
  ];

  return (
    <AppShell title="Reports">
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Business analytics & insights</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'monthly'  && <MonthlyTab year={year} setYear={setYear} />}
        {tab === 'dues'     && <DuesTab />}
        {tab === 'trainers' && isAdmin && <TrainerSummaryTab />}
        {tab === 'staff'    && isAdmin && <StaffTab />}
      </div>
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <Guard>
      <Suspense fallback={null}>
        <ReportsContent />
      </Suspense>
    </Guard>
  );
}
