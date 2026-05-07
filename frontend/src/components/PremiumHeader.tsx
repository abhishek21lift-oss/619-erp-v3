'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import NotificationBell from './NotificationBell';
import BrandLogo from './BrandLogo';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Members',
  '/clients/new': 'Add Member',
  '/members/active': 'Active Members',
  '/members/expiring': 'Expiring Members',
  '/members/lapsed': 'Lapsed Members',
  '/members/birthdays': 'Birthday List',
  '/sales/enquiry': 'Add Enquiry',
  '/sales/leads': 'Leads & Follow-ups',
  '/plans': 'Membership Plans',
  '/memberships/subscriptions': 'Subscriptions',
  '/payments': 'Payments',
  '/finance/dues': 'Outstanding Dues',
  '/finance/collection': 'Collection Report',
  '/finance/pl': 'Profit & Loss',
  '/finance/forecast': 'Revenue Forecast',
  '/trainers': 'Trainers',
  '/trainer/dashboard': 'Coach Dashboard',
  '/training/transformations': 'Transformations',
  '/attendance': 'Attendance',
  '/attendance/staff': 'Staff Attendance',
  '/insights/traffic': 'Traffic Analysis',
  '/insights/renewal': 'Renewal Analysis',
  '/insights/sessions': 'Session Analysis',
  '/sales/funnel': 'Conversion Analysis',
  '/sales/sources': 'Lead Sources',
  '/operations/leaderboard': 'Leaderboard',
  '/reports': 'All Reports',
  '/settings': 'Settings',
};

interface PremiumHeaderProps {
  title?: string;
  onSidebarToggle?: () => void;
}

export default function PremiumHeader({ title, onSidebarToggle }: PremiumHeaderProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hydrated, setHydrated] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize theme from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('619_theme') as 'light' | 'dark' | null;
      const initial = saved || 'light';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
      setHydrated(true);
    } catch {
      setTheme('light');
      setHydrated(true);
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    if (!hydrated) return;
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('619_theme', newTheme);
    } catch {}
  };

  // Handle Cmd+K search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        // Fire custom event for search
        window.dispatchEvent(
          new CustomEvent('search-trigger', { detail: { source: 'header' } })
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine page title
  const getPageTitle = (): string => {
    if (title) return title;
    const cleanPath = pathname.split('?')[0];
    return PAGE_TITLES[cleanPath] || 'Page';
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="ph-root">
      <div className="ph-left">
        <button
          className="ph-hamburger"
          onClick={onSidebarToggle}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <span />
          <span />
          <span />
        </button>
        {/* Logo shown only on mobile (sidebar hidden); hidden on desktop */}
        <span className="ph-mobile-logo">
          <BrandLogo size={30} showText={false} />
        </span>
        <h1 className="ph-title">{getPageTitle()}</h1>
      </div>

      <div className="ph-center">
        <div className="ph-search">
          <button
            className="ph-search-trigger"
            onClick={() => {
              searchInputRef.current?.focus();
              window.dispatchEvent(
                new CustomEvent('search-trigger', { detail: { source: 'header' } })
              );
            }}
            aria-label="Open search"
          >
            <span className="ph-search-icon">⌕</span>
            <span className="ph-search-text">Search...</span>
            <span className="ph-search-kbd">⌘K</span>
          </button>
          <input
            ref={searchInputRef}
            type="text"
            className="ph-search-input"
            placeholder="Search..."
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="ph-right">
        <button
          className="ph-theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <NotificationBell />

        <div className="ph-avatar">
          {initials}
        </div>
      </div>
    </header>
  );
}
