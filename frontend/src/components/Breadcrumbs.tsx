'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { findItemByPath, NAV_GROUPS, allNavItems } from '@/lib/nav-config';
import { api } from '@/lib/api';

type Crumb = { label: string; href?: string };

export default function Breadcrumbs() {
  const path = usePathname();
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null);

  // ── Resolve dynamic segment labels (member name, trainer name) ──
  useEffect(() => {
    setDynamicLabel(null);
    const segs = path.split('?')[0].split('/').filter(Boolean);
    if (segs.length < 2) return;
    const [root, id] = segs;
    if (!id || id === 'new') return;

    let cancelled = false;
    if (root === 'clients') {
      api.clients.get(id)
        .then(c => {
          if (cancelled) return;
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name;
          setDynamicLabel(name || null);
        })
        .catch(() => { /* leave the id as label */ });
    } else if (root === 'trainers') {
      api.trainers.get(id)
        .then(t => { if (!cancelled) setDynamicLabel(t.name || null); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [path]);

  const crumbs = useMemo<Crumb[]>(() => {
    const out: Crumb[] = [{ label: 'Home', href: '/dashboard' }];
    const cleanPath = path.split('?')[0];
    if (cleanPath === '/dashboard' || cleanPath === '/') return out;

    const segs = cleanPath.split('/').filter(Boolean);
    // First segment maps to the group whose first item starts with /<seg>
    const groupForSeg = (seg: string) => {
      for (const g of NAV_GROUPS) {
        if (g.items.some(i => i.href.split('?')[0].split('/')[1] === seg)) return g;
      }
      return null;
    };

    if (segs.length >= 1) {
      const g = groupForSeg(segs[0]);
      if (g) out.push({ label: g.label });
    }

    // Try to resolve the leaf
    const leaf = findItemByPath(cleanPath);
    if (leaf && !leaf.hidden) {
      out.push({ label: leaf.label, href: leaf.href });
    } else if (leaf && leaf.hidden && leaf.matchPrefix) {
      // It's a detail page — push the parent list and then the dynamic label
      const parentHref = leaf.matchPrefix.replace(/\/$/, '');
      const parent = allNavItems().find(i => i.href === parentHref);
      if (parent) out.push({ label: parent.label, href: parent.href });
      out.push({ label: dynamicLabel || (segs[segs.length - 1] === 'new' ? 'New' : 'Details') });
    } else {
      // Fall back to last segment
      const last = segs[segs.length - 1];
      out.push({ label: last === 'new' ? 'New' : last.charAt(0).toUpperCase() + last.slice(1) });
    }

    return out;
  }, [path, dynamicLabel]);

  if (crumbs.length <= 1) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="breadcrumb-item">
            {c.href && !isLast
              ? <Link href={c.href} className="breadcrumb-link">{c.label}</Link>
              : <span className={isLast ? 'breadcrumb-current' : 'breadcrumb-link'}>{c.label}</span>}
            {!isLast && <span className="breadcrumb-sep" aria-hidden>›</span>}
          </span>
        );
      })}
    </nav>
  );
}
