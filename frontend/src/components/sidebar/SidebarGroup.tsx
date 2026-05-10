'use client';

import SidebarItem from './SidebarItem';

export default function SidebarGroup({ group }: any) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
        {group.label}
      </h3>

      <div className="space-y-1">
        {group.items.map((item: any) => (
          <SidebarItem key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
