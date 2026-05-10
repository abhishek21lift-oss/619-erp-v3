// src/lib/nav-config.ts
//
// Single source of truth for navigation. Sidebar, breadcrumbs and the
// command palette all consume this. IA principle: groups organised by
// job-to-be-done (lifecycle: Sales → Members → Training → Attendance →
// Memberships → Finance → Insights → Engagement), with a top-level
// Dashboard above the groups and a Settings group rendered below the
// divider.
//
// Icons are intentionally kept as plain string glyphs so existing
// consumers (CommandPalette, Breadcrumbs) keep working without a type
// migration. Swap to lucide components in a later polish pass if desired.

export type Role = 'admin' | 'manager' | 'reception' | 'trainer' | 'member';

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Restrict to a specific role (legacy single-role check). */
  role?: Role;
  /** Restrict to one of several roles. Takes precedence over `role` if set. */
  roles?: Role[];
  /** Hide from sidebar but keep in breadcrumb registry (e.g. detail pages). */
  hidden?: boolean;
  /** Match this href as parent for /<path>/<id>-style routes. */
  matchPrefix?: string;
  /** Key that the BadgeProvider resolves to a count. Optional. */
  badge?: string;
  /** Show a small "NEW" pill next to the label. */
  isNew?: boolean;
  /** Render but disable click. */
  comingSoon?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
};

/**
 * The single Dashboard link is rendered ABOVE the groups (no "Home" header).
 * Sidebar.tsx renders this first, then the groups below.
 */
export const DASHBOARD_ITEM: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: '▦',
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'sales',
    label: 'Sales',
    icon: '◇',
    items: [
      { href: '/sales/leads',    label: 'Lead Inbox',          icon: '↘', role: 'admin', badge: 'leadsCount' },
      { href: '/sales/enquiry',  label: 'Add Enquiry',         icon: '+' },
      { href: '/sales/follow',   label: 'Follow-Ups',          icon: '↻', badge: 'followupsToday' },
      { href: '/sales/funnel',   label: 'Conversion Funnel',   icon: '▼', role: 'admin' },
      { href: '/sales/sources',  label: 'Lead Sources',        icon: '◎', role: 'admin' },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    icon: '◉',
    items: [
      { href: '/clients',                label: 'All Members',     icon: '◉' },
      { href: '/members/active',         label: 'Active',          icon: '✓' },
      { href: '/members/expiring',       label: 'Expiring Soon',   icon: '⚠', badge: 'expiringCount' },
      { href: '/members/lapsed',         label: 'Lapsed',          icon: '◐' },
      { href: '/members/birthdays',      label: 'Birthdays',       icon: '✦', badge: 'birthdaysToday' },
      { href: '/members/referrals',      label: 'Referrals',       icon: '♡', isNew: true },
      { href: '/clients/new',            label: 'Add Member',      icon: '+' },
      { href: '/clients/[id]',           label: 'Member Profile',  icon: '◉', hidden: true, matchPrefix: '/clients/' },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    icon: '⚒',
    items: [
      { href: '/trainers',                  label: 'Coaches',          icon: '⚒', role: 'admin' },
      { href: '/trainer/dashboard',         label: 'Coach Dashboard',  icon: '▤', role: 'trainer' },
      { href: '/trainers/leave',            label: 'Leave Requests',   icon: '🗓', role: 'admin', badge: 'pendingLeaves', isNew: true },
      { href: '/training/transformations',  label: 'Transformations',  icon: '↑', role: 'admin' },
      { href: '/training/targets',          label: 'Trainer Targets',  icon: '🎯', role: 'admin', isNew: true },
      { href: '/trainers/[id]',             label: 'Coach Profile',    icon: '⚒', hidden: true, matchPrefix: '/trainers/' },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: '◧',
    items: [
      { href: '/checkin',                label: 'Face Check-In',     icon: '◎' },
      { href: '/attendance',             label: 'Member Attendance', icon: '◧' },
      { href: '/attendance/staff',       label: 'Staff Attendance',  icon: '✦', role: 'admin' },
      { href: '/operations/leaderboard', label: 'Leaderboard',       icon: '★' },
      { href: '/attendance/reports',     label: 'Reports',           icon: '📊', role: 'admin', isNew: true },
    ],
  },
  {
    id: 'memberships',
    label: 'Memberships',
    icon: '💳',
    items: [
      { href: '/memberships/plans',         label: 'Plans',         icon: 'P', role: 'admin', isNew: true },
      { href: '/memberships/subscriptions', label: 'Subscriptions', icon: 'S' },
      { href: '/appointments',              label: 'Appointments',  icon: '📅', isNew: true },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '₹',
    items: [
      { href: '/payments',                label: 'Payments',         icon: '◈' },
      { href: '/finance/dues',            label: 'Outstanding Dues', icon: '◔', badge: 'duesCount' },
      { href: '/finance/collection',      label: 'Collection',       icon: '↗', role: 'admin' },
      { href: '/finance/pl',              label: 'Profit & Loss',    icon: '⊞', role: 'admin' },
      { href: '/finance/payroll',         label: 'Payroll',          icon: '💼', role: 'admin', isNew: true },
      { href: '/finance/expenses',        label: 'Expenses',         icon: '💸', role: 'admin', isNew: true },
      { href: '/finance/forecast',        label: 'Revenue Forecast', icon: '◌', role: 'admin' },
      { href: '/finance/trainer-revenue', label: 'Trainer Revenue',  icon: '🎯', role: 'admin' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: '↗',
    items: [
      { href: '/reports',           label: 'All Reports',         icon: '↗' },
      { href: '/insights/traffic',  label: 'Footfall Traffic',    icon: '⇋', role: 'admin' },
      { href: '/insights/renewal',  label: 'Renewal Analysis',    icon: '↻', role: 'admin' },
      { href: '/insights/sessions', label: 'Session Utilisation', icon: '◔' },
      { href: '/insights/members',  label: 'Member Analytics',    icon: '📈', role: 'admin', isNew: true },
      { href: '/insights/billing',  label: 'Billing Analysis',    icon: '🧾', role: 'admin', isNew: true },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    icon: '📣',
    items: [
      { href: '/engagement/overview',      label: 'Overview',       icon: 'O', role: 'admin', isNew: true },
      { href: '/engagement/members',       label: 'Member Engagement', icon: 'M', role: 'admin', isNew: true },
      { href: '/engagement/campaigns',     label: 'Campaigns',      icon: 'C', role: 'admin', isNew: true },
      { href: '/engagement/email',         label: 'Email Campaigns', icon: 'E', role: 'admin', isNew: true },
      { href: '/engagement/push',          label: 'Push Notifications', icon: 'P', role: 'admin', isNew: true },
      { href: '/engagement/offers',        label: 'Offers & Promotions', icon: '%', role: 'admin', isNew: true },
      { href: '/engagement/loyalty',       label: 'Loyalty Program', icon: 'L', role: 'admin', isNew: true },
      { href: '/engagement/rewards',       label: 'Rewards',        icon: 'R', role: 'admin', isNew: true },
      { href: '/engagement/feedback',      label: 'Feedback',       icon: 'F', role: 'admin', isNew: true },
      { href: '/engagement/polls',         label: 'Polls & Surveys', icon: 'S', role: 'admin', isNew: true },
      { href: '/engagement/reviews',       label: 'Reviews & Ratings', icon: '*', role: 'admin', isNew: true },
      { href: '/engagement/events',        label: 'Events',         icon: 'V', role: 'admin', isNew: true },
      { href: '/engagement/social',        label: 'Social Engagement', icon: '@', role: 'admin', isNew: true },
      { href: '/engagement/retention',     label: 'Retention Analytics', icon: 'A', role: 'admin', isNew: true },
      { href: '/engagement/timeline',      label: 'Activity Timeline', icon: 'T', role: 'admin', isNew: true },
      { href: '/engagement/automated-follow-ups', label: 'Automated Follow-Ups', icon: 'U', role: 'admin', isNew: true },
      { href: '/engagement/lead-nurturing', label: 'Lead Nurturing', icon: 'N', role: 'admin', isNew: true },
      { href: '/engagement/wishes',        label: 'Birthday Wishes', icon: 'B', role: 'admin', isNew: true },
      { href: '/engagement/re-engagement', label: 'Re-engagement',  icon: 'G', role: 'admin', isNew: true },
      { href: '/engagement/conversion',    label: 'Conversion Analytics', icon: 'K', role: 'admin', isNew: true },
      { href: '/engagement/notifications', label: 'Notifications',  icon: '🔔', isNew: true },
      { href: '/engagement/whatsapp',      label: 'WhatsApp',       icon: '💬', isNew: true },
      { href: '/engagement/sms',           label: 'SMS Campaigns',  icon: '✉', isNew: true },
      { href: '/engagement/balance',       label: 'SMS Balance',    icon: '💰', role: 'admin', isNew: true },
      { href: '/engagement/challenges',    label: 'Challenges',     icon: '🏆', isNew: true },
      { href: '/engagement/community',     label: 'Community',      icon: '🌐', isNew: true },
    ],
  },
];

/**
 * Settings group. Rendered separately below the divider in the sidebar.
 */
export const SETTINGS_ITEM: NavItem = {
  href: '/settings',
  label: 'Settings',
  icon: '⚙',
};

export const SETTINGS_GROUP: NavGroup = {
  id: 'settings',
  label: 'Settings',
  icon: '⚙',
  items: [
    { href: '/settings',              label: 'General',            icon: '⚙' },
    { href: '/settings/branches',     label: 'Branches',           icon: '🏢', role: 'admin', isNew: true },
    { href: '/settings/staff',        label: 'Staff & Access',     icon: '🪪', role: 'admin', isNew: true },
    { href: '/settings/biometric',    label: 'Biometric & Face',   icon: '🧬', role: 'admin', isNew: true },
    { href: '/settings/equipment',    label: 'Equipment',          icon: '🛠', role: 'admin', isNew: true },
    { href: '/settings/notices',      label: 'Notices & Rules',    icon: '📜', role: 'admin', isNew: true },
    { href: '/settings/billing',      label: 'GST / Invoice',      icon: '🧾', role: 'admin', isNew: true },
    { href: '/settings/branding',     label: 'Branding & App',     icon: '🖼', role: 'admin', isNew: true },
    { href: '/settings/measurements', label: 'Measurements',       icon: '📏', role: 'admin', isNew: true },
    { href: '/settings/workouts',     label: 'Workouts & Diet',    icon: '🍎', role: 'admin', isNew: true },
  ],
};

export function allNavItems(): Array<NavItem & { groupId: string; groupLabel: string }> {
  const out: Array<NavItem & { groupId: string; groupLabel: string }> = [];
  // Dashboard first (no group header)
  out.push({ ...DASHBOARD_ITEM, groupId: 'dashboard', groupLabel: 'Dashboard' });
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      out.push({ ...it, groupId: g.id, groupLabel: g.label });
    }
  }
  // Settings group last
  for (const it of SETTINGS_GROUP.items) {
    out.push({ ...it, groupId: SETTINGS_GROUP.id, groupLabel: SETTINGS_GROUP.label });
  }
  return out;
}

export function findItemByPath(
  pathname: string,
): (NavItem & { groupId: string; groupLabel: string }) | null {
  const items = allNavItems();
  const cleanPath = pathname.split('?')[0];
  const exact = items.find((i) => i.href.split('?')[0] === cleanPath);
  if (exact) return exact;
  const prefix = items.find((i) => i.matchPrefix && cleanPath.startsWith(i.matchPrefix));
  if (prefix) return prefix;
  const groupRoot = items.find(
    (i) => !i.matchPrefix && cleanPath.startsWith(i.href.split('?')[0] + '/'),
  );
  return groupRoot || null;
}

/**
 * Visibility helper. Used by Sidebar AND CommandPalette so role gating
 * is identical everywhere. Supports both `role` (single, legacy) and
 * `roles` (array, new).
 */
export function isVisibleForRole(item: NavItem, userRole: string | undefined): boolean {
  if (item.hidden) return false;
  if (item.roles && item.roles.length > 0) {
    return !!userRole && (item.roles as string[]).includes(userRole);
  }
  if (item.role) return userRole === item.role;
  return true;
}

export const QUICK_ACTIONS = [
  { id: 'qa-add-member',  label: 'Add new member',   icon: '+', href: '/clients/new',     role: 'admin' as const },
  { id: 'qa-record-pay',  label: 'Record a payment', icon: '◈', href: '/payments?new=1' },
  { id: 'qa-mark-att',    label: 'Mark attendance',  icon: '◧', href: '/attendance' },
  { id: 'qa-add-trainer', label: 'Add coach',        icon: '⚒', href: '/trainers?new=1',   role: 'admin' as const },
  { id: 'qa-face-checkin', label: 'Face check-in',   icon: '◎', href: '/checkin' },
];
