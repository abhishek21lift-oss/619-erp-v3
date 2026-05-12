// src/lib/nav-config.ts
//
// Single source of truth for all navigation.
// Sidebar, CommandPalette, and Breadcrumbs all consume this file.
//
// Icon strings map to Lucide React components inside Sidebar.tsx.
// Groups: Dashboard → Sales → Members → Training → Attendance →
//         Memberships → Finance → Insights → Engagement → Settings.

export type Role = 'admin' | 'manager' | 'reception' | 'trainer' | 'member';

export type NavItem = {
  href: string;
  label: string;
  icon: string;          // Lucide component name
  role?: Role;           // single-role restriction
  roles?: Role[];        // multi-role restriction (takes precedence over `role`)
  hidden?: boolean;      // hide from sidebar; keep in breadcrumb/command-palette
  matchPrefix?: string;  // match this prefix for /:id-style routes
  badge?: string;        // badge-provider key
  isNew?: boolean;       // show "NEW" pill
  comingSoon?: boolean;  // render disabled with tooltip
};

export type NavGroup = {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
};

// ─────────────────────────────────────────────────────────────────────
// Dashboard (above groups)
// ─────────────────────────────────────────────────────────────────────
export const DASHBOARD_ITEM: NavItem = {
  href:  '/dashboard',
  label: 'Dashboard',
  icon:  'LayoutDashboard',
};

// ─────────────────────────────────────────────────────────────────────
// Main nav groups
// ─────────────────────────────────────────────────────────────────────
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'sales',
    label: 'Sales',
    icon: 'TrendingUp',
    items: [
      { href: '/sales/leads',   label: 'Lead Inbox',        icon: 'Inbox',       role: 'admin', badge: 'leadsCount' },
      { href: '/sales/enquiry', label: 'Add Enquiry',       icon: 'PlusCircle' },
      { href: '/sales/funnel',  label: 'Conversion Funnel', icon: 'Filter',      role: 'admin' },
      { href: '/sales/sources', label: 'Lead Sources',      icon: 'PieChart',    role: 'admin' },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    icon: 'Users',
    items: [
      { href: '/clients',           label: 'All Members',   icon: 'Users' },
      { href: '/members/active',    label: 'Active',        icon: 'UserCheck' },
      { href: '/members/expiring',  label: 'Expiring Soon', icon: 'CalendarClock', badge: 'expiringCount' },
      { href: '/members/lapsed',    label: 'Lapsed',        icon: 'UserX' },
      { href: '/members/birthdays', label: 'Birthdays',     icon: 'Cake',          badge: 'birthdaysToday' },
      { href: '/clients/new',       label: 'Add Member',    icon: 'UserPlus' },
      { href: '/clients/[id]', label: 'Member Profile', icon: 'User', hidden: true, matchPrefix: '/clients/' },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    icon: 'Dumbbell',
    items: [
      { href: '/trainers',                 label: 'Coaches',          icon: 'UserCog',     role: 'admin' },
      { href: '/trainer/dashboard',        label: 'My Dashboard',     icon: 'LayoutGrid',  role: 'trainer' },
      { href: '/trainers/leave',           label: 'Leave Requests',   icon: 'CalendarOff', role: 'admin', badge: 'pendingLeaves' },
      { href: '/training/transformations', label: 'Transformations',  icon: 'Sparkles',    role: 'admin' },
      { href: '/trainers/[id]', label: 'Coach Profile', icon: 'UserCog', hidden: true, matchPrefix: '/trainers/' },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: 'ScanFace',
    items: [
      { href: '/checkin',                label: 'Face Check-In',     icon: 'ScanFace' },
      { href: '/attendance',             label: 'Member Attendance', icon: 'ClipboardList' },
      { href: '/attendance/staff',       label: 'Staff Attendance',  icon: 'ClipboardCheck', role: 'admin' },
      { href: '/operations/leaderboard', label: 'Leaderboard',       icon: 'Trophy' },
    ],
  },
  {
    id: 'memberships',
    label: 'Memberships',
    icon: 'CreditCard',
    items: [
      { href: '/plans',                     label: 'Plans & Pricing',  icon: 'Layers',       role: 'admin' },
      { href: '/memberships/subscriptions', label: 'Subscriptions',    icon: 'RefreshCw' },
      { href: '/appointments',              label: 'Appointments',     icon: 'CalendarDays', isNew: true },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'IndianRupee',
    items: [
      { href: '/payments',               label: 'Payments',          icon: 'Wallet' },
      { href: '/finance/dues',           label: 'Outstanding Dues',  icon: 'AlertCircle',  badge: 'duesCount' },
      { href: '/finance/collection',     label: 'Collection',        icon: 'ArrowUpRight', role: 'admin' },
      { href: '/finance/pl',             label: 'Profit & Loss',     icon: 'BarChart3',    role: 'admin' },
      { href: '/finance/forecast',       label: 'Revenue Forecast',  icon: 'TrendingUp',   role: 'admin' },
      { href: '/finance/trainer-revenue',label: 'Trainer Revenue',   icon: 'Award',        role: 'admin' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: 'LineChart',
    items: [
      { href: '/reports',           label: 'All Reports',         icon: 'FileBarChart' },
      { href: '/insights/traffic',  label: 'Footfall Traffic',   icon: 'Activity',   role: 'admin' },
      { href: '/insights/renewal',  label: 'Renewal Analysis',   icon: 'RefreshCcw', role: 'admin' },
      { href: '/insights/sessions', label: 'Session Utilisation',icon: 'Clock' },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    icon: 'Megaphone',
    items: [
      { href: '/engagement/notifications', label: 'Notifications',   icon: 'Bell',         isNew: true },
      { href: '/engagement/whatsapp',      label: 'WhatsApp',        icon: 'MessageCircle',isNew: true },
      { href: '/engagement/campaigns',     label: 'Campaigns',       icon: 'Send',         role: 'admin', isNew: true },
      { href: '/engagement/offers',        label: 'Offers & Promos', icon: 'Tag',          role: 'admin', isNew: true },
      { href: '/engagement/feedback',      label: 'Feedback',        icon: 'Star',         role: 'admin', isNew: true },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// Settings group (below divider)
// ─────────────────────────────────────────────────────────────────────
export const SETTINGS_GROUP: NavGroup = {
  id: 'settings',
  label: 'Settings',
  icon: 'Settings',
  items: [
    { href: '/settings',           label: 'General',          icon: 'Settings' },
    { href: '/settings/branches',  label: 'Branches',         icon: 'Building2',   role: 'admin', isNew: true },
    { href: '/settings/staff',     label: 'Staff & Access',   icon: 'ShieldCheck', role: 'admin', isNew: true },
    { href: '/settings/biometric', label: 'Biometric & Face', icon: 'Fingerprint', role: 'admin', isNew: true },
    { href: '/settings/billing',   label: 'GST / Invoice',    icon: 'Receipt',     role: 'admin', isNew: true },
    { href: '/settings/branding',  label: 'Branding',         icon: 'Palette',     role: 'admin', isNew: true },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Quick actions
// ─────────────────────────────────────────────────────────────────────
export const QUICK_ACTIONS = [
  { id: 'qa-add-member',   label: 'Add new member',   icon: 'UserPlus',      href: '/clients/new' },
  { id: 'qa-record-pay',   label: 'Record a payment', icon: 'Wallet',        href: '/payments?new=1' },
  { id: 'qa-mark-att',     label: 'Mark attendance',  icon: 'ClipboardList', href: '/attendance' },
  { id: 'qa-add-trainer',  label: 'Add coach',        icon: 'UserCog',       href: '/trainers?new=1', role: 'admin' as Role },
  { id: 'qa-face-checkin', label: 'Face check-in',    icon: 'ScanFace',      href: '/checkin' },
  { id: 'qa-add-enquiry',  label: 'Add enquiry',      icon: 'PlusCircle',    href: '/sales/enquiry' },
];

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
export function allNavItems(): Array<NavItem & { groupId: string; groupLabel: string }> {
  const out: Array<NavItem & { groupId: string; groupLabel: string }> = [];
  out.push({ ...DASHBOARD_ITEM, groupId: 'dashboard', groupLabel: 'Dashboard' });
  for (const g of NAV_GROUPS) {
    for (const it of g.items) out.push({ ...it, groupId: g.id, groupLabel: g.label });
  }
  for (const it of SETTINGS_GROUP.items) out.push({ ...it, groupId: SETTINGS_GROUP.id, groupLabel: SETTINGS_GROUP.label });
  return out;
}

export function findItemByPath(pathname: string): (NavItem & { groupId: string; groupLabel: string }) | null {
  const all  = allNavItems();
  const path = pathname.split('?')[0];
  const exact = all.find((i) => i.href.split('?')[0] === path);
  if (exact) return exact;
  const prefix = all.find((i) => i.matchPrefix && path.startsWith(i.matchPrefix));
  if (prefix) return prefix;
  return all.find((i) => !i.matchPrefix && path.startsWith(i.href.split('?')[0] + '/')) ?? null;
}

export function isVisibleForRole(item: NavItem, userRole?: string): boolean {
  if (item.hidden) return false;
  if (item.roles?.length) return !!userRole && (item.roles as string[]).includes(userRole);
  if (item.role)          return userRole === item.role;
  return true;
}
