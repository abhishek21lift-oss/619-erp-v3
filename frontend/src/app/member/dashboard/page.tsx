'use client';
/**
 * Member Dashboard — mobile-first member portal home.
 * Built on the 619 Iron design system using member-shell CSS classes.
 */
import { useEffect, useState } from 'react';
import Guard from '@/components/Guard';
import { useAuth } from '@/lib/auth-context';

type Membership = {
  plan_name: string;
  status: 'active' | 'expired' | 'frozen';
  end_date: string;
  days_remaining: number;
  balance_amount: number;
};
type Booking = {
  id: string;
  class_name: string;
  starts_at: string;
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'attended';
  trainer_name?: string;
  color?: string;
};

export default function MemberDashboardPage() {
  return (
    <Guard role="member">
      <MemberDashboard />
    </Guard>
  );
}

function MemberDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'home' | 'classes' | 'bookings' | 'plan' | 'profile'>(
    'home',
  );
  const [membership, setMembership] = useState<Membership | null>(null);
  const [today, setToday] = useState<Booking[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [me, b] = await Promise.all([
          fetch('/api/v1/auth/me').then((r) => r.json()),
          fetch('/api/v1/bookings').then((r) => r.json()),
        ]);
        setMembership(me?.data?.membership ?? mockMembership);
        const todayDate = new Date().toISOString().slice(0, 10);
        const all: Booking[] = b?.data ?? mockBookings;
        setToday(all.filter((x) => x.starts_at.startsWith(todayDate)));
        setUpcoming(
          all.filter((x) => x.starts_at > new Date().toISOString()).slice(0, 3),
        );
      } catch {
        setMembership(mockMembership);
        setToday(mockToday);
        setUpcoming(mockUpcoming);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Skeleton />;

  const initials = (user?.name || 'M')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const firstName = user?.name?.split(' ')[0] || 'Member';

  return (
    <div className="member-shell">
      <header className="member-header">
        <div className="member-header-inner">
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
                letterSpacing: '0.4px',
              }}
            >
              Hi 👋
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.022em',
                marginTop: 1,
              }}
            >
              {firstName}
            </div>
          </div>
          <div
            className="user-avatar"
            style={{ width: 38, height: 38, fontSize: 13, borderRadius: 10 }}
          >
            {initials}
          </div>
        </div>
      </header>

      <main className="member-main">
        {/* Membership status hero */}
        <div className="member-hero">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              position: 'relative',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.78)',
                }}
              >
                Current Plan
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.022em',
                  color: '#fff',
                  marginTop: 6,
                }}
              >
                {membership?.plan_name}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.20)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.28)',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
              }}
            >
              {membership?.status === 'active' ? '● Active' : membership?.status}
            </span>
          </div>

          <div style={{ marginTop: 16, position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'rgba(255,255,255,0.85)',
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              <span>Days remaining</span>
              <span className="tabular" style={{ fontWeight: 700 }}>
                {membership?.days_remaining} days
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.20)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(
                    100,
                    ((membership?.days_remaining ?? 0) / 180) * 100,
                  )}%`,
                  background: '#fff',
                  borderRadius: 999,
                  transition: 'width 0.6s var(--ease)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              position: 'relative',
            }}
          >
            <MiniHeroStat label="Ends on" value={membership?.end_date || '—'} />
            <MiniHeroStat
              label="Balance"
              value={
                membership?.balance_amount
                  ? `₹${membership.balance_amount}`
                  : 'Paid up'
              }
            />
          </div>
        </div>

        {/* Today's classes */}
        <section>
          <SectionHeader title="Today" right={`${today.length} class${today.length !== 1 ? 'es' : ''}`} />
          {today.length === 0 ? (
            <EmptyState icon="◐" title="No classes today" cta="Browse classes" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {today.map((b) => (
                <BookingRow key={b.id} b={b} primary />
              ))}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          <ActionTile icon="◧" label="Book class" />
          <ActionTile icon="◆" label="Book PT" />
          <ActionTile
            icon="◈"
            label="Pay dues"
            badge={
              membership?.balance_amount ? `₹${membership.balance_amount}` : null
            }
          />
        </section>

        {/* Upcoming */}
        <section>
          <SectionHeader title="Upcoming" />
          {upcoming.length === 0 ? (
            <EmptyState icon="◌" title="No upcoming bookings" cta="Browse classes" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </div>
          )}
        </section>

        {/* Progress card */}
        <section className="card" style={{ padding: '1.1rem 1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Your progress
            </div>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--brand-hi)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              View all →
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <Stat label="Workouts" value="42" sub="this month" />
            <Stat
              label="Weight"
              value="-2.1kg"
              sub="since Jan"
              valueColor="var(--success)"
            />
            <Stat label="Streak" value="◆ 7" sub="days" valueColor="var(--gold)" />
          </div>
        </section>
      </main>

      {/* Bottom nav */}
      <nav className="member-bottom-nav">
        <div className="member-bottom-nav-inner">
          {(
            [
              ['home', '⌂', 'Home'],
              ['classes', '◧', 'Classes'],
              ['bookings', '◌', 'Bookings'],
              ['plan', '◆', 'Plan'],
              ['profile', '◉', 'Profile'],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              className={`member-bottom-btn${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key as any)}
            >
              <span className="member-bottom-btn-icon">{icon}</span>
              <span style={{ marginTop: 2 }}>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function MiniHeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.14)',
        border: '1px solid rgba(255,255,255,0.20)',
        borderRadius: 10,
        padding: '.6rem .75rem',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.78)',
          fontWeight: 600,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 3 }}
        className="tabular"
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-2)',
          letterSpacing: '-0.005em',
        }}
      >
        {title}
      </div>
      {right && (
        <div className="text-muted text-xs" style={{ fontWeight: 600 }}>
          {right}
        </div>
      )}
    </div>
  );
}

function BookingRow({ b, primary }: { b: Booking; primary?: boolean }) {
  const t = new Date(b.starts_at);
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        background: 'var(--bg-2)',
        border: primary
          ? '1px solid rgba(239,45,60,0.40)'
          : '1px solid var(--line)',
        boxShadow: primary ? '0 0 0 3px var(--brand-soft)' : 'none',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 11,
          flexShrink: 0,
          background:
            b.color ||
            'linear-gradient(135deg, var(--brand) 0%, var(--brand-lo) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '0.5px',
        }}
      >
        {b.class_name.slice(0, 2).toUpperCase()}
      </div>
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
          {b.class_name}
        </div>
        <div className="text-muted text-xs">
          {time} · {b.trainer_name || 'TBA'}
        </div>
      </div>
      {b.status === 'waitlist' ? (
        <span className="badge badge-frozen">Waitlist</span>
      ) : (
        <button className="btn btn-primary btn-sm">Check in</button>
      )}
    </div>
  );
}

function ActionTile({
  icon,
  label,
  badge,
}: {
  icon: string;
  label: string;
  badge?: string | null;
}) {
  return (
    <button
      style={{
        position: 'relative',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '14px 10px',
        cursor: 'pointer',
        transition: 'border-color 0.15s var(--ease), transform 0.15s var(--ease)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: 22,
          color: 'var(--brand-hi)',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--text-2)',
          textAlign: 'center',
          letterSpacing: '-0.005em',
        }}
      >
        {label}
      </div>
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 9.5,
            background: 'var(--brand)',
            color: 'var(--on-brand)',
            borderRadius: 999,
            padding: '2px 6px',
            fontWeight: 700,
          }}
          className="tabular"
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '-0.022em',
          color: valueColor || 'var(--text)',
        }}
        className="tabular"
      >
        {value}
      </div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 2, fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{ fontSize: 10, color: 'var(--muted-2)', marginTop: 1, fontWeight: 500 }}
      >
        {sub}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  cta,
}: {
  icon: string;
  title: string;
  cta: string;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px dashed var(--line-2)',
        padding: '1.5rem 1rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.55 }}>{icon}</div>
      <div className="text-muted text-sm" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--brand-hi)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {cta} →
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="member-shell">
      <div className="member-header">
        <div className="member-header-inner">
          <div>
            <div className="skeleton" style={{ width: 60, height: 11, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 110, height: 16 }} />
          </div>
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10 }} />
        </div>
      </div>
      <div className="member-main">
        <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
      </div>
    </div>
  );
}

// ── Mock data fallbacks ────────────────────────────────────────────────────
const mockMembership: Membership = {
  plan_name: 'Half Yearly',
  status: 'active',
  end_date: '2026-09-30',
  days_remaining: 47,
  balance_amount: 0,
};
const mockBookings: Booking[] = [];
const mockToday: Booking[] = [
  {
    id: '1',
    class_name: 'Yoga Flow',
    starts_at: new Date().toISOString().slice(0, 10) + 'T07:00:00',
    status: 'confirmed',
    trainer_name: 'Riya',
  },
];
const mockUpcoming: Booking[] = [
  {
    id: '2',
    class_name: 'HIIT Burn',
    starts_at: '2026-05-15T18:30:00',
    status: 'confirmed',
    trainer_name: 'Abhishek',
  },
  {
    id: '3',
    class_name: 'Spin Express',
    starts_at: '2026-05-16T06:00:00',
    status: 'waitlist',
    trainer_name: 'Rajat',
  },
];
