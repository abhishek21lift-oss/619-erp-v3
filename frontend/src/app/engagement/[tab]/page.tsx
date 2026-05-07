'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  notifications: 'Notifications',
  whatsapp: 'WhatsApp Campaigns',
  sms: 'SMS Campaigns',
  balance: 'SMS Balance',
  challenges: 'Challenges',
  community: 'Community',
};

export default function EngagementTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Engagement Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="This engagement tab has been scaffolded and is available in the sidebar."
      role={tab === 'balance' ? 'admin' : undefined}
    />
  );
}
