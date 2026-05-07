'use client';
/**
 * Trainer Dashboard — earnings hero + today's schedule + assigned clients.
 * Built on the 619 Iron design system (dark theme, crimson accent).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';

type Earnings = { base: number; incentive: number; total: number; month: string };
type ScheduleItem = {
  id: string;
  type: 'class' | 'pt';
  title: string;
  member?: string;
  time: string;
  status: 'completed' | 'upcoming' | 'missed';
};
type ClientCard = {
  id: string;
  name: string;
  member_code: string;
  plan: string;
  days_left: number;
  last_visit?: string;
};

export default function TrainerDashboardPage() {
  return (
    <Guard role="trainer">
      <TrainerInner />
    </Guard>
  );
}

function TrainerInner() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'today' | 'clients' | 'earnings'>('today');
  const [earn] = useState<Earnings>({
    base: 25000,
    incentive: 12450,
    total: 37450,
    month: 'April 2026',
  });
  const [today] = useState<ScheduleItem[]>(mockSchedule);
  const [clients] = useState<ClientCard[]>(mockClients);

  useEffect(() => {
    // Real impl: fetch /api/v1/dashboard/trainer
    fetch('/api/dashboard/summary')
      .then((r) => r.json())
      .then(() => {
        /* hydrate */
      })
      .catch(() => {});
  }, []);

  const fmt = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <AppShell>
      <div className="page-main">

        <div className="page-content fade-up">
          {/* Earnings hero */}
          <div
            className="card mb-3"
            style={{
              padding: 0,
              overflow: 'hidden',
              background:
                'linear-gradient(135deg, var(--brand) 0%, var(--brand-lo) 60%, #6b0a14 100%)',
              borderColor: 'rgba(239,45,60,0.40)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -30,
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.10)',
                filter: 'blur(50px)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', padding: '1.6rem 1.75rem' }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.78)',
                }}
              >
                {earn.month} earnings
              </div>
              <div
                className="tabular"
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  color: '#fff',
                  marginTop: 8,
                  lineHeight: 1,
                }}
              >
                {fmt(earn.total)}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '.6rem',
                  maxWidth: 420,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '.7rem .85rem',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.78)',
                    }}
                  >
                    Base salary
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#fff',
                      marginTop: 4,
                    }}
                    className="tabular"
                  >
                    {fmt(earn.base)}
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '.7rem .85rem',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.78)',
                    }}
                  >
                    Incentive
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#fff',
                      marginTop: 4,
                    }}
                    className="tabular"
                  >
                    {fmt(earn.incentive)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.1rem' }}>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#fff',
                    color: 'var(--brand-lo)',
                    fontWeight: 700,
                  }}
                >
                  ↓ Download payslip
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.26)',
                  }}
                >
                  Earnings history
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="kpi-grid mb-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <MiniStat label="Active clients" value="14" delta="+2" tone="green" />
            <MiniStat label="Sessions / week" value="22" delta="+5" tone="red" />
            <MiniStat label="Avg attendance" value="86%" delta="+4%" tone="blue" />
            <MiniStat label="Retention" value="92%" delta="+1%" tone="purple" />
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '.4rem',
              marginBottom: '1.25rem',
              padding: '.3rem',
              background: 'var(--bg-3)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              width: 'fit-content',
            }}
          >
            {(
              [
                ['today', "Today's Schedule"],
                ['clients', 'My Clients'],
                ['earnings', 'Earnings'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  padding: '.45rem 1rem',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: tab === k ? 'var(--brand)' : 'transparent',
                  color: tab === k ? 'var(--on-brand)' : 'var(--text-2)',
                  boxShadow: tab === k ? '0 4px 12px var(--brand-glow2)' : 'none',
                  transition: 'all .15s var(--ease)',
                  fontFamily: 'inherit',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          {tab === 'today' && (
            <div className="card" style={{ padding: 0 }}>
              {today.length === 0 ? (
                <div
                  style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  <div style={{ fontSize: 26, opacity: 0.5, marginBottom: 8 }}>◐</div>
                  <div className="text-sm">No sessions scheduled today</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {today.map((s, i) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem 1.4rem',
                        borderBottom:
                          i === today.length - 1 ? 'none' : '1px solid var(--line)',
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--text)',
                            letterSpacing: '-0.005em',
                          }}
                          className="tabular"
                        >
                          {s.time.split(' ')[0]}
                        </div>
                        <div
                          className="text-muted text-xs"
                          style={{ fontWeight: 600 }}
                        >
                          {s.time.split(' ')[1]}
                        </div>
                      </div>
                      <div
                        style={{
                          width: 3,
                          height: 40,
                          borderRadius: 3,
                          background:
                            s.type === 'class' ? 'var(--purple)' : 'var(--brand)',
                          boxShadow:
                            s.type === 'class'
                              ? '0 0 12px rgba(168,85,247,0.45)'
                              : '0 0 12px var(--brand-glow)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--text)',
                            fontSize: 14,
                            letterSpacing: '-0.005em',
                          }}
                          className="truncate"
                        >
                          {s.title}
                        </div>
                        <div className="text-muted text-xs truncate">
                          {s.member ? `with ${s.member}` : 'Group class'}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          s.status === 'completed'
                            ? 'badge-active'
                            : s.status === 'upcoming'
                            ? 'badge-trainer'
                            : 'badge-disabled'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'clients' && (
            <div
              style={{
                display: 'grid',
                gap: '0.85rem',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              }}
            >
              {clients.map((c) => {
                const initials = c.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const expiring = c.days_left < 14;
                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="card"
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '.85rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '.75rem',
                      }}
                    >
                      <div
                        className="user-avatar"
                        style={{ width: 40, height: 40, fontSize: 13, borderRadius: 10 }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            letterSpacing: '-0.012em',
                          }}
                          className="truncate"
                        >
                          {c.name}
                        </div>
                        <div className="text-muted text-xs truncate">
                          {c.member_code} · {c.plan}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          color: expiring ? 'var(--warning)' : 'var(--muted)',
                          fontWeight: expiring ? 700 : 500,
                        }}
                        className="tabular"
                      >
                        {c.days_left} days left
                      </span>
                      <span className="text-muted text-xs">
                        Last: {c.last_visit || '—'}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '.5rem',
                        borderTop: '1px solid var(--line)',
                        paddingTop: '.75rem',
                      }}
                    >
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1 }}
                        onClick={(e) => e.preventDefault()}
                      >
                        Message
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={(e) => e.preventDefault()}
                      >
                        Schedule
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {tab === 'earnings' && (
            <div className="card" style={{ padding: 0 }}>
              <div
                style={{
                  padding: '0.95rem 1.4rem',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Last 6 months
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Revenue Generated</th>
                      <th>Incentive</th>
                      <th>Total Payout</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {mockEarnings.map((e) => (
                      <tr key={e.month}>
                        <td style={{ fontWeight: 600 }}>{e.month}</td>
                        <td className="tabular">{fmt(e.revenue)}</td>
                        <td
                          style={{ color: 'var(--success)', fontWeight: 600 }}
                          className="tabular"
                        >
                          {fmt(e.incentive)}
                        </td>
                        <td style={{ fontWeight: 700 }} className="tabular">
                          {fmt(e.total)}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm">↓ Payslip</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: 'green' | 'red' | 'blue' | 'purple';
}) {
  const colors: Record<string, string> = {
    green: 'var(--success)',
    red: 'var(--brand-hi)',
    blue: 'var(--info)',
    purple: 'var(--purple)',
  };
  return (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '.5rem',
          marginTop: 6,
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: colors[tone],
          }}
          className="tabular"
        >
          {value}
        </div>
        <span
          style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}
          className="tabular"
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

// ── Mock data ──────────────────────────────────────────────────────────────
const mockSchedule: ScheduleItem[] = [
  {
    id: 's1',
    type: 'class',
    title: 'Yoga Flow (15 booked)',
    time: '07:00 AM',
    status: 'completed',
  },
  {
    id: 's2',
    type: 'pt',
    title: 'PT Session',
    member: 'Priya Patel',
    time: '10:00 AM',
    status: 'completed',
  },
  {
    id: 's3',
    type: 'pt',
    title: 'PT Session',
    member: 'Vikram Joshi',
    time: '05:30 PM',
    status: 'upcoming',
  },
  {
    id: 's4',
    type: 'class',
    title: 'Yoga Flow (12 booked)',
    time: '07:00 PM',
    status: 'upcoming',
  },
];
const mockClients: ClientCard[] = [
  {
    id: 'c1',
    name: 'Priya Patel',
    member_code: 'FS0001',
    plan: 'Half Yearly',
    days_left: 47,
    last_visit: 'today',
  },
  {
    id: 'c2',
    name: 'Anita Singh',
    member_code: 'FS0003',
    plan: 'Half Yearly',
    days_left: 71,
    last_visit: 'yesterday',
  },
  {
    id: 'c3',
    name: 'Vikram Joshi',
    member_code: 'FS0006',
    plan: 'Half Yearly',
    days_left: 120,
    last_visit: 'today',
  },
  {
    id: 'c4',
    name: 'Sneha Iyer',
    member_code: 'FS0010',
    plan: 'Quarterly',
    days_left: 9,
    last_visit: '3 days ago',
  },
];
const mockEarnings = [
  { month: 'Apr 2026', revenue: 85000, incentive: 12450, total: 37450 },
  { month: 'Mar 2026', revenue: 78000, incentive: 11200, total: 36200 },
  { month: 'Feb 2026', revenue: 72000, incentive: 10300, total: 35300 },
  { month: 'Jan 2026', revenue: 68000, incentive: 9700, total: 34700 },
  { month: 'Dec 2025', revenue: 71000, incentive: 10100, total: 35100 },
  { month: 'Nov 2025', revenue: 65000, incentive: 9200, total: 34200 },
];
