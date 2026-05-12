'use client';
/**
 * AppShell — root layout wrapper for every authenticated page.
 * Sidebar (fixed + collapsible), sticky topbar, main content area.
 */
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import PremiumHeader from './PremiumHeader';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const listener = (e: MediaQueryListEvent) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  return (
    <div className="shell-root">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="shell-body">
        <PremiumHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
