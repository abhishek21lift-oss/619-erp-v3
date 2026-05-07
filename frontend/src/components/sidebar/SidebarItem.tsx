'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SidebarItem({ item }: any) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
        active ? 'bg-black text-white' : 'hover:bg-gray-100'
      }`}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </Link>
  );
}
