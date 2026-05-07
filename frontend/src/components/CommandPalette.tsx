'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { allNavItems, QUICK_ACTIONS, NAV_GROUPS } from '@/lib/nav-config';
import { api, type Client } from '@/lib/api';

type Result = {
  id: string;
  label: string;
  sub?: string;
  icon: string;
  href: string;
  group: string;
  matchScore?: number;
};

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 1000;
  if (h.startsWith(n)) return 800;
  if (h.includes(n)) return 500;
  // Match each character in order — cheap fuzzy
  let hi = 0, ni = 0, score = 0;
  while (hi < h.length && ni < n.length) {
    if (h[hi] === n[ni]) { score += 10; ni++; }
    hi++;
  }
  return ni === n.length ? score : 0;
}

export default function CommandPalette() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [memberResults, setMemberResults] = useState<Client[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Open / close hotkey ──
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Reset state on open / close
  useEffect(() => {
    if (open) {
      setQ('');
      setActiveIdx(0);
      setMemberResults([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ── Fetch members (debounced) ──
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!open || !q.trim()) { setMemberResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setMemberLoading(true);
      try {
        const res = await api.clients.list({ search: q });
        setMemberResults(res.slice(0, 6));
      } catch { /* ignore */ }
      finally { setMemberLoading(false); }
    }, 200);
    return () => clearTimeout(searchTimer.current);
  }, [q, open]);

  // ── Build static results ──
  const staticResults = useMemo<Result[]>(() => {
    const items = allNavItems()
      .filter(i => !i.hidden)
      .filter(i => !i.role || i.role === user?.role);
    const navResults: Result[] = items.map(i => ({
      id: 'nav-' + i.href,
      label: i.label,
      sub: i.groupLabel,
      icon: i.icon,
      href: i.href,
      group: 'Navigate',
    }));
    const actions: Result[] = QUICK_ACTIONS
      .filter(a => !a.role || a.role === user?.role)
      .map(a => ({
        id: a.id,
        label: a.label,
        icon: a.icon,
        href: a.href,
        group: 'Quick actions',
      }));
    return [...actions, ...navResults];
  }, [user?.role]);

  // ── Combine + score ──
  const results = useMemo<Result[]>(() => {
    const memberResultsMapped: Result[] = memberResults.map(c => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name;
      return {
        id: 'mem-' + c.id,
        label: name,
        sub: c.mobile ? `+${c.country_code || '91'} ${c.mobile}` : (c.email || ''),
        icon: '◉',
        href: `/clients/${c.id}`,
        group: 'Members',
      };
    });

    if (!q.trim()) {
      // Default surface — show quick actions + a few nav items
      return staticResults.slice(0, 10);
    }

    const scored = staticResults
      .map(r => ({ ...r, matchScore: fuzzyScore(r.label + ' ' + (r.sub || ''), q) }))
      .filter(r => (r.matchScore || 0) > 0)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    return [...memberResultsMapped, ...scored].slice(0, 14);
  }, [q, staticResults, memberResults]);

  // Keep activeIdx in range
  useEffect(() => { setActiveIdx(0); }, [q]);

  const choose = useCallback((r: Result) => {
    setOpen(false);
    router.push(r.href);
  }, [router]);

  // Keyboard nav inside palette
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        const r = results[activeIdx];
        if (r) { e.preventDefault(); choose(r); }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, activeIdx, choose]);

  // Scroll active row into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  if (!open) return null;

  // Group results by `group`
  const grouped: Record<string, Result[]> = {};
  results.forEach(r => {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push(r);
  });

  let runningIdx = 0;

  return (
    <div className="cmdk-backdrop" onMouseDown={() => setOpen(false)}>
      <div
        className="cmdk-modal"
        role="dialog"
        aria-label="Command palette"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="cmdk-input-wrap">
          <span className="cmdk-icon">⌕</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search members, jump to pages, run actions"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {memberLoading && <span className="cmdk-spinner">…</span>}
          <kbd className="cmdk-kbd">esc</kbd>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 && (
            <div className="cmdk-empty">
              <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.55 }}>○</div>
              <div>No matches for &quot;{q}&quot;</div>
            </div>
          )}
          {Object.entries(grouped).map(([groupName, items]) => (
            <div key={groupName} className="cmdk-group">
              <div className="cmdk-group-label">{groupName}</div>
              {items.map(r => {
                const idx = runningIdx++;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-idx={idx}
                    className={`cmdk-item${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => choose(r)}
                  >
                    <span className="cmdk-item-icon">{r.icon}</span>
                    <span className="cmdk-item-label">{r.label}</span>
                    {r.sub && <span className="cmdk-item-sub">{r.sub}</span>}
                    {isActive && <span className="cmdk-enter">↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
            Tip: press <kbd>{typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}
