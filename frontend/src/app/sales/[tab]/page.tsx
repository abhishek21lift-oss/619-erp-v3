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
      description="This sales tab has been scaffolded and is ready for feature implementation."
    />
  );
}
