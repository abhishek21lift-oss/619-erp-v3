'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { useAuth } from '@/lib/auth-context';
import {
  NAV_GROUPS,
  SETTINGS_GROUP,
  DASHBOARD_ITEM,
  allNavItems,
  isVisibleForRole,
  type NavItem,
} from '@/lib/nav-config';
import {
  readFavorites,
  toggleFavorite,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '@/lib/favorites';
import BrandLogo from './BrandLogo';

const COLLAPSED_GROUPS_KEY = '619_sidebar_groups';

type BadgeMap = Record<string, number>;

function readCollapsedGroups(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCollapsedGroups(state: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(state));
  } catch {}
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [groupState, setGroupState] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState('');
  const [badges, setBadges] = useState<BadgeMap>({});

  const isAdmin = user?.role === 'admin';
  const isTrainer = user?.role === 'trainer';
  const isMember = user?.role === 'member';

  useEffect(() => {
    setCollapsed(readSidebarCollapsed());
    setFavorites(readFavorites(user?.id));
    setGroupState(readCollapsedGroups());
    setHydrated(true);
  }, [user?.id]);

  // Close mobile drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Drive the CSS variable that AppShell uses to offset its main content
  useEffect(() => {
    if (!hydrated || typeof document === 'undefined') return;
    document.documentElement.style.setProperty(
      '--sidebar-w',
      collapsed ? '70px' : '248px',
    );
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
  }, [collapsed, hydrated]);

  // Lazy-load badge counts. Failures are silent — badges are decorative.
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
        const data = (await res.json()) as BadgeMap;
        if (!cancelled) setBadges(data || {});
      } catch {
        /* ignore — badges are non-critical */
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [hydrated, user?.id]);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isActive = useCallback(
    (href: string) => {
      const cleanHref = href.split('?')[0];
      const cleanPath = path.split('?')[0];
      if (cleanHref === '/dashboard') return cleanPath === '/dashboard';
      return cleanPath === cleanHref || cleanPath.startsWith(cleanHref + '/');
    },
    [path],
  );

  const visibleForRole = useCallback(
    (item: NavItem) => isVisibleForRole(item, user?.role),
    [user?.role],
  );

  const favItems = useMemo(() => {
    const all = allNavItems();
    return favorites
      .map((href) => all.find((i) => i.href === href))
      .filter((i): i is NonNullable<typeof i> => !!i && visibleForRole(i));
  }, [favorites, visibleForRole]);

  // Search results — Fuse.js fuzzy match (per blueprint §1.6). Tolerates
  // typos and partial matches like "subs" → "Subscriptions". The Fuse
  // instance is recomputed only when the role changes, not per keystroke.
  const fuse = useMemo(() => {
    const items = allNavItems().filter(
      (i) => !i.hidden && visibleForRole(i),
    );
    return new Fuse(items, {
      keys: [
        { name: 'label', weight: 0.7 },
        { name: 'groupLabel', weight: 0.3 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [visibleForRole]);

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return fuse.search(q).slice(0, 8).map((r) => r.item);
  }, [search, fuse]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    writeSidebarCollapsed(next);
  }

  function handleToggleFavorite(href: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(toggleFavorite(user?.id, href));
  }

  function toggleGroup(id: string) {
    const next = { ...groupState, [id]: !groupState[id] };
    setGroupState(next);
    writeCollapsedGroups(next);
  }

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation menu"
      >
        <span />
        <span />
        <span />
      </button>

      {drawerOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar v2${drawerOpen ? ' sidebar-open' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}
      >
        <button
          className="sidebar-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>

        <div className="sidebar-header">
          <BrandLogo size={collapsed ? 30 : 34} showText={!collapsed} textPosition="right" />
          <button
            type="button"
            className="sidebar-collapse-btn sidebar-reopen-btn"
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Sidebar search — hidden when collapsed to save horizontal space */}
        {hydrated && !collapsed && (
          <div className="sidebar-search-wrap" style={{ padding: '0 0.65rem 0.5rem' }}>
            <div className="sidebar-search">
              <input
                type="search"
                placeholder="Jump to…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('');
                  if (e.key === 'Enter' && searchResults[0]) {
                    router.push(searchResults[0].href);
                    setSearch('');
                  }
                }}
                aria-label="Search navigation"
              />
              {search && (
                <button
                  type="button"
                  className="sidebar-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            {search && (
              <ul className="sidebar-search-results">
                {searchResults.length === 0 ? (
                  <li className="sidebar-search-empty">No matches</li>
                ) : (
                  searchResults.map((r) => (
                    <li key={r.href}>
                      <Link
                        href={r.href}
                        className="sidebar-search-result"
                        onClick={() => {
                          setSearch('');
                          setDrawerOpen(false);
                        }}
                      >
                        <span className="sidebar-search-icon">{r.icon}</span>
                        <span className="sidebar-search-label">{r.label}</span>
                        <span className="sidebar-search-group">{r.groupLabel}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        {hydrated && favItems.length > 0 && !collapsed && !search && (
          <>
            <div className="nav-section" style={{ paddingTop: '0.85rem' }}>★ Pinned</div>
            <div style={{ padding: '0 0.65rem' }}>
              {favItems.map((it) => (
                <NavRow
                  key={'fav-' + it.href}
                  item={it}
                  isActive={isActive(it.href)}
                  isFav
                  badge={it.badge ? badges[it.badge] : undefined}
                  onToggleFav={handleToggleFavorite}
                  onClick={() => setDrawerOpen(false)}
                />
              ))}
            </div>
            <div style={{ padding: '0 0.65rem' }}>
              <div className="divider" />
            </div>
          </>
        )}

        <nav className="sidebar-nav" aria-label="Main navigation">
          {/* Top-level Dashboard (replaces the old "Home" group) */}
          <div style={{ padding: '0 0.65rem', marginBottom: 6 }}>
            <NavRow
              item={DASHBOARD_ITEM}
              isActive={isActive(DASHBOARD_ITEM.href)}
              collapsed={collapsed}
              isFav={favorites.includes(DASHBOARD_ITEM.href)}
              onToggleFav={handleToggleFavorite}
              onClick={() => setDrawerOpen(false)}
            />
          </div>

          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(visibleForRole);
            if (visibleItems.length === 0) return null;
            const groupCollapsed = !!groupState[group.id];

            return (
              <div
                key={group.id}
                className={`nav-group${groupCollapsed ? ' is-collapsed' : ''}`}
              >
                {!collapsed && (
                  <button
                    type="button"
                    className="nav-group-header"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!groupCollapsed}
                  >
                    <span className="nav-group-icon">{group.icon}</span>
                    <span className="nav-group-label">{group.label}</span>
                    <span className="nav-group-chevron">{groupCollapsed ? '▸' : '▾'}</span>
                  </button>
                )}
                {(collapsed || !groupCollapsed) && (
                  <div className="nav-group-items">
                    {visibleItems.map((it) => (
                      <NavRow
                        key={it.href}
                        item={it}
                        isActive={isActive(it.href)}
                        collapsed={collapsed}
                        isFav={favorites.includes(it.href)}
                        badge={it.badge ? badges[it.badge] : undefined}
                        onToggleFav={handleToggleFavorite}
                        onClick={() => setDrawerOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Settings group rendered below the divider */}
          {(() => {
            const visibleSettings = SETTINGS_GROUP.items.filter(visibleForRole);
            if (visibleSettings.length === 0) return null;
            const groupCollapsed = !!groupState[SETTINGS_GROUP.id];
            return (
              <>
                <div className="divider" />
                <div className={`nav-group${groupCollapsed ? ' is-collapsed' : ''}`}>
                  {!collapsed && (
                    <button
                      type="button"
                      className="nav-group-header"
                      onClick={() => toggleGroup(SETTINGS_GROUP.id)}
                      aria-expanded={!groupCollapsed}
                    >
                      <span className="nav-group-icon">{SETTINGS_GROUP.icon}</span>
                      <span className="nav-group-label">{SETTINGS_GROUP.label}</span>
                      <span className="nav-group-chevron">{groupCollapsed ? '▸' : '▾'}</span>
                    </button>
                  )}
                  {(collapsed || !groupCollapsed) && (
                    <div className="nav-group-items">
                      {visibleSettings.map((it) => (
                        <NavRow
                          key={it.href}
                          item={it}
                          isActive={isActive(it.href)}
                          collapsed={collapsed}
                          isFav={favorites.includes(it.href)}
                          badge={it.badge ? badges[it.badge] : undefined}
                          onToggleFav={handleToggleFavorite}
                          onClick={() => setDrawerOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            {!collapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="user-name truncate">{user?.name}</div>
                <div className="user-role">
                  {isAdmin ? 'Owner' : isTrainer ? 'Coach' : isMember ? 'Athlete' : 'User'}
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              className="btn btn-ghost w-full btn-sm"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                logout();
                router.replace('/login');
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function NavRow({
  item,
  isActive,
  collapsed,
  isFav,
  badge,
  onToggleFav,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed?: boolean;
  isFav?: boolean;
  badge?: number;
  onToggleFav?: (href: string, e: React.MouseEvent) => void;
  onClick?: () => void;
}) {
  const showBadge = typeof badge === 'number' && badge > 0;
  return (
    <Link
      href={item.href}
      className={`nav-link${isActive ? ' active' : ''}${item.comingSoon ? ' is-disabled' : ''}`}
      onClick={(e) => {
        if (item.comingSoon) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
      title={collapsed ? item.label : undefined}
      aria-disabled={item.comingSoon || undefined}
    >
      <span className="nav-icon">{item.icon}</span>
      {!collapsed && <span className="nav-label">{item.label}</span>}
      {!collapsed && item.isNew && (
        <span className="nav-pill nav-pill-new" aria-label="New feature">NEW</span>
      )}
      {!collapsed && showBadge && (
        <span className="nav-pill nav-pill-badge" aria-label={`${badge} pending`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {!collapsed && onToggleFav && (
        <button
          type="button"
          className={`nav-pin${isFav ? ' is-fav' : ''}`}
          aria-label={isFav ? 'Unpin from favorites' : 'Pin to favorites'}
          onClick={(e) => onToggleFav(item.href, e)}
          tabIndex={-1}
        >
          {isFav ? '★' : '☆'}
        </button>
      )}
    </Link>
  );
}
