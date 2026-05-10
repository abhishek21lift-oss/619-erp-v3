'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  reports: 'Attendance Reports',
};

export default function AttendanceTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Attendance Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="Review attendance trends, exceptions, and operational check-in summaries."
      role="admin"
    />
  );
}
