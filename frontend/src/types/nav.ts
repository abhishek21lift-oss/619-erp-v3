import { LucideIcon } from 'lucide-react';

export type Role = 'admin' | 'trainer' | 'member' | 'manager' | 'reception';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  hidden?: boolean;
  matchPrefix?: string;
  badge?: string;
  newBadge?: boolean;
  comingSoon?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};