'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Breadcrumbs from './Breadcrumbs';
import NotificationBell from './NotificationBell';

type Props = {
  /** Optional page title — falls back to a greeting if omitted. */
  title?: string;
  /** Optional subline — falls back to today's date if omitted. */
  subtitle?: string;
  /** Slot for page-level primary action button(s). */
  actions?: React.ReactNode;
  /** Hide breadcrumbs (e.g. on the root dashboard where they'd say "Home › Dashboard"). */
  hideBreadcrumbs?: boolean;
};

function todayString() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function greet(name?: string) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name?.split(' ')[0] || 'Coach'}`;
}

export default function TopBar({ title, subtitle, actions, hideBreadcrumbs }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

  function openPalette() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        code: 'KeyK',
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      }),
    );
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="topbar v2">
      <div className="topbar-left">
        {!hideBreadcrumbs && <Breadcrumbs />}
        <div className="topbar-titles">
          <div className="topbar-title">{title || greet(user?.name)}</div>
          <div className="topbar-sub">{subtitle || todayString()}</div>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="topbar-search-trigger"
          onClick={openPalette}
          aria-label="Open search (Cmd+K)"
        >
          <span aria-hidden style={{ opacity: 0.75 }}>⌕</span>
          <span className="topbar-search-text">Search anything</span>
          <kbd className="topbar-kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd className="topbar-kbd">K</kbd>
        </button>

        <NotificationBell />

        {actions && <div className="topbar-actions">{actions}</div>}

        <button
          type="button"
          className="topbar-avatar"
          aria-label="Account"
          onClick={() => router.push('/settings')}
          title={user?.name || 'Account'}
        >
          {initials}
        </button>
      </div>
    </div>
  );
}
