'use client';
import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, className = '', style = {} }: SkeletonProps) {
  return (
    <div
      className={`sk-shimmer ${className}`}
      style={{ width, height, borderRadius, ...style }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="sk-card">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <Skeleton width={44} height={44} borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton height={14} width="60%" style={{ marginBottom: 6 }} />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${90 - i * 15}%`} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="sk-kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <Skeleton height={12} width="50%" />
        <Skeleton width={32} height={32} borderRadius={8} />
      </div>
      <Skeleton height={28} width="60%" style={{ marginBottom: 8 }} />
      <Skeleton height={10} width="40%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: '0 1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--line,#e2e8f0)', marginBottom: 8 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '1rem', padding: '0.65rem 0', borderBottom: '1px solid var(--line,#e2e8f0)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={12} width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMemberCard() {
  return (
    <div className="sk-card" style={{ borderRadius: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <Skeleton width={48} height={48} borderRadius="50%" />
        <Skeleton width={60} height={22} borderRadius={20} />
      </div>
      <Skeleton height={16} width="70%" style={{ marginBottom: 6 }} />
      <Skeleton height={12} width="50%" style={{ marginBottom: 12 }} />
      <Skeleton height={10} width="80%" style={{ marginBottom: 6 }} />
      <Skeleton height={10} width="60%" />
    </div>
  );
}
