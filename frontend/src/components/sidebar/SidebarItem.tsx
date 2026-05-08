'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav-config';

interface Props {
  item: NavItem;
}

export default function SidebarItem({ item }: Props) {
  const pathname = usePathname();
  const active = pathname === item.href;
  // nav-config uses single-glyph string icons, NOT React components.
  // Render them as text inside a fixed-size span so the layout matches the
  // lucide-react icon variant the rest of the app uses.
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
        active ? 'bg-black text-white' : 'hover:bg-gray-100'
      }`}
    >
      <span
        aria-hidden
        className="inline-flex h-[18px] w-[18px] items-center justify-center text-base leading-none"
      >
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
