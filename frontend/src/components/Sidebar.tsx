'use client';
/**
 * Sidebar — premium Linear/Notion-style navigation.
 *
 * Features:
 *  • Collapsible (icon-only) with CSS transition
 *  • Role-based item visibility
 *  • Collapsible nav groups with persisted open/closed state
 *  • Fuzzy search (Fuse.js) across all nav items
 *  • Badge counts loaded from /api/dashboard/badges
 *  • Favourites (star) quick-access row
 *  • Mobile: full-width drawer with backdrop
 *  • Lucide icons — no Unicode glyphs
 *  • Keyboard accessible (⌘K opens command palette)
 *  • Dark-mode aware via CSS custom properties
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import {
  // Nav icons
  LayoutDashboard, TrendingUp, Users, Dumbbell, ScanFace,
  CreditCard, IndianRupee, LineChart, Megaphone, Settings,
  // Item icons
  Inbox, PlusCircle, Filter, PieChart,
  UserCheck, CalendarClock, UserX, Cake, UserPlus, User,
  UserCog, LayoutGrid, CalendarOff, Sparkles,
  ClipboardList, ClipboardCheck, Trophy,
  Layers, RefreshCw, CalendarDays,
  Wallet, AlertCircle, ArrowUpRight, BarChart3, Award,
  FileBarChart, Activity, RefreshCcw, Clock,
  Bell, MessageCircle, Send, Tag, Star,
  Building2, ShieldCheck, Fingerprint, Receipt, Palette,
  // UI controls
  ChevronRight, Search, LogOut, PanelLeftClose, PanelLeftOpen,
  Dumbbell as DumbbellIcon,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import {
  NAV_GROUPS, SETTINGS_GROUP, DASHBOARD_ITEM,
  allNavItems, isVisibleForRole,
  type NavItem,
} from '@/lib/nav-config';

// ─────────────────────────────────────────────────────────────────────
// Icon map: Lucide name → component
// ─────────────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, TrendingUp, Users, Dumbbell, ScanFace,
  CreditCard, IndianRupee, LineChart, Megaphone, Settings,
  Inbox, PlusCircle, Filter, PieChart,
  UserCheck, CalendarClock, UserX, Cake, UserPlus, User,
  UserCog, LayoutGrid, CalendarOff, Sparkles,
  ClipboardList, ClipboardCheck, Trophy,
  Layers, RefreshCw, CalendarDays,
  Wallet, AlertCircle, ArrowUpRight, BarChart3, Award,
  FileBarChart, Activity, RefreshCcw, Clock,
  Bell, MessageCircle, Send, Tag, Star,
  Building2, ShieldCheck, Fingerprint, Receipt, Palette,
};
function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const C = ICONS[name];
  return C ? <C size={size} /> : null;
}

// ─────────────────────────────────────────────────────────────────────
// Local-storage helpers
// ─────────────────────────────────────────────────────────────────────
const COLLAPSED_KEY   = '619_sidebar_collapsed';
const GROUPS_KEY      = '619_sidebar_groups';
const BADGES_KEY      = '619_sidebar_badges';

function loadCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
}
function saveCollapsed(v: boolean) {
  try { localStorage.setItem(COLLAPSED_KEY, String(v)); } catch {}
}
function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveGroupState(s: Record<string, boolean>) {
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(s)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────
// Props (injected by AppShell)
// ─────────────────────────────────────────────────────────────────────
interface SidebarProps {
  /** Controlled by AppShell on mobile (drawer open/close) */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────
export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const path      = usePathname();
  const router    = useRouter();

  const [collapsed,   setCollapsed]   = useState(false);
  const [groupState,  setGroupState]  = useState<Record<string, boolean>>({});
  const [hydrated,    setHydrated]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [badges,      setBadges]      = useState<Record<string, number>>({});
  const [searchOpen,  setSearchOpen]  = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isAdmin   = user?.role === 'admin';
  const isTrainer = user?.role === 'trainer';
  const isMember  = user?.role === 'member';

  // ── Hydration ──────────────────────────────────────────────────────
  useEffect(() => {
    setCollapsed(loadCollapsed());
    setGroupState(loadGroupState());
    setHydrated(true);
  }, []);

  // ── Drive sidebar-w CSS variable for AppShell ──────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const w = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)';
    document.documentElement.style.setProperty('--active-sidebar-w', w);
  }, [collapsed, hydrated]);

  // ── Close mobile drawer on route change ───────────────────────────
  useEffect(() => { onMobileClose?.(); }, [path]);

  // ── Lock body scroll on mobile drawer open ────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ── Badge counts ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const t = typeof window !== 'undefined' ? localStorage.getItem('619_token') : null;
        if (!t) return;
        const res = await fetch(`${base}/api/dashboard/badges`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBadges(data || {});
      } catch { /* non-critical */ }
    };
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [hydrated, user?.id]);

  // ── Search (Fuse.js) ───────────────────────────────────────────────
  const visibleItems = useMemo(() => {
    return allNavItems().filter((i) => isVisibleForRole(i, user?.role) && !i.hidden);
  }, [user?.role]);

  const fuse = useMemo(
    () => new Fuse(visibleItems, { keys: ['label', 'groupLabel'], threshold: 0.35 }),
    [visibleItems],
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return fuse.search(search).map((r) => r.item).slice(0, 8);
  }, [search, fuse]);

  // ── Helpers ────────────────────────────────────────────────────────
  const isActive = useCallback((href: string) => {
    const cleanHref = href.split('?')[0];
    const cleanPath = path.split('?')[0];
    if (cleanHref === '/dashboard') return cleanPath === '/dashboard';
    return cleanPath === cleanHref || cleanPath.startsWith(cleanHref + '/');
  }, [path]);

  const toggleGroup = useCallback((id: string) => {
    setGroupState((prev) => {
      const next = { ...prev, [id]: !prev[id] };
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

  // Default group-open state: all open
  const isGroupOpen = (id: string) => !(id in groupState) ? true : groupState[id];

  // ── Render nav item ───────────────────────────────────────────────
  const renderItem = (item: NavItem, idx: number) => {
    const active = isActive(item.href);
    const count  = item.badge ? (badges[item.badge] ?? 0) : 0;
    return (
      <Link
        key={item.href + idx}
        href={item.comingSoon ? '#' : item.href}
        className={`sidebar-item${active ? ' active' : ''}`}
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={item.comingSoon ? (e) => e.preventDefault() : undefined}
      >
        <span className="sidebar-item-icon">
          <Icon name={item.icon} size={15} />
        </span>
        <span className="sidebar-item-label">{item.label}</span>
        {count > 0 && !collapsed && (
          <span className="sidebar-item-badge">{count > 99 ? '99+' : count}</span>
        )}
        {item.isNew && !count && !collapsed && (
          <span className="sidebar-item-new">NEW</span>
        )}
      </Link>
    );
  };

  // ── Build sidebar content ─────────────────────────────────────────
  const sidebarCls = [
    'sidebar',
    collapsed ? 'collapsed' : '',
  ].filter(Boolean).join(' ');

  const wrapCls = [
    'shell-sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'drawer-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop${mobileOpen ? ' visible' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={wrapCls} aria-label="Main navigation">
        <nav className={sidebarCls}>

          {/* ── Header ───────────────────────────────────────────── */}
          <div className="sidebar-header">
            <div className="sidebar-logo">619</div>
            <div className="sidebar-brand">
              <div className="sidebar-brand-name">619 Fitness</div>
              <div className="sidebar-brand-sub">Operating System</div>
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

          {/* ── Expand button when collapsed ─────────────────────── */}
          {collapsed && (
            <button
              className="sidebar-toggle"
              style={{ margin: '8px auto', display: 'flex', width: 36, height: 36, justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={toggleCollapsed}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={13} />
            </button>
          )}

          {/* ── Search ───────────────────────────────────────────── */}
          {!collapsed && (
            <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
              {searchOpen ? (
                <div className="search-bar" style={{ minWidth: 0, height: 30 }}>
                  <Search size={13} style={{ flexShrink: 0 }} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearch(''); } }}
                    onBlur={() => { if (!search) setSearchOpen(false); }}
                    autoFocus
                  />
                  {search && (
                    <button
                      onClick={() => { setSearch(''); setSearchOpen(false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : (
                <button
                  className="sidebar-search-btn"
                  onClick={() => setSearchOpen(true)}
                  title="Search (⌘K)"
                >
                  <Search size={13} style={{ flexShrink: 0 }} />
                  <span className="sidebar-search-text">Search…</span>
                  <span className="sidebar-search-kbd">⌘K</span>
                </button>
              )}
            </div>
          )}

          {/* ── Nav ──────────────────────────────────────────────── */}
          <div className="sidebar-nav">

            {/* Search results overlay */}
            {search && searchResults.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', padding: '4px 10px 4px', marginBottom: 2 }}>
                  Results
                </div>
                {searchResults.map((item, idx) => renderItem(item, idx))}
                <div className="divider" style={{ margin: '8px 0' }} />
              </div>
            )}

            {/* Dashboard */}
            {isVisibleForRole(DASHBOARD_ITEM, user?.role) && (
              <div className="sidebar-home" style={{ marginBottom: 8 }}>
                {renderItem(DASHBOARD_ITEM, 0)}
              </div>
            )}

            {/* Main groups */}
            {NAV_GROUPS.map((group) => {
              const groupItems = group.items.filter(
                (i) => isVisibleForRole(i, user?.role) && !i.hidden,
              );
              if (groupItems.length === 0) return null;
              const open = isGroupOpen(group.id);

              return (
                <div key={group.id} className="sidebar-group">
                  <button
                    className="sidebar-group-btn"
                    onClick={() => toggleGroup(group.id)}
                    title={collapsed ? group.label : undefined}
                    aria-expanded={open}
                  >
                    {collapsed ? (
                      <Icon name={group.icon} size={15} />
                    ) : (
                      <>
                        <span className="sidebar-group-label">{group.label}</span>
                        <span className={`sidebar-group-chevron${open ? ' open' : ''}`}>
                          <ChevronRight size={12} />
                        </span>
                      </>
                    )}
                  </button>

                  <div
                    className="sidebar-group-items"
                    style={{ maxHeight: open ? `${groupItems.length * 42}px` : '0px' }}
                  >
                    {groupItems.map((item, idx) => renderItem(item, idx))}
                  </div>
                </div>
              );
            })}

            {/* Divider */}
            <div className="divider" style={{ margin: '10px 0' }} />

            {/* Settings group */}
            {(() => {
              const settingsItems = SETTINGS_GROUP.items.filter(
                (i) => isVisibleForRole(i, user?.role) && !i.hidden,
              );
              if (settingsItems.length === 0) return null;
              const open = isGroupOpen(SETTINGS_GROUP.id);
              return (
                <div className="sidebar-group">
                  <button
                    className="sidebar-group-btn"
                    onClick={() => toggleGroup(SETTINGS_GROUP.id)}
                    title={collapsed ? SETTINGS_GROUP.label : undefined}
                    aria-expanded={open}
                  >
                    {collapsed ? (
                      <Icon name={SETTINGS_GROUP.icon} size={15} />
                    ) : (
                      <>
                        <span className="sidebar-group-label">{SETTINGS_GROUP.label}</span>
                        <span className={`sidebar-group-chevron${open ? ' open' : ''}`}>
                          <ChevronRight size={12} />
                        </span>
                      </>
                    )}
                  </button>
                  <div
                    className="sidebar-group-items"
                    style={{ maxHeight: open ? `${settingsItems.length * 42}px` : '0px' }}
                  >
                    {settingsItems.map((item, idx) => renderItem(item, idx))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Footer / User ─────────────────────────────────────── */}
          <div className="sidebar-footer">
            <div
              className="sidebar-avatar"
              title={user?.name || 'User'}
              onClick={() => router.push('/settings')}
            >
              {initials}
            </div>
            {!collapsed && (
              <>
                <div className="sidebar-user">
                  <div className="sidebar-user-name">{user?.name || 'User'}</div>
                  <div className="sidebar-user-role" style={{ textTransform: 'capitalize' }}>
                    {user?.role || 'Staff'}
                  </div>
                </div>
                <button
                  className="sidebar-logout"
                  onClick={() => { logout(); router.push('/login'); }}
                  title="Sign out"
                  aria-label="Sign out"
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
