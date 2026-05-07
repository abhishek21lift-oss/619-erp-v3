'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import BrandLogo from './BrandLogo';

/* =====================================================================
   Navigation tree — mirrors YDL structure, mapped to 619 ERP routes
   ===================================================================== */
type NavChild = { label: string; href: string; role?: 'admin' | 'trainer' | 'member' };
type NavGroup = {
  id: string;
  label: string;
  icon?: string;
  href?: string;            // direct link (no dropdown)
  children?: NavChild[];
  role?: 'admin' | 'trainer' | 'member';
};

const NAV_ROW1: NavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', href: '/dashboard' },
  {
    id: 'enquiry', label: 'Enquiry',
    children: [
      { label: 'Add Enquiry', href: '/sales/enquiry' },
      { label: 'Enquiry List', href: '/sales/leads' },
    ],
  },
  { id: 'followups', label: 'Follow Ups', icon: '↺', href: '/sales/leads' },
  {
    id: 'members', label: 'Members',
    children: [
      { label: 'Add Member', href: '/clients/new', role: 'admin' },
      { label: 'My Members', href: '/clients' },
      { label: 'Active Members', href: '/members/active' },
      { label: 'Expiring Members', href: '/members/expiring' },
      { label: 'Lapsed Members', href: '/members/lapsed' },
      { label: 'Birthday List', href: '/members/birthdays' },
    ],
  },
  {
    id: 'analysis', label: 'Analysis',
    role: 'admin',
    children: [
      { label: 'Traffic Analysis', href: '/insights/traffic' },
      { label: 'Collection Analysis', href: '/finance/collection' },
      { label: 'Renewal Analysis', href: '/insights/renewal' },
      { label: 'Conversion Analysis', href: '/sales/funnel' },
      { label: 'Session Analysis', href: '/insights/sessions' },
      { label: 'Revenue Forecast', href: '/finance/forecast' },
      { label: 'Profit & Loss', href: '/finance/pl' },
      { label: 'Sales Leaderboard', href: '/operations/leaderboard' },
      { label: 'Lead Sources', href: '/sales/sources' },
      { label: 'All Reports', href: '/reports' },
    ],
  },
  {
    id: 'memberships', label: 'Memberships',
    children: [
      { label: 'Plans', href: '/plans' },
      { label: 'Subscriptions', href: '/memberships/subscriptions' },
    ],
  },
  {
    id: 'accounts', label: 'Accounts',
    role: 'admin',
    children: [
      { label: 'Payments', href: '/payments' },
      { label: 'Outstanding Dues', href: '/finance/dues' },
      { label: 'Collection Report', href: '/finance/collection' },
      { label: 'Profit & Loss', href: '/finance/pl' },
      { label: 'Revenue Forecast', href: '/finance/forecast' },
    ],
  },
];

const NAV_ROW2: NavGroup[] = [
  {
    id: 'notifications', label: 'Notifications & WhatsApp',
    children: [
      { label: 'Notifications', href: '/settings' },
      { label: 'WhatsApp', href: '/settings' },
    ],
  },
  {
    id: 'trainers', label: 'Trainers',
    role: 'admin',
    children: [
      { label: 'Add Trainer', href: '/trainers?new=1' },
      { label: 'My Trainers', href: '/trainers' },
      { label: 'Transformations', href: '/training/transformations' },
      { label: 'Coach Dashboard', href: '/trainer/dashboard', role: 'trainer' },
    ],
  },
  {
    id: 'fitnesscenter', label: 'Fitness Center',
    role: 'admin',
    children: [
      { label: 'Settings', href: '/settings' },
      { label: 'Plans & Pricing', href: '/plans' },
    ],
  },
  {
    id: 'staff', label: 'Staff',
    role: 'admin',
    children: [
      { label: 'Staff Attendance', href: '/attendance/staff' },
      { label: 'Staff List', href: '/attendance/staff' },
    ],
  },
  {
    id: 'attendance', label: 'Attendance Reports',
    children: [
      { label: 'Member Attendance', href: '/attendance' },
      { label: 'Staff Attendance', href: '/attendance/staff', role: 'admin' },
      { label: 'Check-in Leaderboard', href: '/operations/leaderboard' },
    ],
  },
  {
    id: 'appsettings', label: 'App Settings',
    role: 'admin',
    children: [
      { label: 'Settings', href: '/settings' },
    ],
  },
  { id: 'appointments', label: 'Appointments', href: '/attendance' },
];

/* =====================================================================
   Dropdown component
   ===================================================================== */
interface DropdownProps {
  group: NavGroup;
  isActive: boolean;
  userRole?: string;
}

function NavDropdown({ group, isActive, userRole }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleChildren = (group.children || []).filter(
    (c) => !c.role || c.role === userRole,
  );

  if (group.href) {
    return (
      <Link
        href={group.href}
        className={`tn-item${isActive ? ' tn-active' : ''}`}
      >
        {group.icon && <span className="tn-item-icon">{group.icon}</span>}
        {group.label}
      </Link>
    );
  }

  return (
    <div ref={ref} className={`tn-dropdown${open ? ' tn-open' : ''}`}>
      <button
        type="button"
        className={`tn-item tn-has-arrow${isActive ? ' tn-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {group.icon && <span className="tn-item-icon">{group.icon}</span>}
        {group.label}
        <span className="tn-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="tn-menu">
          {visibleChildren.map((c) => (
            <Link
              key={c.href + c.label}
              href={c.href}
              className="tn-menu-item"
              onClick={() => setOpen(false)}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Main TopNav component
   ===================================================================== */
export default function TopNav() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [path]);

  const userRole = user?.role;

  function isGroupActive(group: NavGroup): boolean {
    if (group.href) return path === group.href || path.startsWith(group.href + '/');
    return (group.children || []).some(
      (c) => path === c.href || path.startsWith(c.href.split('?')[0] + '/'),
    );
  }

  const initials = (user?.name || 'U')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const roleLabel = userRole === 'admin' ? 'Owner' : userRole === 'trainer' ? 'Coach' : 'Athlete';

  const visibleRow1 = NAV_ROW1.filter((g) => !g.role || g.role === userRole);
  const visibleRow2 = NAV_ROW2.filter((g) => !g.role || g.role === userRole);

  return (
    <>
      <nav className="tn-root">
        {/* ── Brand bar ── */}
        <div className="tn-brand-bar">
          <div className="tn-brand-inner">
            <div className="tn-brand-logo">
              <BrandLogo size={36} />
              <div className="tn-brand-text">
                <span className="tn-brand-name">619 FITNESS STUDIO</span>
                <span className="tn-branch-name">Kalyan Branch</span>
              </div>
            </div>

            <div className="tn-brand-right">
              <div className="tn-user-pill">
                <div className="tn-user-avatar">{initials}</div>
                <div className="tn-user-info">
                  <span className="tn-user-name">{user?.name || 'User'}</span>
                  <span className="tn-user-role">{roleLabel}</span>
                </div>
              </div>
              <button
                type="button"
                className="tn-signout-btn"
                onClick={() => { logout(); router.replace('/login'); }}
                title="Sign out"
              >
                &#x2192; Sign out
              </button>
              <button
                type="button"
                className="tn-hamburger"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                <span /><span /><span />
              </button>
            </div>
          </div>
        </div>

        {/* ── Nav rows ── */}
        <div className={`tn-nav-wrap${mobileOpen ? ' tn-mobile-open' : ''}`}>
          {/* Row 1 */}
          <div className="tn-row">
            {visibleRow1.map((g) => (
              <NavDropdown
                key={g.id}
                group={g}
                isActive={isGroupActive(g)}
                userRole={userRole}
              />
            ))}
          </div>
          {/* Row 2 */}
          <div className="tn-row tn-row-2">
            {visibleRow2.map((g) => (
              <NavDropdown
                key={g.id}
                group={g}
                isActive={isGroupActive(g)}
                userRole={userRole}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="tn-mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
