'use client';
/**
 * Sidebar — premium Linear/Notion-style navigation.
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Fuse from 'fuse.js';

import type { LucideIcon } from 'lucide-react';

import {
  // Nav icons
  LayoutDashboard,
  TrendingUp,
  Users,
  Dumbbell,
  ScanFace,
  CreditCard,
  IndianRupee,
  LineChart,
  Megaphone,
  Settings,

  // Item icons
  Inbox,
  PlusCircle,
  Filter,
  PieChart,
  UserCheck,
  CalendarClock,
  UserX,
  Cake,
  UserPlus,
  User,
  UserCog,
  LayoutGrid,
  CalendarOff,
  Sparkles,
  ClipboardList,
  ClipboardCheck,
  Trophy,
  Layers,
  RefreshCw,
  CalendarDays,
  Wallet,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Award,
  FileBarChart,
  Activity,
  RefreshCcw,
  Clock,
  Bell,
  MessageCircle,
  Send,
  Tag,
  Star,
  Building2,
  ShieldCheck,
  Fingerprint,
  Receipt,
  Palette,

  // UI controls
  ChevronRight,
  Search,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

import {
  NAV_GROUPS,
  SETTINGS_GROUP,
  DASHBOARD_ITEM,
  allNavItems,
  isVisibleForRole,
  type NavItem,
} from '@/lib/nav-config';

// ─────────────────────────────────────────────────────────────────────
// Icon map
// ─────────────────────────────────────────────────────────────────────

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  TrendingUp,
  Users,
  Dumbbell,
  ScanFace,

  CreditCard,
  IndianRupee,
  LineChart,
  Megaphone,
  Settings,

  Inbox,
  PlusCircle,
  Filter,
  PieChart,

  UserCheck,
  CalendarClock,
  UserX,
  Cake,
  UserPlus,
  User,

  UserCog,
  LayoutGrid,
  CalendarOff,
  Sparkles,

  ClipboardList,
  ClipboardCheck,
  Trophy,

  Layers,
  RefreshCw,
  CalendarDays,

  Wallet,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Award,

  FileBarChart,
  Activity,
  RefreshCcw,
  Clock,

  Bell,
  MessageCircle,
  Send,
  Tag,
  Star,

  Building2,
  ShieldCheck,
  Fingerprint,
  Receipt,
  Palette,
};

function Icon({
  name,
  size = 15,
}: {
  name: string;
  size?: number;
}) {
  const C = ICONS[name];

  return C ? <C size={size} /> : null;
}

// ─────────────────────────────────────────────────────────────────────
// Local storage helpers
// ─────────────────────────────────────────────────────────────────────

const COLLAPSED_KEY = '619_sidebar_collapsed';
const GROUPS_KEY = '619_sidebar_groups';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(v));
  } catch {}
}

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupState(s: Record<string, boolean>) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(s));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { user, logout } = useAuth();

  const path = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);

  const [groupState, setGroupState] = useState<
    Record<string, boolean>
  >({});

  const [hydrated, setHydrated] = useState(false);

  const [search, setSearch] = useState('');

  const [searchOpen, setSearchOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Hydration ──────────────────────────────────────────────────────

  useEffect(() => {
    setCollapsed(loadCollapsed());
    setGroupState(loadGroupState());
    setHydrated(true);
  }, []);

  // ── Route change close mobile ─────────────────────────────────────

  useEffect(() => {
    onMobileClose?.();
  }, [path]);

  // ── Search ────────────────────────────────────────────────────────

  const visibleItems = useMemo(() => {
    return allNavItems().filter(
      (i) => isVisibleForRole(i, user?.role) && !i.hidden
    );
  }, [user?.role]);

  const fuse = useMemo(
    () =>
      new Fuse(visibleItems, {
        keys: ['label', 'groupLabel'],
        threshold: 0.35,
      }),
    [visibleItems]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];

    return fuse
      .search(search)
      .map((r) => r.item)
      .slice(0, 8);
  }, [search, fuse]);

  // ── Helpers ───────────────────────────────────────────────────────

  const isActive = useCallback(
    (href: string) => {
      const cleanHref = href.split('?')[0];
      const cleanPath = path.split('?')[0];

      if (cleanHref === '/dashboard') {
        return cleanPath === '/dashboard';
      }

      return (
        cleanPath === cleanHref ||
        cleanPath.startsWith(cleanHref + '/')
      );
    },
    [path]
  );

  const toggleGroup = useCallback((id: string) => {
    setGroupState((prev) => {
      const next = {
        ...prev,
        [id]: !prev[id],
      };

      saveGroupState(next);

      return next;
    });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      saveCollapsed(!v);
      return !v;
    });
  }, []);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isGroupOpen = (id: string) =>
    !(id in groupState) ? true : groupState[id];

  // ── Render nav item ───────────────────────────────────────────────

  const renderItem = (item: NavItem, idx: number) => {
    const active = isActive(item.href);

    return (
      <Link
        key={item.href + idx}
        href={item.comingSoon ? '#' : item.href}
        className={`sidebar-item${active ? ' active' : ''}`}
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={
          item.comingSoon
            ? (e) => e.preventDefault()
            : undefined
        }
      >
        <span className="sidebar-item-icon">
          <Icon name={item.icon} size={15} />
        </span>

        <span className="sidebar-item-label">
          {item.label}
        </span>
      </Link>
    );
  };

  // ── Classes ───────────────────────────────────────────────────────

  const sidebarCls = [
    'sidebar',
    collapsed ? 'collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const wrapCls = [
    'shell-sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'drawer-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={`sidebar-backdrop${
          mobileOpen ? ' visible' : ''
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={wrapCls}
        aria-label="Main navigation"
      >
        <nav className={sidebarCls}>
          {/* Header */}

          <div className="sidebar-header">
            <div className="sidebar-logo">619</div>

            <div className="sidebar-brand">
              <div className="sidebar-brand-name">
                619 Fitness
              </div>

              <div className="sidebar-brand-sub">
                Operating System
              </div>
            </div>

            <button
              className="sidebar-toggle"
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={13} />
            </button>
          </div>

          {/* Expand button */}

          {collapsed && (
            <button
              className="sidebar-toggle"
              onClick={toggleCollapsed}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={13} />
            </button>
          )}

          {/* Search */}

          {!collapsed && (
            <div style={{ padding: '8px 10px 4px' }}>
              {searchOpen ? (
                <div className="search-bar">
                  <Search size={13} />

                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Search…"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  className="sidebar-search-btn"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={13} />

                  <span>Search…</span>
                </button>
              )}
            </div>
          )}

          {/* Search results */}

          {search &&
            searchResults.length > 0 &&
            searchResults.map((item, idx) =>
              renderItem(item, idx)
            )}

          {/* Dashboard */}

          {isVisibleForRole(
            DASHBOARD_ITEM,
            user?.role
          ) && renderItem(DASHBOARD_ITEM, 0)}

          {/* Groups */}

          {NAV_GROUPS.map((group) => {
            const groupItems = group.items.filter(
              (i) =>
                isVisibleForRole(i, user?.role) &&
                !i.hidden
            );

            if (groupItems.length === 0) return null;

            const open = isGroupOpen(group.id);

            return (
              <div
                key={group.id}
                className="sidebar-group"
              >
                <button
                  className="sidebar-group-btn"
                  onClick={() =>
                    toggleGroup(group.id)
                  }
                >
                  {collapsed ? (
                    <Icon
                      name={group.icon}
                      size={15}
                    />
                  ) : (
                    <>
                      <span className="sidebar-group-label">
                        {group.label}
                      </span>

                      <span
                        className={`sidebar-group-chevron${
                          open ? ' open' : ''
                        }`}
                      >
                        <ChevronRight size={12} />
                      </span>
                    </>
                  )}
                </button>

                <div
                  className="sidebar-group-items"
                  style={{
                    maxHeight: open
                      ? `${groupItems.length * 42}px`
                      : '0px',
                  }}
                >
                  {groupItems.map((item, idx) =>
                    renderItem(item, idx)
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer */}

          <div className="sidebar-footer">
            <div className="sidebar-avatar">
              {initials}
            </div>

            {!collapsed && (
              <>
                <div className="sidebar-user">
                  <div className="sidebar-user-name">
                    {user?.name || 'User'}
                  </div>

                  <div className="sidebar-user-role">
                    {user?.role || 'Staff'}
                  </div>
                </div>

                <button
                  className="sidebar-logout"
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}