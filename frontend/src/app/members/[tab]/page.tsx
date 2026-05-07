'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  referrals: 'Member Referrals',
};

export default function MembersTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Members Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="This members tab is now connected and can be implemented without sidebar changes."
    />
  );
}
