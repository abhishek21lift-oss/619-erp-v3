'use client';

import SidebarItem from './SidebarItem';
import type { NavGroup } from '@/lib/nav-config';

interface Props {
  group: NavGroup;
}

export default function SidebarGroup({ group }: Props) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
        {group.label}
      </h3>

      <div className="space-y-1">
        {group.items.map((item) => (
          <SidebarItem key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
