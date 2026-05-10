'use client';

import ModuleWorkspace from '@/components/modules/ModuleWorkspace';
import { getModuleConfig } from '@/lib/module-config';

export default function TrainerLeaveRequestsPage() {
  return <ModuleWorkspace config={getModuleConfig('leave')} />;
}
