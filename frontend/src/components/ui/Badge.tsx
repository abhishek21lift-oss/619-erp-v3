// frontend/src/components/ui/Badge.tsx
//
// Status pill. Pick a tone — neutral / success / warning / danger / info /
// brand. Use this for everything: subscription status, payment state,
// trainer specialization, etc. Don't roll your own.

import * as React from 'react';
import { cn } from './cn';

type Tone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'purple';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-rose-50 text-rose-700 ring-rose-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Add a small leading dot, useful in dense tables. */
  dot?: boolean;
}

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Map a domain-specific status string to the right tone so call sites don't
 * have to reimplement the mapping.
 */
export function statusTone(status?: string | null): Tone {
  if (!status) return 'neutral';
  const s = String(status).toLowerCase();
  if (s === 'active' || s === 'paid' || s === 'present') return 'success';
  if (s === 'expired' || s === 'lapsed' || s === 'absent' || s === 'failed')
    return 'danger';
  if (s === 'frozen' || s === 'pending' || s === 'late') return 'warning';
  if (s === 'lead' || s === 'trial') return 'info';
  if (s === 'vip' || s === 'pt') return 'brand';
  return 'neutral';
}
