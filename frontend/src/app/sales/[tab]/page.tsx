'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  follow: 'Sales Follow-Ups',
};

export default function SalesTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Sales Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="Track follow-up queues, recent conversations, and conversion tasks for the sales desk."
    />
  );
}
