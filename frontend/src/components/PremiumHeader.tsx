'use client';
/**
 * TopBar (PremiumHeader)
 *
 * Sticky glassmorphic top bar with:
 *  • Mobile hamburger (triggers Sidebar drawer)
 *  • Breadcrumb / page title (auto-resolved from pathname)
 *  • ⌘K shortcut to fire the command palette
 *  • Dark/light mode toggle (persisted)
 *  • Notification bell
 *  • User avatar (click → settings)
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { findItemByPath } from '@/lib/nav-config';
import { Menu, Moon, Sun, Bell, Settings } from 'lucide-react';

interface Props {
  /** Propagated up from AppShell to toggle mobile drawer */
  onMenuClick?: () => void;
}

export default function PremiumHeader({ onMenuClick }: Props) {
  const { user } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hydrated, setHydrated] = useState(false);

  // ── Theme init ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = (localStorage.getItem('619_theme') as 'light' | 'dark') ?? 'light';
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } catch {}
    setHydrated(true);
  }, []);

  const toggleTheme = () => {
    if (!hydrated) return;
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('619_theme', next); } catch {}
  };

  // ── ⌘K → command palette ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('619-cmd-palette'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Page title from nav-config ────────────────────────────────────
  const navItem   = findItemByPath(pathname);
  const pageTitle = navItem?.label ?? 'Page';

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="shell-topbar">
      {/* Mobile hamburger */}
      <button
        className="topbar-burger"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu size={16} />
      </button>

      {/* Page title */}
      <h1 className="topbar-title">{pageTitle}</h1>

      {/* Right actions */}
      <div className="topbar-right">
        {/* ⌘K search hint */}
        <button
          className="btn btn-outline btn-sm"
          style={{ gap: 8, color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', minWidth: 140 }}
          onClick={() => window.dispatchEvent(new CustomEvent('619-cmd-palette'))}
          title="Search — ⌘K"
        >
          <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
          <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono,monospace)', padding: '1px 5px', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>⌘K</kbd>
        </button>

        {/* Theme toggle */}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label="Toggle theme"
        >
          {hydrated ? (
            theme === 'light' ? <Moon size={15} /> : <Sun size={15} />
          ) : (
            <span style={{ width: 15 }} />
          )}
        </button>

        {/* Notification bell */}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          title="Notifications"
          aria-label="Notifications"
          style={{ position: 'relative' }}
        >
          <Bell size={15} />
        </button>

        {/* Settings shortcut */}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => router.push('/settings')}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={15} />
        </button>

        {/* Avatar */}
        <button
          onClick={() => router.push('/settings')}
          title={user?.name ?? 'Account'}
          aria-label="Account settings"
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--gradient-brand, linear-gradient(135deg,#dc2626,#b91c1c))',
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            transition: 'box-shadow 120ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-soft)')}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
