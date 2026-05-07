// frontend/src/components/ui/Skeleton.tsx
//
// Content placeholder while data loads. Use real heights/widths so layout
// doesn't jump when the data arrives. Animated via Tailwind's pulse.
// The legacy `Skeleton` in components/Skeleton.tsx still works — this is the
// new design-system entry point.

import * as React from 'react';
import { cn } from './cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  /** Shape — defaults to small rounded corners. */
  variant?: 'rect' | 'circle' | 'pill';
}

export function Skeleton({
  width,
  height = 16,
  variant = 'rect',
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse bg-slate-200/70',
        variant === 'rect' && 'rounded-md',
        variant === 'circle' && 'rounded-full',
        variant === 'pill' && 'rounded-full',
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...rest}
    />
  );
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  className,
}: {
  lines?: number;
  lastLineWidth?: string | number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton width="50%" height={12} />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton width="55%" height={28} />
        <Skeleton variant="circle" width={36} height={36} />
      </div>
      <Skeleton className="mt-4" width="40%" height={10} />
    </div>
  );
}
