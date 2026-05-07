// frontend/src/components/ui/KpiCard.tsx
//
// The "big number" tile used across every dashboard. Optional delta arrow,
// trend sparkline, accent stripe at the top. Designed to be readable on
// mobile (single column) and desktop (3-up / 4-up grid).

'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from './cn';

type Accent =
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'violet'
  | 'orange'
  | 'slate';

const ACCENTS: Record<Accent, { stripe: string; iconBg: string; iconFg: string }> = {
  rose:    { stripe: 'from-rose-500 to-pink-500',       iconBg: 'bg-rose-50',    iconFg: 'text-rose-600' },
  emerald: { stripe: 'from-emerald-500 to-teal-500',    iconBg: 'bg-emerald-50', iconFg: 'text-emerald-600' },
  amber:   { stripe: 'from-amber-500 to-yellow-500',    iconBg: 'bg-amber-50',   iconFg: 'text-amber-600' },
  sky:     { stripe: 'from-sky-500 to-blue-500',        iconBg: 'bg-sky-50',     iconFg: 'text-sky-600' },
  violet:  { stripe: 'from-violet-500 to-fuchsia-500',  iconBg: 'bg-violet-50',  iconFg: 'text-violet-600' },
  orange:  { stripe: 'from-orange-500 to-red-500',      iconBg: 'bg-orange-50',  iconFg: 'text-orange-600' },
  slate:   { stripe: 'from-slate-400 to-slate-500',     iconBg: 'bg-slate-50',   iconFg: 'text-slate-600' },
};

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  /** Optional secondary line (e.g. "+₹12,400 vs last month"). */
  hint?: React.ReactNode;
  /** % delta vs previous period. Positive = up arrow, negative = down arrow. */
  delta?: number;
  /** When delta is positive, "good" means green up arrow. Set to "bad" to invert (e.g. churn going up is bad). */
  deltaIs?: 'good' | 'bad';
  icon?: React.ReactNode;
  accent?: Accent;
  /** When set, the whole card becomes a Link to that route. */
  href?: string;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaIs = 'good',
  icon,
  accent = 'rose',
  href,
  loading,
  className,
}: KpiCardProps) {
  const tone = ACCENTS[accent];

  const inner = (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition',
        href && 'hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-rose-300',
        className,
      )}
    >
      {/* Accent stripe */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          tone.stripe,
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              'grid h-9 w-9 place-items-center rounded-xl',
              tone.iconBg,
              tone.iconFg,
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="truncate text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
          {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-200/70" /> : value}
        </p>
        {typeof delta === 'number' && Number.isFinite(delta) && (
          <DeltaPill delta={delta} deltaIs={deltaIs} />
        )}
      </div>

      {hint && (
        <p className="mt-2 truncate text-xs text-slate-500">{hint}</p>
      )}
    </article>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="block focus:outline-none" aria-label={label}>
      {inner}
    </Link>
  );
}

function DeltaPill({ delta, deltaIs }: { delta: number; deltaIs: 'good' | 'bad' }) {
  const positive = delta >= 0;
  // Business semantics: when "good" means up, positive delta is green.
  const isGreen = deltaIs === 'good' ? positive : !positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isGreen
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-700',
      )}
      aria-label={`Change ${positive ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} percent`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}
