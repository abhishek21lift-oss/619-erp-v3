'use client';

import { use } from 'react';
import RoutePlaceholderPage from '@/components/RoutePlaceholderPage';

const LABELS: Record<string, string> = {
  payroll: 'Payroll',
  expenses: 'Expenses',
};

export default function FinanceTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const title = LABELS[tab] || 'Finance Module';
  return (
    <RoutePlaceholderPage
      title={title}
      description="This finance tab has been created and linked from the sidebar."
      role="admin"
    />
  );
}
