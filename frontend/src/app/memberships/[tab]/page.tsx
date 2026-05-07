'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  plans: 'Membership Plans',
};

export default function MembershipsTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Memberships Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="This memberships tab is now available from the sidebar."
      role={tab === 'plans' ? 'admin' : undefined}
    />
  );
}
