'use client';
/**
 * Member — Browse & book classes.
 * Mobile-first, calendar-style chip nav across 7 days.
 * Built on the 619 Iron design system.
 */
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';

type Session = {
  session_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  class_name: string;
  category: string;
  trainer_name?: string;
  confirmed: number;
  spots_left: number;
  color?: string;
};

export default function MemberClassesPage() {
  return (
    <Guard role="member">
      <Inner />
    </Guard>
  );
}

function Inner() {
  const [day, setDay] = useState(0);
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [filter, setFilter] = useState<string>('all');
  const [booking, setBooking] = useState<string | null>(null);

  useEffect(() => {
    // Real impl:
    // fetch(`/api/v1/classes/sessions?from=${start}&to=${end}`)
    //   .then(r => r.json()).then(j => setSessions(j.data ?? []));
  }, [day]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const targetDate = days[day].toISOString().slice(0, 10);
  const visible = sessions.filter(
    (s) =>
      s.starts_at.startsWith(targetDate) && (filter === 'all' || s.category === filter),
  );

  async function book(sessionId: string) {
    setBooking(sessionId);
    try {
      // Real impl: await fetch('/api/v1/bookings', { method:'POST', body: JSON.stringify({ session_id }) })
      await new Promise((r) => setTimeout(r, 500));
      setSessions((prev) =>
        prev.map((s) =>
          s.session_id === sessionId
            ? {
                ...s,
                confirmed: s.confirmed + 1,
                spots_left: Math.max(0, s.spots_left - 1),
              }
            : s,
        ),
      );
    } finally {
      setBooking(null);
    }
  }

  return (
    <div className="member-shell">
      <header className="member-header">
        <div className="member-header-inner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '0.85rem 1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.022em',
              }}
            >
              Classes
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
              My bookings →
            </button>
          </div>

          {/* Day chips */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 2,
            }}
          >
            {days.map((d, i) => {
              const isActive = i === day;
              return (
                <button
                  key={i}
                  onClick={() => setDay(i)}
                  style={{
                    flexShrink: 0,
                    width: 56,
                    padding: '8px 0',
                    borderRadius: 12,
                    textAlign: 'center',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s var(--ease)',
                    background: isActive ? 'var(--brand)' : 'var(--bg-3)',
                    color: isActive ? 'var(--on-brand)' : 'var(--text-2)',
                    borderColor: isActive ? 'var(--brand)' : 'var(--line-2)',
                    boxShadow: isActive ? '0 4px 12px var(--brand-glow2)' : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                      opacity: isActive ? 0.95 : 0.7,
                    }}
                  >
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      marginTop: 2,
                      letterSpacing: '-0.025em',
                    }}
                    className="tabular"
                  >
                    {d.getDate()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="member-main">
        {/* Filter chips */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {['all', 'yoga', 'hiit', 'cardio', 'dance', 'strength'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`status-pill${filter === f ? ' is-active' : ''}`}
              style={{ flexShrink: 0 }}
            >
              {f === 'all' ? 'All classes' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Sessions list */}
        {visible.length === 0 ? (
          <div
            style={{
              borderRadius: 14,
              border: '1px dashed var(--line-2)',
              padding: '2rem 1rem',
              textAlign: 'center',
              background: 'var(--bg-2)',
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.55 }}>◌</div>
            <div className="text-muted text-sm">No classes match your filters</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((s) => {
              const time = new Date(s.starts_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const full = s.spots_left <= 0;
              const almostFull = s.spots_left > 0 && s.spots_left <= 3;
              return (
                <div
                  key={s.session_id}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'stretch',
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      background: s.color || 'var(--brand)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, padding: '14px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14.5,
                            color: 'var(--text)',
                            letterSpacing: '-0.012em',
                          }}
                          className="truncate"
                        >
                          {s.class_name}
                        </div>
                        <div
                          className="text-muted text-xs"
                          style={{ marginTop: 3, fontWeight: 600 }}
                        >
                          {time} · {s.trainer_name || 'TBA'}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          full
                            ? 'badge-expired'
                            : almostFull
                            ? 'badge-bank_transfer'
                            : 'badge-active'
                        }`}
                      >
                        {full ? 'Full' : `${s.spots_left} left`}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        className="text-muted text-xs"
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          fontWeight: 600,
                        }}
                      >
                        <span className="tabular">
                          ◉ {s.confirmed}/{s.capacity}
                        </span>
                        <span style={{ color: 'var(--muted-2)' }}>·</span>
                        <span style={{ textTransform: 'capitalize' }}>
                          {s.category}
                        </span>
                      </div>
                      <button
                        onClick={() => book(s.session_id)}
                        disabled={booking === s.session_id}
                        className={`btn ${full ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                        style={
                          full
                            ? { color: 'var(--warning)', borderColor: 'var(--warning)' }
                            : undefined
                        }
                      >
                        {booking === s.session_id
                          ? '…'
                          : full
                          ? 'Join waitlist'
                          : 'Book'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Mock sessions for today and tomorrow ───────────────────────────────────
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const fmtDate = (d: Date, h: number, m: number) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};
const mockSessions: Session[] = [
  {
    session_id: 'cs1',
    starts_at: fmtDate(today, 7, 0),
    ends_at: fmtDate(today, 8, 0),
    capacity: 15,
    class_name: 'Yoga Flow',
    category: 'yoga',
    trainer_name: 'Riya',
    confirmed: 11,
    spots_left: 4,
    color: '#a855f7',
  },
  {
    session_id: 'cs2',
    starts_at: fmtDate(today, 18, 30),
    ends_at: fmtDate(today, 19, 15),
    capacity: 12,
    class_name: 'HIIT Burn',
    category: 'hiit',
    trainer_name: 'Abhishek',
    confirmed: 12,
    spots_left: 0,
    color: '#ef2d3c',
  },
  {
    session_id: 'cs3',
    starts_at: fmtDate(today, 19, 0),
    ends_at: fmtDate(today, 20, 0),
    capacity: 25,
    class_name: 'Zumba Party',
    category: 'dance',
    trainer_name: 'Maya',
    confirmed: 14,
    spots_left: 11,
    color: '#f59e0b',
  },
  {
    session_id: 'cs4',
    starts_at: fmtDate(tomorrow, 6, 0),
    ends_at: fmtDate(tomorrow, 6, 45),
    capacity: 20,
    class_name: 'Spin Express',
    category: 'cardio',
    trainer_name: 'Rajat',
    confirmed: 18,
    spots_left: 2,
    color: '#38bdf8',
  },
  {
    session_id: 'cs5',
    starts_at: fmtDate(tomorrow, 7, 0),
    ends_at: fmtDate(tomorrow, 8, 0),
    capacity: 15,
    class_name: 'Yoga Flow',
    category: 'yoga',
    trainer_name: 'Riya',
    confirmed: 7,
    spots_left: 8,
    color: '#a855f7',
  },
];
