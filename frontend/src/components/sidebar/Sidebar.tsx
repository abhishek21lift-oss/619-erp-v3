'use client';

import { NAV_GROUPS } from '@/lib/nav-config';
import SidebarGroup from './SidebarGroup';

export default function Sidebar() {
  return (
    <aside className="w-72 h-screen border-r bg-white overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">619 Fitness</h2>
      </div>

      <div className="p-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.id} group={group} />
        ))}
      </div>
    </aside>
  );
}
