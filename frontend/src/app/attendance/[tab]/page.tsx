'use client';

import { use } from 'react';
import ModuleWorkspace from '@/components/modules/ModuleWorkspace';
import { getModuleConfig } from '@/lib/module-config';

export default function AttendanceTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  return <ModuleWorkspace config={getModuleConfig('attendance', tab)} />;
}
