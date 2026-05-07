'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Notification = {
  id: string;
  icon: string;
  tone: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  body: string;
  href: string;
  createdAt: number;
};

const READ_KEY = '619_notifs_read';
const SNOOZE_KEY = '619_notifs_snoozed';

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadIds(readSet(READ_KEY));
    setSnoozedIds(readSet(SNOOZE_KEY));
  }, []);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.dashboard
      .summary()
      .then((d: any) => {
        if (cancelled || !d) return;
        const list: Notification[] = [];
        const now = Date.now();
        if (d.expiring_soon > 0) {
          list.push({
            id: 'expiring',
            icon: '⚠',
            tone: 'warning',
            title: `${d.expiring_soon} membership${d.expiring_soon > 1 ? 's' : ''} expiring soon`,
            body: 'Renew within the next 7 days to keep them on the roster.',
            href: '/clients?segment=expiring',
            createdAt: now,
          });
        }
        if (d.total_dues && Number(d.total_dues) > 0) {
          const v = Number(d.total_dues);
          const pretty =
            v >= 100000
              ? '₹' + (v / 100000).toFixed(1) + 'L'
              : '₹' + Math.round(v).toLocaleString('en-IN');
          list.push({
            id: 'dues',
            icon: '◈',
            tone: 'danger',
            title: `${pretty} in outstanding dues`,
            body: 'Tap to send payment reminders.',
            href: '/reports?view=dues',
            createdAt: now,
          });
        }
        if (Array.isArray(d.recent_payments) && d.recent_payments.length > 0) {
          const p = d.recent_payments[0];
          list.push({
            id: 'pay-' + p.id,
            icon: '✓',
            tone: 'success',
            title: `${p.client_name || 'A member'} just paid ₹${Number(p.amount).toLocaleString('en-IN')}`,
            body: `${p.method || 'Payment'} · ${p.date || 'today'}`,
            href: '/payments',
            createdAt: now - 60_000,
          });
        }
        if (Number(d.attendance_today || 0) === 0) {
          list.push({
            id: 'no-attendance',
            icon: '◧',
            tone: 'info',
            title: 'No check-ins logged today',
            body: 'Make sure attendance is captured at the front desk.',
            href: '/attendance',
            createdAt: now - 120_000,
          });
        }
        setItems(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = items.filter((i) => !snoozedIds.has(i.id));
  const unreadCount = visible.filter((i) => !readIds.has(i.id)).length;

  function markAllRead() {
    const next = new Set(readIds);
    visible.forEach((i) => next.add(i.id));
    setReadIds(next);
    writeSet(READ_KEY, next);
  }
  function snooze(id: string) {
    const next = new Set(snoozedIds);
    next.add(id);
    setSnoozedIds(next);
    writeSet(SNOOZE_KEY, next);
  }
  function markRead(id: string) {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    writeSet(READ_KEY, next);
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-btn"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>◉</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
              Notifications
            </div>
            {visible.length > 0 && (
              <button type="button" className="notif-clear" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {loading && <div className="notif-empty">Loading…</div>}
          {!loading && visible.length === 0 && (
            <div className="notif-empty">
              <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.6 }}>◐</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                You&apos;re all caught up
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Nothing needs your attention right now.
              </div>
            </div>
          )}

          {visible.map((n) => (
            <div
              key={n.id}
              className={`notif-item tone-${n.tone}${readIds.has(n.id) ? ' is-read' : ''}`}
            >
              <Link
                href={n.href}
                className="notif-item-body"
                onClick={() => {
                  markRead(n.id);
                  setOpen(false);
                }}
              >
                <span className="notif-item-icon">{n.icon}</span>
                <span className="notif-item-text">
                  <span className="notif-item-title">{n.title}</span>
                  <span className="notif-item-sub">{n.body}</span>
                </span>
              </Link>
              <button
                type="button"
                className="notif-item-snooze"
                aria-label="Dismiss"
                onClick={() => snooze(n.id)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
