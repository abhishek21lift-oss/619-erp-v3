'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  targets: 'Trainer Targets',
};

export default function TrainingTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Training Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="This training tab has been added and is ready for data wiring."
      role="admin"
    />
  );
}
