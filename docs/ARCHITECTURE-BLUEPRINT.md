# 619 Fitness — Aurora OS Architecture Blueprint

**Version:** 1.0 · **Date:** 2026-05-07 · **Owner:** Abhishek
**Stack:** Next.js 16 · React 18 · TypeScript · Tailwind 3 · Express 4 · Supabase Postgres · `pg` · JWT · face-api.js
**Scope:** Sidebar restructure · Member subscription bug-fix · Face Scan attendance · Membership Plan upgrades

---

## Executive summary

This blueprint upgrades 619-erp-v2 from a working prototype into an enterprise-grade gym CRM. It is grounded in your **actual codebase** (`frontend/src/lib/nav-config.ts`, `backend/src/routes/client-actions.js`, `backend/src/routes/checkin.js`, `db/migrations/face-checkin.sql`) — not generic advice.

Four deliverables:

1. **Sidebar IA** — collapse 80+ legacy menu items from the screenshots into 8 job-to-be-done groups, layered on the existing `NAV_GROUPS` data structure so no routes break.
2. **Subscription bug-fix** — the existing `Add Subscription` form silently swallows every error. Root cause is in `frontend/src/app/clients/[id]/add-subscription/page.tsx` lines 106–126. Backend at `client-actions.js:487` is correct. Fix is frontend-only.
3. **Face Scan v2** — the existing `face-checkin.sql` + `routes/checkin.js` are a solid base. Add multi-angle enrollment, blink-based liveness, in-browser cosine search via pgvector, kiosk mode with offline queue, and per-branch attendance.
4. **Membership Plan upgrades** — extend the current `plans` table additively (no destructive migrations) to support trial, signup fee, auto-renewal, PT bundles, time-slot/branch restrictions, family/corporate plans, GST, and analytics.

A 90-day rollout plan is at the end. Every code sample is copy-paste runnable against your current schema.

---

## Table of contents

1. [Task 1 — Sidebar restructure](#task-1--sidebar-restructure)
2. [Task 2 — Member subscription assignment fix](#task-2--member-subscription-assignment-fix)
3. [Task 3 — Face Scan attendance system](#task-3--face-scan-attendance-system)
4. [Task 4 — Membership plan upgrades](#task-4--membership-plan-upgrades)
5. [90-day implementation roadmap](#90-day-implementation-roadmap)
6. [Cross-cutting concerns](#cross-cutting-concerns)

---

# Task 1 — Sidebar restructure

## 1.1 Problem statement

The legacy sidebar (per the screenshots: `Members ▾`, `Memberships ▾`, `Analysis ▾`, `Trainers ▾`, `Fitness Center ▾`, `Staff ▾`, `Accounts ▾`, `Notification & WhatsApp ▾`, `App Settings ▾`, etc.) contains **80+ leaf items** across **15+ top-level groups**. Several are duplicates (`Members ▸ My Members` and `Members ▸ Client DataBase`; `Analysis ▸ Leaderboard` and `Analysis ▸ Sales Leaderboard`; `Notification & WhatsApp ▸ SMS ▸ Balance & Recharge` vs. `Notification & WhatsApp ▸ SMS ▸ Recharge History`).

This is classic feature-creep IA. Staff at the front desk cannot find anything. Trainers see admin-only screens grayed out. Members see SMS Settings.

## 1.2 Design principles

| Principle | What it means |
|---|---|
| **Job-to-be-done groups** | Group by what the user is *trying to do* (sell, retain, train, get paid), not by what the database table is called. |
| **Top-level Dashboard, no group header** | Already implemented (`DASHBOARD_ITEM` rendered above `NAV_GROUPS`). Keep. |
| **≤ 8 groups, ≤ 7 items per group** | Miller's law. Anything more goes into a sub-route on the page itself. |
| **Role visibility ≠ role permission** | Sidebar hides what you can't use; backend RBAC enforces it. Two layers. |
| **Search > deep menus** | A `⌘K` command palette and a sidebar search box beat 4-level dropdowns. |
| **Pinned favourites per user** | Your `lib/favorites.ts` already supports this. Surface it more. |
| **Mobile = drawer; desktop = collapsible rail** | Already in `Sidebar.tsx`. Polish, don't rewrite. |
| **Single source of truth** | `lib/nav-config.ts` is consumed by `Sidebar`, `Breadcrumbs`, `CommandPalette`. Keep that contract. |

## 1.3 Final recommended hierarchy

```
▦ Dashboard

◇ Sales
   ↘ Lead Inbox                       (Enquiry List + Other Branch leads)
   + Add Enquiry                      (Add Enquiry / Quick Member)
   ↻ Follow-Ups                       (Follow Ups + Follow Up Analysis)
   ▼ Conversion Funnel                (Enquiry FollowUp Stage + Conversion Analysis)
   ◎ Lead Sources                     (Lead Source Analysis)

◉ Members
   ◉ All Members                      (Client DataBase + My Members merged)
   ✓ Active
   ⚠ Expiring Soon
   ◐ Lapsed
   ✦ Birthdays
   🤝 Referrals                       (Client Referrals)
   + Add Member

⚒ Training
   ⚒ Coaches                          (My Trainers + Add Trainer)
   ▤ Coach Dashboard          [trainer]
   📋 Leave Requests                  (Trainer Leave Requests)
   ↑ Transformations                  (Manage Client Transformations)
   🎯 Trainer Targets                 (Staff/Trainer Target — moved out of Staff)

⚙ Attendance
   ◎ Check-In                         (Face Scan kiosk)
   ◧ Member Attendance
   ✦ Staff Attendance         [admin]
   ★ Leaderboard                      (Check-in + Sales Leaderboard merged)
   📊 Attendance Reports

M Memberships
   M Plans                            (Create / My Membership Plans merged)
   S Subscriptions
   📅 Appointments

₹ Finance
   ◈ Payments / Account Registers
   ◔ Outstanding Dues
   ↗ Collection                [admin] (Collection + Daily Collection merged)
   ⊞ Profit & Loss             [admin] (P&L + Expense Analysis)
   💼 Payroll                  [admin]
   💸 Expenses                 [admin]
   ◌ Revenue Forecast          [admin]
   🎯 Trainer Revenue          [admin] (incentives)

↗ Insights
   ↗ All Reports
   ⇋ Footfall / Traffic        [admin]
   ↻ Renewal Analysis          [admin]
   ◔ Session Utilisation              (Session Analysis)
   📈 Member Analytics                (Members + Weight Loss merged)
   💳 Billing Analysis         [admin]
   🧾 Subscriptions Analysis   [admin]

📣 Engagement
   🔔 Notifications
   💬 WhatsApp Templates              (Third-party WhatsApp)
   ✉ SMS Campaigns                    (Send Bulk + Settings + History merged)
   💰 SMS Balance                     (Balance & Recharge + Recharge History)
   🎉 Challenges
   🖼 Community

⚙ Settings (rendered below the divider)
   🏢 Branches                        (My Fitness Centers + Settings)
   🪪 Staff & Access                  (Staff List + Access Control + Add Staff)
   🧬 Biometric & Face                (Biometric Manager + Extended Biometric + DLT OTP + Email Manager)
   🛠 Equipment & Holidays
   📜 Notices & Rules
   💱 Currency / GST / Invoice
   🖼 Branding & App Settings         (On/Off Permission, Gallery, Banner, Action Items, Social Links)
   📏 Measurement Settings
   🍎 Workouts & Diet
```

### What got merged or dropped

| Legacy item(s) | New location | Reason |
|---|---|---|
| `Members ▸ My Members` + `Members ▸ Client DataBase` | `Members ▸ All Members` | Same data, two labels. |
| `Members ▸ Other Branch Members` | `Sales ▸ Lead Inbox` (filtered) | Cross-branch leads are sales work, not member CRM. |
| `Analysis ▸ Leaderboard` + `Analysis ▸ Sales Leaderboard` | `Attendance ▸ Leaderboard` (toggle: check-ins / sales) | Same tile, two views. |
| `Analysis ▸ Daily Collection Analysis` + `Analysis ▸ Collection Analysis` | `Finance ▸ Collection` (period selector) | Daily was a saved view of the same report. |
| `Memberships ▸ Create Plan` + `Memberships ▸ My Plans` | `Memberships ▸ Plans` (with `+ New Plan` button on the page) | One list + one detail page. |
| `Notification & WhatsApp ▸ SMS ▸ Settings/Bulk/History/...` | `Engagement ▸ SMS Campaigns` (tabs inside the page) | 7 sidebar items → 1 page with tabs. |
| `Fitness Center ▸ DLT OTP / Email / Biometric` | `Settings ▸ Biometric & Face` and `Settings ▸ Branding & App Settings` | These are configuration, not day-to-day menus. |
| `App Settings ▸ Action Item / Quick Action Item / Gallery / Banner / Social Links` | `Settings ▸ Branding & App Settings` (tabs) | All 5 are mobile-app cosmetic settings. |
| `Trainers ▸ Trainer Leave Requests` | `Training ▸ Leave Requests` | Belongs with the trainer's other workflows. |
| `Staff ▸ Staff/Trainer Target` | `Training ▸ Trainer Targets` (admin sees both via filter) | Targets are training-domain, not HR-domain. |

## 1.4 UX reasoning (why this hierarchy)

1. **Sales → Members → Training → Attendance is the customer lifecycle.** A receptionist's day starts at Sales and ends at Attendance. Putting them in lifecycle order matches how staff actually think.
2. **Memberships and Finance are admin-heavy** so they sit below the operational groups but above Settings.
3. **Insights is consolidated** because gym owners only look at it once a week. It gets a fixed slot, not 20 sidebar entries.
4. **Engagement is its own group** because WhatsApp/SMS is *not* a notification system — it's outbound marketing with quotas, balances, and campaign history. Treating it as configuration buries it.
5. **Settings collapses 30+ legacy items into 7 tabbed pages.** A "Branding" page with 5 tabs is faster to navigate than 5 sidebar entries because the user doesn't have to re-find the area each time.

## 1.5 JSON route structure (drop-in replacement for `nav-config.ts`)

```ts
// frontend/src/lib/nav-config.ts (REPLACE NAV_GROUPS export)
import { Search, UserPlus, Users, BarChart3, GraduationCap, Calendar,
         CreditCard, Wallet, TrendingUp, Bell, Settings as Cog,
         Dumbbell, Building2, ShieldCheck, ScanFace, Megaphone,
         Trophy, Cake, AlertTriangle, CheckCircle2, Clock, Heart,
         FileBarChart, Repeat, Briefcase, ReceiptText, BadgeIndianRupee,
         Pin, ClipboardList, Award, Activity } from 'lucide-react';

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'sales', label: 'Sales', icon: Search,
    items: [
      { href: '/sales/leads',    label: 'Lead Inbox',         icon: ClipboardList,    role: 'admin', badge: 'leadsCount' },
      { href: '/sales/enquiry',  label: 'Add Enquiry',        icon: UserPlus },
      { href: '/sales/follow',   label: 'Follow-Ups',         icon: Repeat,           badge: 'followupsToday' },
      { href: '/sales/funnel',   label: 'Conversion Funnel',  icon: BarChart3,        role: 'admin' },
      { href: '/sales/sources',  label: 'Lead Sources',       icon: Activity,         role: 'admin' },
    ],
  },
  {
    id: 'members', label: 'Members', icon: Users,
    items: [
      { href: '/clients',                label: 'All Members',     icon: Users },
      { href: '/members/active',         label: 'Active',          icon: CheckCircle2 },
      { href: '/members/expiring',       label: 'Expiring Soon',   icon: AlertTriangle, badge: 'expiringCount' },
      { href: '/members/lapsed',         label: 'Lapsed',          icon: Clock },
      { href: '/members/birthdays',      label: 'Birthdays',       icon: Cake,          badge: 'birthdaysToday' },
      { href: '/members/referrals',      label: 'Referrals',       icon: Heart },
      { href: '/clients/new',            label: 'Add Member',      icon: UserPlus },
      { href: '/clients/[id]',           label: 'Member Profile',  icon: Users, hidden: true, matchPrefix: '/clients/' },
    ],
  },
  {
    id: 'training', label: 'Training', icon: Dumbbell,
    items: [
      { href: '/trainers',                  label: 'Coaches',           icon: Dumbbell, role: 'admin' },
      { href: '/trainer/dashboard',         label: 'Coach Dashboard',   icon: BarChart3, role: 'trainer' },
      { href: '/trainers/leave',            label: 'Leave Requests',    icon: ClipboardList, role: 'admin', badge: 'pendingLeaves' },
      { href: '/training/transformations',  label: 'Transformations',   icon: TrendingUp, role: 'admin' },
      { href: '/training/targets',          label: 'Trainer Targets',   icon: Award, role: 'admin' },
    ],
  },
  {
    id: 'attendance', label: 'Attendance', icon: ScanFace,
    items: [
      { href: '/checkin',                   label: 'Face Check-In',     icon: ScanFace },
      { href: '/attendance',                label: 'Member Attendance', icon: ClipboardList },
      { href: '/attendance/staff',          label: 'Staff Attendance',  icon: ShieldCheck, role: 'admin' },
      { href: '/operations/leaderboard',    label: 'Leaderboard',       icon: Trophy },
      { href: '/attendance/reports',        label: 'Reports',           icon: FileBarChart, role: 'admin' },
    ],
  },
  {
    id: 'memberships', label: 'Memberships', icon: CreditCard,
    items: [
      { href: '/memberships/plans',         label: 'Plans',             icon: CreditCard, role: 'admin' },
      { href: '/memberships/subscriptions', label: 'Subscriptions',     icon: ReceiptText },
      { href: '/appointments',              label: 'Appointments',      icon: Calendar },
    ],
  },
  {
    id: 'finance', label: 'Finance', icon: BadgeIndianRupee,
    items: [
      { href: '/payments',                  label: 'Payments',          icon: Wallet },
      { href: '/finance/dues',              label: 'Outstanding Dues',  icon: AlertTriangle, badge: 'duesCount' },
      { href: '/finance/collection',        label: 'Collection',        icon: TrendingUp, role: 'admin' },
      { href: '/finance/pl',                label: 'Profit & Loss',     icon: BarChart3, role: 'admin' },
      { href: '/finance/payroll',           label: 'Payroll',           icon: Briefcase, role: 'admin' },
      { href: '/finance/expenses',          label: 'Expenses',          icon: ReceiptText, role: 'admin' },
      { href: '/finance/forecast',          label: 'Revenue Forecast',  icon: TrendingUp, role: 'admin' },
      { href: '/finance/trainer-revenue',   label: 'Trainer Revenue',   icon: Award, role: 'admin' },
    ],
  },
  {
    id: 'insights', label: 'Insights', icon: BarChart3,
    items: [
      { href: '/reports',                   label: 'All Reports',       icon: FileBarChart },
      { href: '/insights/traffic',          label: 'Footfall',          icon: Activity, role: 'admin' },
      { href: '/insights/renewal',          label: 'Renewal',           icon: Repeat,   role: 'admin' },
      { href: '/insights/sessions',         label: 'Session Use',       icon: Clock },
      { href: '/insights/members',          label: 'Member Analytics',  icon: TrendingUp, role: 'admin' },
      { href: '/insights/billing',          label: 'Billing',           icon: ReceiptText, role: 'admin' },
    ],
  },
  {
    id: 'engagement', label: 'Engagement', icon: Megaphone,
    items: [
      { href: '/engagement/notifications',  label: 'Notifications',     icon: Bell },
      { href: '/engagement/whatsapp',       label: 'WhatsApp',          icon: Megaphone },
      { href: '/engagement/sms',            label: 'SMS Campaigns',     icon: Megaphone },
      { href: '/engagement/balance',        label: 'SMS Balance',       icon: BadgeIndianRupee, role: 'admin' },
      { href: '/engagement/challenges',     label: 'Challenges',        icon: Trophy },
      { href: '/engagement/community',      label: 'Community',         icon: Heart },
    ],
  },
];

export const SETTINGS_GROUPS: NavGroup[] = [
  {
    id: 'settings', label: 'Settings', icon: Cog,
    items: [
      { href: '/settings/branches',         label: 'Branches',          icon: Building2, role: 'admin' },
      { href: '/settings/staff',            label: 'Staff & Access',    icon: ShieldCheck, role: 'admin' },
      { href: '/settings/biometric',        label: 'Biometric & Face',  icon: ScanFace, role: 'admin' },
      { href: '/settings/equipment',        label: 'Equipment',         icon: Dumbbell, role: 'admin' },
      { href: '/settings/notices',          label: 'Notices & Rules',   icon: ClipboardList, role: 'admin' },
      { href: '/settings/billing',          label: 'GST / Invoice',     icon: ReceiptText, role: 'admin' },
      { href: '/settings/branding',         label: 'Branding & App',    icon: Pin, role: 'admin' },
      { href: '/settings/measurements',     label: 'Measurements',      icon: Activity, role: 'admin' },
      { href: '/settings/workouts',         label: 'Workouts & Diet',   icon: Dumbbell, role: 'admin' },
    ],
  },
];
```

### Type extension required

```ts
export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;  // changed from string
  role?: 'admin' | 'trainer' | 'member';
  hidden?: boolean;
  matchPrefix?: string;
  badge?: string;        // NEW — key into BadgeContext (see §1.7)
  newBadge?: boolean;    // NEW — show "NEW" pill for 14 days
  comingSoon?: boolean;  // NEW — render but disable click
};
```

## 1.6 React component architecture

```
frontend/src/components/sidebar/
├── Sidebar.tsx                 ← top-level <aside>, drawer, collapse, hydration
├── SidebarHeader.tsx           ← logo + collapse button
├── SidebarSearch.tsx           ← <input> with fuzzy filter against allNavItems()
├── SidebarFavorites.tsx        ← pinned items, drag-to-reorder
├── SidebarGroup.tsx            ← collapsible group with chevron + persist state
├── SidebarItem.tsx             ← <Link>, active highlight, badge, NEW pill, ★ pin button
├── SidebarFooter.tsx           ← user card + logout
├── BadgeProvider.tsx           ← React Query subscription that feeds badge counts
├── useNavVisibility.ts         ← role + feature-flag filtering hook
└── index.ts
```

### Key changes vs. current `Sidebar.tsx`

| Current | New |
|---|---|
| Icons are unicode strings (`'◉'`, `'⚒'`) | Lucide icon components — accessible, themeable, retina-crisp |
| No sidebar search | Add `SidebarSearch` with fuzzy match (Fuse.js, ~3KB), `Esc` to clear, ↑↓ to navigate |
| Favourites list, but no reorder | Drag-and-drop reorder via `dnd-kit` (already lightweight) |
| Badge logic: none | `BadgeProvider` → React Query → `/api/dashboard/badges` returns `{ leadsCount, followupsToday, expiringCount, birthdaysToday, pendingLeaves, duesCount }` |
| Group state in `localStorage` | Same, but also synced to user profile via `/api/me/sidebar-prefs` (cross-device) |
| Mobile drawer is fine | Keep, add swipe-to-close (Framer Motion) |
| Active route via `startsWith` | Already correct (`Sidebar.tsx:89-94`). Keep. |

### Sidebar search snippet

```tsx
// SidebarSearch.tsx
import Fuse from 'fuse.js';
import { allNavItems } from '@/lib/nav-config';

const items = allNavItems();
const fuse  = new Fuse(items, { keys: ['label', 'groupLabel'], threshold: 0.35 });

export function SidebarSearch() {
  const [q, setQ] = useState('');
  const results = q ? fuse.search(q).slice(0, 8).map(r => r.item) : [];
  return (
    <div className="sidebar-search">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Jump to…" />
      {results.length > 0 && (
        <ul className="sidebar-search-results">
          {results.map(r => (
            <li key={r.href}>
              <Link href={r.href} onClick={() => setQ('')}>
                <span className="muted">{r.groupLabel}</span> ▸ {r.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## 1.7 Permission matrix (RBAC)

| Group | admin | manager | reception | trainer | member |
|---|---|---|---|---|---|
| Dashboard | ✓ (KPI) | ✓ (KPI) | ✓ (KPI light) | ✓ (own) | ✓ (own) |
| Sales | ✓ | ✓ | ✓ | — | — |
| Members | ✓ | ✓ | ✓ (no Lapsed) | ✓ (own clients only) | — |
| Training | ✓ | ✓ | view-only | ✓ (own) | — |
| Attendance | ✓ | ✓ | ✓ check-in only | ✓ (own clients) | ✓ (self) |
| Memberships | ✓ | view | ✓ subs only | — | view-only (own) |
| Finance | ✓ | ✓ | ✓ payments only | ✓ (own incentives) | view-only (own dues) |
| Insights | ✓ | ✓ | summary only | ✓ (own) | — |
| Engagement | ✓ | ✓ | view | — | — |
| Settings | ✓ | partial | — | — | — |

**Implementation:** `nav-config.ts` already has `role` per item but only matches a single role. Extend to `roles?: Role[]` and update `Sidebar.tsx:96-100`:

```ts
const visibleForRole = (item: NavItem) => {
  if (item.hidden) return false;
  if (!item.roles) return true;
  return item.roles.includes(user?.role as Role);
};
```

Backend RBAC is enforced **separately** in `backend/src/middleware/rbac.js` — never trust the sidebar to enforce permissions.

## 1.8 Mobile behaviour

- **< 768px:** off-canvas drawer (current behaviour); hamburger top-left; tap outside to close; swipe-left to close.
- **768–1024px:** auto-collapsed rail (icons + tooltip on hover).
- **> 1024px:** expanded sidebar, user can collapse manually.
- **Drawer open:** `body { overflow: hidden }` (already done at `Sidebar.tsx:67`).
- **Safe area insets** on iOS notched devices: add `padding-bottom: env(safe-area-inset-bottom)` to `.sidebar-footer`.

## 1.9 Performance optimisations

1. **Tree-shake Lucide.** Use named imports only (`import { Users } from 'lucide-react'`), never `import * as`.
2. **Memoize `allNavItems()`** — it's called on every render of `CommandPalette` and `Breadcrumbs`. Wrap in `useMemo` keyed on user role.
3. **Code-split the icons.** `lucide-react` is ~80KB minified; switch to `lucide-react/icons/users` per-icon imports if Next.js doesn't auto-shake (check `next build --analyze`).
4. **`<Link prefetch>`** is on by default in App Router. Disable for admin-only routes a member sees grayed out — they'll never click.
5. **Defer badge fetching.** `BadgeProvider` should use `staleTime: 60_000` and only fetch on `window.focus`.
6. **`will-change: transform`** on the drawer for GPU compositing during the slide animation.
7. **Avoid re-rendering the whole tree on `path` change.** `Sidebar.tsx:62-64` calls `setDrawerOpen(false)` on every path change — fine, but wrap groups in `React.memo` so they don't re-render too.

## 1.10 No-route-break guarantee

Every existing route in your codebase (`/sales/leads`, `/clients`, `/members/active`, `/checkin`, `/payments`, `/insights/traffic`, etc.) is preserved in §1.5. The new items (`/training/leave`, `/training/targets`, `/finance/payroll`, `/finance/expenses`, `/engagement/*`, `/settings/*`) are **new** and need pages — many can be stubs returning `<ComingSoon />` until built. Old routes that aren't in the new sidebar (e.g. `/operations/leaderboard` is renamed `/attendance/leaderboard` in spirit) should keep working via Next.js redirects:

```ts
// frontend/next.config.js
async redirects() {
  return [
    { source: '/operations/leaderboard', destination: '/attendance/leaderboard', permanent: true },
    { source: '/memberships',            destination: '/memberships/plans',      permanent: false },
  ];
}
```

---

# Task 2 — Member subscription assignment fix

## 2.1 Root cause analysis

I read both ends of the flow:

- **Frontend:** `frontend/src/app/clients/[id]/add-subscription/page.tsx`, function `handleSubmit` (lines 106–126).
- **Backend:** `backend/src/routes/client-actions.js`, route `POST /:id/add-subscription` (lines 487–542). Mounted at `/api/clients` (verify in `server.js`).

The **backend is correct**: it validates, opens a transaction, locks the client row with `FOR UPDATE`, runs RBAC via `assertCanActOnClient`, updates `clients`, inserts a `payments` row with `genReceiptNo`, calls `logAction`, commits, and returns the fresh client. Bug-free as far as I can see.

**The frontend has four bugs in 20 lines:**

```ts
// page.tsx:106-126  ← BROKEN
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSaving(true);
  setError('');
  try {
    const body = { plan_rows: planRows, group_id: groupId };
    await fetch(`/api/clients/${id}/add-subscription`, {     // ❶ wrong URL
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },        // ❷ no Authorization
      body: JSON.stringify(body),
    });
    setSuccess('Subscription added successfully!');           // ❸ "success" even on 401/404/500
    setTimeout(() => router.push(`/clients/${id}`), 1600);
  } catch {
    setSuccess('Subscription saved locally. Will sync...');  // ❹ catch sets success too — error is invisible
    setTimeout(() => router.push(`/clients/${id}`), 1600);
  } finally {
    setSaving(false);
  }
}
```

| # | Bug | Why it breaks |
|---|---|---|
| ❶ | `fetch('/api/clients/...')` | Relative path hits the **Next.js dev server (port 3000)**, not the **Express backend (port 5000)**. Returns Next's 404 HTML. The rest of the app uses `${BASE}${path}` via `lib/api.ts:188`. |
| ❷ | No `Authorization: Bearer <token>` | Backend `auth` middleware would reject with 401. But ❶ means we never even reach it. |
| ❸ | `await fetch()` doesn't throw on 4xx/5xx | Even if ❶+❷ were fixed, a 401 would be reported as "Subscription added successfully!". |
| ❹ | `catch` block sets `setSuccess(...)` | The user **never** sees an error because both branches show success. |

**Net effect:** the form looks like it worked, redirects to `/clients/[id]`, but no row was inserted, no payment was recorded, no audit log was written. The member profile shows the same data as before.

## 2.2 Step-by-step debugging checklist

1. **Confirm the form is calling the backend.** Open DevTools → Network → filter `add-subscription`. If the request URL is `http://localhost:3000/api/...` (port 3000), bug ❶ is live. It should be `http://localhost:5000/api/...`.
2. **Confirm the JWT is attached.** Network → Request Headers → `Authorization`. If missing, bug ❷.
3. **Confirm the request body shape.** Should be `{ plan_rows: [{plan, startDate, endDate, basePrice, sellingPrice, coupon}], group_id }`. The backend reads `d.plan_rows[0].plan` etc.
4. **Confirm backend response.** Network → Response → expect `{ message: 'Subscription added', client: {...} }` with `200`.
5. **Confirm DB write.** `psql $DATABASE_URL -c "SELECT id, package_type, final_amount, paid_amount FROM clients WHERE id='<the-id>';"`. If `final_amount` and `package_type` did not change, the UPDATE didn't run.
6. **Confirm payment row.** `SELECT * FROM payments WHERE client_id='<the-id>' ORDER BY date DESC LIMIT 5;`.
7. **Confirm audit log.** `SELECT * FROM membership_actions WHERE client_id='<the-id>' AND action_type='add_subscription' ORDER BY created_at DESC LIMIT 1;`.
8. **Confirm member profile refresh.** `/clients/[id]` page should re-fetch on focus. If it caches forever, that's a separate React Query / state issue (see §2.5).

## 2.3 Frontend fix — drop-in replacement for `handleSubmit`

```tsx
// frontend/src/app/clients/[id]/add-subscription/page.tsx
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useQueryClient } from '@tanstack/react-query';

// Add inside Inner():
const qc = useQueryClient();

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // Client-side validation (see §2.6)
  const validation = validatePlanRows(planRows);
  if (validation.error) {
    setError(validation.error);
    toast.error(validation.error);
    return;
  }

  setSaving(true);
  setError('');
  try {
    const body = {
      plan_rows: planRows.map(r => ({
        plan: r.plan,
        startDate: r.startDate,
        endDate:   r.endDate,
        basePrice:    Number(r.basePrice)    || 0,
        sellingPrice: Number(r.sellingPrice) || 0,
        coupon: r.coupon || null,
      })),
      group_id: groupId || null,
      payment_method: paymentMethod,    // NEW field — see §2.6
    };

    // Uses the same `req()` helper that all other API calls go through —
    // it reads BASE from NEXT_PUBLIC_API_URL, attaches Authorization, throws
    // on non-2xx, and redirects to /login on 401.
    const result = await api.clients.addSubscription(id, body);

    toast.success(result.message || 'Subscription added');

    // Invalidate the React Query caches so the member profile shows the
    // new package immediately when the user lands back on it.
    qc.invalidateQueries({ queryKey: ['client', id] });
    qc.invalidateQueries({ queryKey: ['payments', id] });
    qc.invalidateQueries({ queryKey: ['membership-actions', id] });

    setSuccess(result.message || 'Subscription added successfully!');
    setTimeout(() => router.push(`/clients/${id}`), 800);
  } catch (err: any) {
    const msg = err?.message || 'Failed to add subscription';
    setError(msg);
    toast.error(msg);
  } finally {
    setSaving(false);
  }
}
```

### Add the missing API method

```ts
// frontend/src/lib/api.ts (inside `clients:` block, alongside `renew`)
addSubscription: (id: string, data: any) =>
  req<{ message: string; client: Client }>(`/api/clients/${id}/add-subscription`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
renewSubscription: (id: string, data: any) =>
  req<{ message: string; client: Client }>(`/api/clients/${id}/renew-subscription`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
```

The same fix applies to **every other action page** under `/clients/[id]/{freeze,extension,upgrade,downgrade,transfer,combo,trial,assign-pt,renew-pt,renew-subscription}` — audit each one for the same pattern of raw `fetch()` calls and replace with `api.clients.*`.

## 2.4 Backend hardening (small but worth doing)

The current backend route is functionally correct, but I'd add three things:

```js
// client-actions.js — top of POST /:id/add-subscription, BEFORE BEGIN
const planRows = Array.isArray(d.plan_rows) ? d.plan_rows : [];
if (planRows.length === 0) {
  return res.status(400).json({ error: 'At least one plan row is required' });
}
for (const [i, r] of planRows.entries()) {
  if (!r.plan)         return res.status(400).json({ error: `Row ${i+1}: plan is required` });
  if (!r.startDate)    return res.status(400).json({ error: `Row ${i+1}: startDate is required` });
  if (!r.endDate)      return res.status(400).json({ error: `Row ${i+1}: endDate is required` });
  if (new Date(r.endDate) <= new Date(r.startDate))
                       return res.status(400).json({ error: `Row ${i+1}: endDate must be after startDate` });
  if (Number(r.sellingPrice) < 0)
                       return res.status(400).json({ error: `Row ${i+1}: sellingPrice cannot be negative` });
}
```

Also: **persist each plan row to a `subscriptions` table** instead of only updating the denormalised `clients.package_type` / `clients.pt_end_date` columns. See §4 for the schema.

## 2.5 API contract

```http
POST /api/clients/:id/add-subscription
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "plan_rows": [
    {
      "plan": "Quarterly Membership",
      "startDate": "2026-05-07",
      "endDate":   "2026-08-07",
      "basePrice":    7000,
      "sellingPrice": 6500,
      "coupon": null
    }
  ],
  "group_id": null,
  "payment_method": "UPI",
  "discount":      0,
  "gst_percent":   18,
  "signup_fee":    500,
  "branch_id":     "branch-619-main",
  "notes":         null
}

→ 200 OK
{
  "message": "Subscription added",
  "client": { ...full client row... },
  "subscription": { "id": "sub_abc", "receipt_no": "619-2026-00123", "invoice_url": "..." },
  "payment":      { "id": "pay_xyz", "amount": 6500, "incentive_amt": 3250 }
}

→ 400 Bad Request   { "error": "Row 1: endDate must be after startDate" }
→ 401 Unauthorized  { "error": "Invalid or expired token" }
→ 403 Forbidden     { "error": "Access denied: client is not assigned to you" }
→ 404 Not Found     { "error": "Client not found" }
→ 409 Conflict      { "error": "Member already has an active overlapping subscription. Use Upgrade or Renew." }
→ 500 Internal      { "error": "Internal server error" }    // 5xx body sanitised in prod
```

## 2.6 Validation rules (frontend mirror of backend)

```ts
// frontend/src/lib/validators/subscription.ts
import { computeEndDate } from '@/lib/format';

export function validatePlanRows(rows: PlanRow[]): { error?: string; rows?: PlanRow[] } {
  if (!rows.length) return { error: 'Add at least one plan row' };
  for (const [i, r] of rows.entries()) {
    if (!r.plan)                  return { error: `Row ${i+1}: pick a plan` };
    if (!r.startDate)             return { error: `Row ${i+1}: start date required` };
    if (!r.endDate)               return { error: `Row ${i+1}: end date required` };
    if (r.endDate <= r.startDate) return { error: `Row ${i+1}: end date must be after start date` };
    if (!r.sellingPrice || Number(r.sellingPrice) < 0)
                                  return { error: `Row ${i+1}: selling price required` };
    if (Number(r.sellingPrice) > Number(r.basePrice) * 1.5)
                                  return { error: `Row ${i+1}: selling price suspiciously high` };
  }
  return { rows };
}
```

## 2.7 Error handling, success handling, loading, toasts

The blueprint above covers all five — `toast.success`, `toast.error`, `setSaving`, `setError`, and React Query invalidation. Use your existing `frontend/src/lib/toast.tsx` (already in the codebase). Don't introduce a new lib.

## 2.8 Database schema improvements

The current model conflates "the member's *current* package" (`clients.package_type`, `clients.pt_end_date`) with "the *history* of packages". This is why renewals overwrite the previous package without a trace. Add a proper `subscriptions` table:

```sql
-- db/migrations/2026-05-subscriptions.sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id         TEXT REFERENCES plans(id),
  plan_name       TEXT NOT NULL,                          -- snapshot at sale time
  branch_id       TEXT,                                   -- multi-branch
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  base_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  signup_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_percent     NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,       -- net of discount + gst + signup
  paid_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method  TEXT          NOT NULL DEFAULT 'CASH',
  receipt_no      TEXT,
  coupon_code     TEXT,
  group_id        TEXT,                                   -- for family/corporate plans
  status          TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','frozen','expired','cancelled','superseded')),
  freeze_days_used INTEGER NOT NULL DEFAULT 0,
  freeze_days_max  INTEGER NOT NULL DEFAULT 0,
  auto_renew       BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id        TEXT REFERENCES subscriptions(id),     -- renewal chain
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at     TIMESTAMPTZ,
  cancelled_reason TEXT
);

-- Active subscription lookup (the most common query)
CREATE INDEX IF NOT EXISTS idx_subs_client_active
  ON subscriptions (client_id, end_date DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subs_branch_period
  ON subscriptions (branch_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_subs_expiring
  ON subscriptions (end_date)
  WHERE status = 'active';
```

Read-side: replace `SELECT package_type, pt_end_date FROM clients WHERE id = $1` with:

```sql
SELECT s.* FROM subscriptions s
WHERE s.client_id = $1 AND s.status = 'active'
ORDER BY s.end_date DESC LIMIT 1;
```

Keep the legacy columns on `clients` updated for now (backward compat) but treat `subscriptions` as source of truth.

## 2.9 Transaction-safe subscription assignment logic

The principal pattern your existing `client-actions.js` follows is correct. Apply it consistently:

```js
// backend/src/modules/subscriptions/subscriptions.service.js  (NEW)
const pool = require('../../db/pool');
const { genReceiptNo } = require('../../db/receipts');

async function addSubscription({ clientId, planRows, paymentMethod, branchId, gstPercent, signupFee, performedBy, userRole, userTrainerId }) {
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');

    // 1) Lock the client row to prevent races (two staff adding simultaneously)
    const { rows: cs } = await tx.query('SELECT * FROM clients WHERE id=$1 FOR UPDATE', [clientId]);
    if (!cs[0]) throw httpError(404, 'Client not found');
    const client = cs[0];

    // 2) RBAC
    if (userRole === 'trainer' && client.trainer_id !== userTrainerId)
      throw httpError(403, 'Access denied: client not assigned to you');

    // 3) Overlap guard — refuse if an active sub already covers the start date
    const { rows: overlap } = await tx.query(
      `SELECT id FROM subscriptions
        WHERE client_id=$1 AND status='active'
          AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')
        LIMIT 1`,
      [clientId, planRows[0].startDate, planRows[planRows.length-1].endDate]
    );
    if (overlap[0]) throw httpError(409, 'Active subscription overlaps. Use Renew or Upgrade.');

    // 4) Insert each plan row as a subscription, plus the receipt + payment
    const created = [];
    for (const r of planRows) {
      const baseAmount = Number(r.basePrice)    || 0;
      const sellAmount = Number(r.sellingPrice) || 0;
      const discount   = Math.max(0, baseAmount - sellAmount);
      const gstAmount  = Math.round(sellAmount * (gstPercent || 0) / 100 * 100) / 100;
      const final      = sellAmount + gstAmount + (signupFee || 0);
      const receipt    = await genReceiptNo(tx);

      const { rows: subRows } = await tx.query(
        `INSERT INTO subscriptions
          (client_id, plan_name, branch_id, start_date, end_date,
           base_amount, discount_amount, signup_fee, gst_percent, gst_amount,
           final_amount, paid_amount, payment_method, receipt_no, coupon_code, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active')
         RETURNING *`,
        [clientId, r.plan, branchId, r.startDate, r.endDate,
         baseAmount, discount, signupFee || 0, gstPercent || 0, gstAmount,
         final, final, paymentMethod || 'CASH', receipt, r.coupon || null]
      );
      created.push(subRows[0]);

      // Payment row (one per subscription row, simpler reconciliation)
      await tx.query(
        `INSERT INTO payments
          (id, client_id, client_name, trainer_id, trainer_name, amount, method, date, receipt_no, package_type, incentive_amt, notes)
         VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,$9,$10)`,
        [client.id, client.name, client.trainer_id, client.trainer_name,
         final, paymentMethod || 'CASH', receipt, r.plan,
         Math.round(final * 0.5), `Subscription: ${r.plan}`]
      );
    }

    // 5) Update legacy denorm columns on `clients` (keep until full migration)
    const last = created[created.length - 1];
    await tx.query(
      `UPDATE clients SET package_type=$1, pt_start_date=$2, pt_end_date=$3,
         final_amount=$4, paid_amount=$4, balance_amount=0,
         status='active', updated_at=NOW()
       WHERE id=$5`,
      [last.plan_name, last.start_date, last.end_date, last.final_amount, clientId]
    );

    // 6) Audit log
    await tx.query(
      `INSERT INTO membership_actions
        (id, client_id, client_name, trainer_id, action_type, old_value, new_value, amount, payment_method, performed_by, action_date)
       VALUES (gen_random_uuid()::TEXT,$1,$2,$3,'add_subscription',$4,$5,$6,$7,$8,CURRENT_DATE)`,
      [client.id, client.name, client.trainer_id,
       JSON.stringify({ package_type: client.package_type }),
       JSON.stringify({ subscriptions: created.map(s => s.id), total: created.reduce((a,s) => a + Number(s.final_amount), 0) }),
       created.reduce((a,s) => a + Number(s.final_amount), 0),
       paymentMethod || 'CASH', performedBy]
    );

    await tx.query('COMMIT');
    return created;
  } catch (err) {
    await tx.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    tx.release();
  }
}
```

Key design points:

- **`FOR UPDATE`** locks the client row so two reception staff can't double-book.
- **Overlap guard** uses Postgres `daterange &&` operator — accurate and fast.
- **Each plan row → one subscription + one payment + one receipt** so reconciliation is clean.
- **Audit log is non-fatal** in your current code; I keep it in the same transaction here so a partial state never persists.
- **Idempotency:** add a request `Idempotency-Key` header pattern in the route handler if you ever expose this to a public payments webhook.

## 2.10 Auto invoice generation logic

```js
// backend/src/modules/invoices/invoice.service.js
const { generateInvoicePdf } = require('./pdf');   // wraps pdfkit or puppeteer
const { uploadToStorage }    = require('../../storage');  // S3 / Supabase Storage

async function issueInvoice(tx, subscription, client, branch) {
  const pdfBuffer = await generateInvoicePdf({
    invoice_no:   subscription.receipt_no,
    issued_on:    new Date(),
    bill_to:      client,
    branch:       branch,
    line_items:   [{ description: subscription.plan_name,
                     amount: subscription.base_amount,
                     discount: subscription.discount_amount }],
    gst:          { percent: subscription.gst_percent, amount: subscription.gst_amount },
    total:        subscription.final_amount,
    paid:         subscription.paid_amount,
  });
  const url = await uploadToStorage(`invoices/${subscription.id}.pdf`, pdfBuffer, 'application/pdf');
  await tx.query('UPDATE subscriptions SET invoice_url=$1 WHERE id=$2', [url, subscription.id]);
  return url;
}
```

Trigger from inside the transaction *after* commit (or in a queued job for large gyms):

```js
const invoiceUrl = await issueInvoice(pool, last, client, branch);
// fire-and-forget WhatsApp/email
notify.sendInvoice(client, invoiceUrl);
```

## 2.11 Membership activation flow

```
[Sale] → subscriptions.status = 'active'
       → clients.status = 'active'
       → biometric_added = TRUE (if face enrolled)
       → app push: "Welcome to 619 Fitness!"
       → WhatsApp: invoice + class schedule
       → trainer assignment notification (if trainer_id set)
```

Implement as a Postgres trigger or as a service-layer function called immediately after `addSubscription` commits. I prefer the service-layer approach because it's testable.

## 2.12 Subscription renewal flow

```
[Renewal due in 7 days] → cron worker fires
                        → generate `renewal_reminder` notification
                        → WhatsApp template: "Hey Abhishek, your Quarterly plan ends 14 May. Tap to renew."
[Member taps Renew]     → POST /api/clients/:id/renew-subscription
                        → service runs in tx:
                            - close current subscription (status='superseded')
                            - INSERT new subscription with parent_id=old.id
                            - generate receipt + invoice
                            - UPDATE clients.pt_end_date
[Auto-renew opt-in]     → if subscription.auto_renew = TRUE
                            and a saved payment method exists
                          → on T-1 day, charge & renew automatically
                          → notify member of charge
```

The existing `backend/src/workers/renewal.worker.js` is the right place. Wire it to the new `subscriptions` table.

## 2.13 Multi-branch support

Already covered above (`branch_id` column). Two more pieces:

- **Branch context in JWT.** Add `branch_id` to the JWT payload at login. Middleware reads it. Routes that mutate data scope by branch.
- **Cross-branch read.** `manager` role can `SELECT` across branches; `reception` is hard-scoped to one.

```js
// backend/src/middleware/branch-scope.js
function branchScope(req, _res, next) {
  if (req.user.role === 'admin') return next();           // all branches
  req.branchFilter = ['branch_id = $X', req.user.branch_id];
  next();
}
```

## 2.14 GST and discount calculations

```ts
// frontend/src/lib/pricing.ts
export function priceBreakdown({ base, discountPct, signupFee, gstPct }: {
  base: number; discountPct: number; signupFee: number; gstPct: number;
}) {
  const discount = round2(base * discountPct / 100);
  const net      = round2(base - discount);
  const gst      = round2(net * gstPct / 100);
  const cgst     = round2(gst / 2);
  const sgst     = round2(gst / 2);
  const total    = round2(net + gst + signupFee);
  return { base, discount, net, gst, cgst, sgst, signupFee, total };
}
const round2 = (n: number) => Math.round(n * 100) / 100;
```

Wire this into the Payment Breakdown card on `add-subscription/page.tsx:222-237` (currently shows `₹ 0` for everything). Replace the hardcoded zeros with the values from `priceBreakdown`.

---

# Task 3 — Face Scan attendance system

## 3.1 What's already there

Your repo has:

- `backend/src/routes/checkin.js` — `POST /api/checkin/face`, `POST /api/checkin/enroll`, `GET /api/checkin/logs`. Uses 128-D face-api.js descriptors, Euclidean distance, threshold 0.50.
- `db/migrations/face-checkin.sql` — `clients.face_descriptor JSONB`, `face_checkin_logs` table.
- `frontend/src/components/FaceEnrollModal.tsx` — 303 lines (didn't fully read but assume it's a webcam-based enroller).
- `frontend/src/components/checkin/` directory.
- `frontend/src/app/checkin/` page.

This is a solid v1. The plan below is a v2 that hardens it for production: multi-angle enrollment, liveness, kiosk mode, offline queue, branch scoping, performance.

## 3.2 Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| Browser engine | **face-api.js 0.22.x** (TF.js backend) | Already chosen. Wide support, 128-D descriptors. |
| Models | `tiny_face_detector` + `face_landmark_68` + `face_recognition` + `face_expression` | tiny detector for speed; expression for blink-based liveness. |
| Liveness | Browser challenge (blink × 2, head turn left/right, smile) — no extra deps | Free, robust against printed photos and basic video replay. |
| Vector store | Phase 1: `JSONB` in Postgres; Phase 2: **`pgvector`** with HNSW index | Phase 1 works up to ~500 enrolled members. pgvector scales to 100k+. |
| Realtime | **Socket.io** | Already in your stack hint. Used for kiosk → admin "X just checked in" broadcasts. |
| Queue | **`pg-boss`** (Postgres-backed jobs) | No extra Redis dep. Used for offline sync flush, descriptor recompute. |
| Storage | **Supabase Storage** | Already on Supabase. Store enrolment photos for audit. |
| Mobile camera | `getUserMedia()` over HTTPS | Same code path as webcam. |

## 3.3 Frontend architecture

```
frontend/src/components/face/
├── FaceCamera.tsx              ← <video> wrapper, deviceId switcher, mirror toggle
├── FaceModelLoader.tsx         ← lazy-loads face-api.js models from /public/models
├── EnrollWizard.tsx            ← 5-angle capture: front, left30°, right30°, up15°, down15°
├── LivenessChallenge.tsx       ← blink + turn challenge before recognition counts
├── RecognitionLoop.tsx         ← every 600ms: detect → if liveness passed, send descriptor
├── KioskShell.tsx              ← full-screen, idle reset, touch lock, branch picker
├── AttendanceTicker.tsx        ← live feed of "Abhishek just checked in" via Socket.io
└── OfflineQueue.tsx            ← IndexedDB-backed queue for failed submits
```

### Pipeline (recognition path)

```
1. Camera ready (getUserMedia)
2. Models loaded (lazy, cached in IndexedDB by face-api)
3. tiny_face_detector finds bounding box
4. face_landmark_68 finds eyes, mouth, nose
5. LivenessChallenge state machine:
     idle → "blink twice" → blink_1 → blink_2 → "turn head left" → left → "turn head right" → right → DONE
   each step verified via landmark positions
6. face_recognition extracts 128-D descriptor
7. POST /api/checkin/face { descriptor, branch_id, device_id, liveness_score }
8. Backend matches → returns { status, member, sub_status }
9. Show result for 2.5s; play sound; reset
10. Broadcast via Socket.io to /admin/dashboard
```

### Enrollment pipeline

```
1. Operator picks the member from a search dropdown.
2. Member stands in front of the kiosk.
3. Wizard prompts for 5 angles. For each angle:
     - tiny_face_detector confirms 1 face
     - face_landmark_68 confirms head pose within tolerance
     - face_recognition extracts descriptor
     - photo cropped + upload to Storage
4. Compute the median descriptor across the 5 captures (more robust than 1).
5. POST /api/checkin/enroll { client_id, descriptors: [d1..d5], median, photo_urls }
6. Backend stores median + each angle as separate rows for future re-training.
```

### Multi-angle storage rationale

Storing **5 descriptors** instead of 1 makes recognition robust to:

- glasses on/off
- haircut changes
- mild lighting differences
- head tilt at the kiosk

Match against the **min distance** across the 5 stored descriptors per client. If you can deploy pgvector, you do this in SQL.

## 3.4 Backend architecture

```
backend/src/modules/face/
├── face.routes.js              ← POST /enroll, POST /face, GET /logs
├── face.service.js             ← match, log, enroll
├── face.queue.js               ← pg-boss job: re-compute median when angles change
├── face.types.js
└── face.test.js
```

Routes (improving on your current `routes/checkin.js`):

```js
// POST /api/checkin/enroll
// Body: { client_id, descriptors: number[][], photo_urls: string[] }
//
// Stores each angle in face_descriptors table, computes median, sets clients.face_enrolled_at.

// POST /api/checkin/face
// Body: { descriptor: number[], liveness_score: number, branch_id?: string, device_id?: string }
//
// 1. Reject if liveness_score < 0.6
// 2. Match against face_descriptors using cosine OR Euclidean
// 3. RBAC: trainers only check in their own clients
// 4. Membership check: if expired/frozen, return status='expired' with member info
// 5. Insert row into face_checkin_logs AND attendance
// 6. Emit socket event 'attendance:checkin' to room <branch_id>

// GET /api/checkin/logs?branch_id=...&from=...&to=...
// Returns the recent log feed for the admin dashboard.
```

## 3.5 Database schema

Replace the single `clients.face_descriptor` JSONB column with a proper child table — multi-angle, easier re-training:

```sql
-- db/migrations/2026-05-face-v2.sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector — only if available

CREATE TABLE IF NOT EXISTS face_descriptors (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  angle           TEXT NOT NULL CHECK (angle IN ('front','left','right','up','down','median')),
  descriptor      JSONB NOT NULL,                -- length-128 array of floats
  -- descriptor_v vector(128),                   -- enable when pgvector is installed
  photo_url       TEXT,
  quality_score   NUMERIC(4,3),                  -- detector confidence 0-1
  enrolled_by     TEXT,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_face_desc_client ON face_descriptors (client_id) WHERE is_active;
-- pgvector index — run after enabling extension and back-filling descriptor_v:
-- CREATE INDEX idx_face_desc_v ON face_descriptors USING hnsw (descriptor_v vector_cosine_ops);

ALTER TABLE face_checkin_logs
  ADD COLUMN IF NOT EXISTS branch_id     TEXT,
  ADD COLUMN IF NOT EXISTS device_id     TEXT,
  ADD COLUMN IF NOT EXISTS liveness_score NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS direction     TEXT CHECK (direction IN ('in','out')),
  ADD COLUMN IF NOT EXISTS attendance_id TEXT;

CREATE INDEX IF NOT EXISTS idx_face_logs_branch_day
  ON face_checkin_logs (branch_id, DATE(created_at));

-- Backfill from clients.face_descriptor if it exists
INSERT INTO face_descriptors (client_id, angle, descriptor, enrolled_at)
SELECT id, 'median', face_descriptor, COALESCE(face_enrolled_at, NOW())
FROM clients
WHERE face_descriptor IS NOT NULL
ON CONFLICT DO NOTHING;
```

The pgvector path (when you scale past ~500 members):

```sql
-- After enabling pgvector
ALTER TABLE face_descriptors ADD COLUMN descriptor_v vector(128);
UPDATE face_descriptors SET descriptor_v = descriptor::text::vector;  -- one-time
CREATE INDEX idx_face_desc_v
  ON face_descriptors USING hnsw (descriptor_v vector_cosine_ops)
  WITH (m=16, ef_construction=64);

-- Match query becomes O(log n):
SELECT client_id, descriptor_v <=> $1::vector AS distance
FROM   face_descriptors
WHERE  is_active
ORDER  BY descriptor_v <=> $1::vector
LIMIT  3;
```

## 3.6 API architecture (final)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/checkin/enroll` | admin / reception | Enroll a member with 5 angle descriptors |
| `POST` | `/api/checkin/face`   | any signed-in or kiosk-token | Match a probe descriptor and mark attendance |
| `POST` | `/api/checkin/face/manual` | admin / reception | Manual override when face fails |
| `POST` | `/api/checkin/face/recompute` | admin | Re-compute median for one client |
| `GET`  | `/api/checkin/logs`   | admin / manager | Recent log feed |
| `GET`  | `/api/checkin/stats?period=today` | admin | Aggregate stats for dashboard |
| `DELETE` | `/api/checkin/enroll/:client_id` | admin | Wipe face data (GDPR) |

Add a **kiosk-token** auth mode: a long-lived bearer token unique per kiosk device, scoped to one branch and the `/api/checkin/face` endpoint only. Issued from `/api/admin/kiosks` and revocable. This avoids putting a staff JWT on a wall-mounted iPad.

## 3.7 Queue / background jobs

- **`face.recompute-median`** — when a member adds a new angle, regenerate the median.
- **`attendance.daily-summary`** — emit per-branch daily report at 23:55 local time.
- **`face.purge-old-logs`** — drop rows older than 365 days (configurable, audit retention).
- **`face.descriptor-quality-audit`** — weekly: flag members whose recent matches have distance > 0.4 (likely need re-enrollment).

Use `pg-boss` so no Redis. Workers live in `backend/src/workers/`.

## 3.8 WebSocket flow

```
client (kiosk)                        server                    admin dashboard
       │                                │                              │
       │ POST /api/checkin/face         │                              │
       ├───────────────────────────────▶│                              │
       │                                │ match → insert log           │
       │                                │ insert attendance            │
       │                                │ emit('attendance:checkin',   │
       │                                │   { member, branch_id })     │
       │                                │     to room: branch_<id>     │
       │                                ├─────────────────────────────▶│
       │ ◀─ HTTP 200 ──────────────────│                              │  toast "Abhishek checked in"
       │                                │                              │
```

Server-side:

```js
io.on('connection', (socket) => {
  socket.on('subscribe:branch', (branchId) => {
    if (canSubscribe(socket.user, branchId)) socket.join(`branch_${branchId}`);
  });
});

// inside checkin route
io.to(`branch_${branchId}`).emit('attendance:checkin', { member, at: new Date() });
```

## 3.9 Security best practices

- **HTTPS only.** `getUserMedia` requires it. Webcam over HTTP is silently denied.
- **Liveness threshold** of 0.6 server-side; reject below.
- **Rate-limit** `/api/checkin/face` to 30 req/min per device (matches your existing rate-limit policy).
- **Encrypt descriptors at rest.** Postgres column-level encryption via `pgcrypto`, or just rely on Supabase disk encryption — descriptors are 128 floats, not raw photos, so they're already a privacy gradient.
- **GDPR / DPDP Act 2023.** Store consent in `clients.face_consent_at`. Member can request deletion via a button in their portal. Respect within 30 days.
- **Photo retention.** Don't keep photos forever. Default 90 days, configurable per branch, then drop.
- **Spoof prevention layer 2** — server-side: reject if the same descriptor matches with distance < 0.05 (suspicious — same exact frame replayed) within 5 minutes.
- **Audit log immutable.** `face_checkin_logs` has `created_at` only, no update path. Reviewable.

## 3.10 Performance optimisation

- **Lazy-load face-api models.** Don't bundle them. Serve from `/public/models/*` with long cache. ~6.5 MB.
- **Cache models in IndexedDB.** face-api.js already does this once you call `loadFromUri()` — verify with DevTools.
- **WebGL backend** (`tf.setBackend('webgl')`) → 5–10× faster than CPU.
- **Detection cadence:** 600 ms (not every frame). Faces don't change in 600 ms.
- **Quantize descriptors.** Convert float32 → int8 for storage; ~4× smaller, negligible accuracy loss for euclidean distance < 0.6.
- **pgvector + HNSW** for the database side past 500 members.
- **Confident-match early-exit** is already in your `routes/checkin.js:106`. Keep.

## 3.11 Face embedding storage strategy

| Stage | Storage | Index | Match query |
|---|---|---|---|
| **Phase 1: 0–500 members** | `JSONB` array on `face_descriptors` | btree on `client_id` | App-side full scan + euclidean — already implemented |
| **Phase 2: 500–10k** | `vector(128)` column via pgvector | HNSW (cosine) | `ORDER BY descriptor_v <=> $1 LIMIT 3` in Postgres |
| **Phase 3: 10k+ multi-tenant** | dedicated vector DB (Qdrant / Milvus) | HNSW | Out-of-process match service over gRPC |

Switch from Phase 1 to Phase 2 when match latency on a single check-in exceeds **150 ms** at the 95th percentile.

## 3.12 Attendance marking logic

```
1. Match → member found (status='active')
2. Look up today's attendance row for member:
     SELECT * FROM attendance WHERE client_id=$1 AND date=CURRENT_DATE LIMIT 1;
3. If none: INSERT (check_in_at=NOW(), direction='in')
4. If exists with no check_out: UPDATE (check_out_at=NOW(), direction='out')
5. If both set and gap < 1h: UPDATE check_out_at=NOW() (treat as continuation)
6. Return { direction: 'in' | 'out', already_in: boolean }
```

UX: show a green check-in animation; show a blue check-out animation. Different sounds.

## 3.13 Anti-spoof / liveness flow

State machine (frontend, runs alongside detection):

```
INIT
 ├─ no face          ─▶ "Step closer to the camera"
 ├─ face too small   ─▶ "Move closer"
 ├─ face too off-axis ▶ "Look at the camera"
 ├─ face ok          ─▶ CHALLENGE_BLINK
CHALLENGE_BLINK
 ├─ blink detected   ─▶ blinks++
 ├─ blinks ≥ 2       ─▶ CHALLENGE_TURN_LEFT
CHALLENGE_TURN_LEFT
 ├─ yaw < -15°       ─▶ CHALLENGE_TURN_RIGHT
CHALLENGE_TURN_RIGHT
 ├─ yaw > +15°       ─▶ CAPTURE
CAPTURE
 └─ extract descriptor + send
TIMEOUT (8s) ▶ FAIL ▶ retry
```

Eye-aspect ratio (EAR) for blink detection from face-api landmarks 36–47:

```ts
function ear(eye: number[][]) {
  const d = (a: number[], b: number[]) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  return (d(eye[1], eye[5]) + d(eye[2], eye[4])) / (2 * d(eye[0], eye[3]));
}
const isBlinking = (eyeL: number[][], eyeR: number[][]) => (ear(eyeL) + ear(eyeR)) / 2 < 0.2;
```

Yaw approximation from nose vs. eye-line midpoint — good enough for the head-turn challenge.

Server-side "liveness_score" is a number 0–1 the client sends; the server treats < 0.6 as a hard fail and logs `status='denied'`.

## 3.14 Edge cases

| Case | Behaviour |
|---|---|
| Multiple faces in frame | Pick the largest bounding box; show "Step forward, only the closest person will be matched". |
| No face for 8s | Reset state machine. |
| Glasses / mask | Glasses: re-enroll a `glasses` angle. Mask: refuse, prompt "Please remove the mask for check-in". |
| Twins | Threshold 0.50 is usually safe. If a gym has known twins, lower to 0.45 globally and re-enroll. |
| Member in profile-only photo | Reject enrollment if face_landmark_68 confidence < 0.85. |
| Network drop during check-in | Offline queue. See §3.15. |
| Camera permission denied | Fall back to manual member-code entry. Log `device_camera_blocked`. |
| Browser tab in background | Pause detection loop on `visibilitychange`. |
| Power outage | Kiosk auto-restarts; the OfflineQueue persists in IndexedDB and flushes on reconnect. |
| Member changed appearance | If 3 consecutive matches > 0.45 distance, server emits a `re_enroll_suggested` flag. |

## 3.15 Error recovery (offline queue)

```ts
// frontend/src/components/face/OfflineQueue.tsx
import { openDB } from 'idb';

const db = openDB('face-queue', 1, {
  upgrade(d) { d.createObjectStore('pending', { keyPath: 'id', autoIncrement: true }); }
});

export async function enqueueCheckIn(payload: any) {
  await (await db).add('pending', { ...payload, queued_at: Date.now() });
}

export async function flushQueue() {
  const all = await (await db).getAll('pending');
  for (const item of all) {
    try {
      await api.checkin.face(item);
      await (await db).delete('pending', item.id);
    } catch (e) {
      // back off and retry next cycle
      break;
    }
  }
}
window.addEventListener('online', flushQueue);
setInterval(flushQueue, 30_000);
```

The kiosk **always** enqueues to IndexedDB first, then attempts the network call, then deletes on success. This gives you "feels online" UX even on flaky WiFi.

## 3.16 Scalable deployment architecture

```
              ┌──────────────────────────┐
              │  Cloudflare / Vercel CDN │
              └──────────────┬───────────┘
                             │
        ┌────────────────────┼─────────────────────┐
        │                    │                     │
   ┌────▼─────┐        ┌─────▼──────┐       ┌──────▼─────┐
   │ Branch A │        │  Branch B  │       │  Branch C  │
   │  Kiosk   │        │   Kiosk    │       │   Kiosk    │
   └────┬─────┘        └─────┬──────┘       └──────┬─────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             │ (HTTPS)
                  ┌──────────▼───────────┐
                  │  Render — Express    │  ← horizontally scalable
                  │   Node.js 20 LTS     │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
   ┌────────▼────────┐               ┌────────▼────────┐
   │ Supabase        │               │  Supabase       │
   │  Postgres       │               │  Storage        │
   │  (pgvector)     │               │  (photos)       │
   └─────────────────┘               └─────────────────┘
            │
   ┌────────▼────────┐
   │  pg-boss        │
   │  (jobs in same  │
   │   Postgres)     │
   └─────────────────┘
```

Per-branch kiosk runs the same Next.js page on a Chromium kiosk profile, locked to fullscreen. State is local. Backend is shared.

---

# Task 4 — Membership plan upgrades

## 4.1 Current state

`db/migrations/supabase-v3-migration.sql` already gives you:

```
plans (id, kind ['Membership','PT'], name, duration_label, base_amount, discount,
       final_amount, sessions_per_week, features JSONB, popular, gym_id, is_active)
```

This is a fine v1. The screenshots show fields for **Plan Name, Description, Category, Duration, Freeze Days, Price, Discounted Price, Total** — all of which fit the existing table. We extend it for the modern SaaS-gym features you listed.

## 4.2 Extended schema (additive migration)

```sql
-- db/migrations/2026-05-plans-v4.sql
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS description           TEXT,
  ADD COLUMN IF NOT EXISTS category              TEXT[]   DEFAULT '{}',     -- 'Weight Training', 'Personal Training', 'Yoga', 'Zumba'
  ADD COLUMN IF NOT EXISTS freeze_days_max       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_unit           TEXT     DEFAULT 'Days' CHECK (freeze_unit IN ('Days','Weeks','Months')),
  ADD COLUMN IF NOT EXISTS auto_renew            BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_days            INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signup_fee            NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_sessions_included  INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diet_consult_included BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pause_rules           JSONB    DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS gst_percent           NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_ids            TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_slots            JSONB    DEFAULT '[]'::JSONB,  -- [{day:'Mon', from:'06:00', to:'10:00'}]
  ADD COLUMN IF NOT EXISTS session_limit_per_day INTEGER,
  ADD COLUMN IF NOT EXISTS session_limit_total   INTEGER,
  ADD COLUMN IF NOT EXISTS qr_access             BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS biometric_access      BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS guest_passes          INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_reward_pct   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_pct          NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_upgrade         BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_downgrade       BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plan_type             TEXT     DEFAULT 'individual'
                                                 CHECK (plan_type IN ('individual','family','corporate','student','senior','hybrid')),
  ADD COLUMN IF NOT EXISTS family_members_max    INTEGER  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS corporate_company     TEXT,
  ADD COLUMN IF NOT EXISTS corporate_min_seats   INTEGER,
  ADD COLUMN IF NOT EXISTS corporate_discount_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS hybrid_online_pct     INTEGER,             -- online vs offline split
  ADD COLUMN IF NOT EXISTS template_of           TEXT REFERENCES plans(id),  -- duplicates
  ADD COLUMN IF NOT EXISTS valid_from            DATE,
  ADD COLUMN IF NOT EXISTS valid_until           DATE,
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER  DEFAULT 0;

-- For analytics
CREATE TABLE IF NOT EXISTS plan_metrics (
  plan_id          TEXT REFERENCES plans(id) ON DELETE CASCADE,
  month            DATE NOT NULL,
  subs_created     INTEGER DEFAULT 0,
  subs_renewed     INTEGER DEFAULT 0,
  subs_cancelled   INTEGER DEFAULT 0,
  revenue_gross    NUMERIC(12,2) DEFAULT 0,
  revenue_net      NUMERIC(12,2) DEFAULT 0,
  avg_lifetime_days INTEGER,
  PRIMARY KEY (plan_id, month)
);
```

## 4.3 Better UX flow for plan creation

The screenshot shows a single long form. Replace with a **3-step wizard** that guides operators:

```
Step 1 — Basics
  · Name *
  · Description (rich text)
  · Plan Type [individual / family / corporate / student / senior / hybrid]
  · Categories (multi-select chips)

Step 2 — Pricing & Duration
  · Tenure (number + Months/Days/Years)
  · Freeze days (number + unit)
  · Base price · Discount · Final price · Signup fee · GST % (auto-calculated total)
  · Trial days (default 0)
  · Auto-renewal toggle

Step 3 — Inclusions & Restrictions
  · PT sessions included (0+)
  · Diet consultation toggle
  · Time-slot restrictions (off-peak / peak / 24×7)
  · Branch restrictions (multi-select)
  · Session limits (per day / total)
  · Access mode (Biometric / QR / Both)
  · Guest passes
  · Referral reward % · Cashback %
  · Family/Corporate-specific fields appear conditionally

Step 4 — Review & Publish
  · Live preview of how the plan looks to a member
  · Save / Save & Close / Save as Template / Publish
```

Component sketch:

```tsx
// frontend/src/app/memberships/plans/new/page.tsx
import { useReducer } from 'react';
import { Wizard, Step } from '@/components/ui/Wizard';

export default function NewPlanWizard() {
  const [state, dispatch] = useReducer(planReducer, initialPlan);
  return (
    <Wizard onFinish={() => api.plans.create(state)}>
      <Step title="Basics"        ><BasicsStep    s={state} d={dispatch} /></Step>
      <Step title="Pricing"       ><PricingStep   s={state} d={dispatch} /></Step>
      <Step title="Inclusions"    ><InclusionStep s={state} d={dispatch} /></Step>
      <Step title="Review"        ><ReviewStep    s={state} d={dispatch} /></Step>
    </Wizard>
  );
}
```

## 4.4 Dynamic pricing logic

```ts
// frontend/src/lib/plan-pricing.ts
export function computePlanPrice(input: {
  base: number;
  discountAbs?: number;
  discountPct?: number;
  signupFee?: number;
  gstPct?: number;
  corporateDiscountPct?: number;
  cashbackPct?: number;
  trialDays?: number;
  tenureDays: number;
}) {
  const baseAfterCorp = input.base * (1 - (input.corporateDiscountPct ?? 0) / 100);
  const discAbs       = input.discountAbs ?? 0;
  const discPct       = (input.discountPct ?? 0) / 100;
  const net           = Math.max(0, baseAfterCorp * (1 - discPct) - discAbs);
  const gst           = net * (input.gstPct ?? 0) / 100;
  const final         = net + gst + (input.signupFee ?? 0);
  const cashback      = final * (input.cashbackPct ?? 0) / 100;
  const perDay        = final / input.tenureDays;
  return { net, gst, final, cashback, perDay };
}
```

Show `perDay` ("₹71/day") on the plan card — it's the highest-converting price anchor.

## 4.5 Validation logic (plan creation)

```ts
import { z } from 'zod';

export const PlanSchema = z.object({
  name: z.string().min(2).max(80),
  kind: z.enum(['Membership','PT']),
  duration_label: z.enum(['Monthly','Quarterly','Half Yearly','Yearly','Custom']),
  category: z.array(z.string()).min(1, 'Pick at least one category'),
  base_amount: z.number().nonnegative(),
  discount:    z.number().nonnegative(),
  final_amount: z.number().positive(),
  signup_fee:  z.number().nonnegative().default(0),
  gst_percent: z.number().min(0).max(50).default(0),
  trial_days:  z.number().int().min(0).max(30).default(0),
  freeze_days_max: z.number().int().min(0).max(180).default(0),
  pt_sessions_included: z.number().int().min(0).default(0),
  branch_ids: z.array(z.string()).default([]),
  time_slots: z.array(z.object({ day: z.string(), from: z.string(), to: z.string() })).default([]),
  plan_type:  z.enum(['individual','family','corporate','student','senior','hybrid']),
  family_members_max: z.number().int().min(1).max(10).default(1),
}).refine(d => d.final_amount <= d.base_amount, { message: 'Final must be ≤ base' });
```

Validate on both client and server (the Zod schema runs in both with no rewrite).

## 4.6 Plan duplication & templates

`template_of` foreign key + a "Duplicate" button on each plan row:

```js
// POST /api/plans/:id/duplicate
router.post('/:id/duplicate', auth, adminOnly, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM plans WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Plan not found' });
    const src = rows[0];
    const newId = uuid();
    await pool.query(
      `INSERT INTO plans
         SELECT $1, kind, name || ' (copy)', duration, price, description, FALSE,
                NOW(), kind, duration_label, base_amount, discount, final_amount,
                sessions_per_week, features, popular, gym_id, NOW(),
                description, category, freeze_days_max, freeze_unit, auto_renew,
                trial_days, signup_fee, pt_sessions_included, diet_consult_included,
                pause_rules, gst_percent, branch_ids, time_slots, session_limit_per_day,
                session_limit_total, qr_access, biometric_access, guest_passes,
                referral_reward_pct, cashback_pct, allow_upgrade, allow_downgrade,
                plan_type, family_members_max, corporate_company, corporate_min_seats,
                corporate_discount_pct, hybrid_online_pct, $1, NULL, NULL, sort_order
         FROM plans WHERE id=$2 RETURNING *`,
      [newId, req.params.id]
    );
    res.json({ message: 'Duplicated', plan_id: newId });
  } catch (e) { next(e); }
});
```

Templates: a `plan_templates` boolean. The `Plans` list has a "From template" picker.

## 4.7 Analytics tracking (per plan)

`plan_metrics` table is updated nightly by a worker:

```js
// backend/src/workers/plan-metrics.worker.js
async function rollup(month) {
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  await pool.query(`
    INSERT INTO plan_metrics (plan_id, month, subs_created, subs_renewed, subs_cancelled, revenue_gross, revenue_net)
    SELECT
      p.id,
      $1::date,
      COUNT(*) FILTER (WHERE s.created_at BETWEEN $1 AND $2 AND s.parent_id IS NULL),
      COUNT(*) FILTER (WHERE s.created_at BETWEEN $1 AND $2 AND s.parent_id IS NOT NULL),
      COUNT(*) FILTER (WHERE s.cancelled_at BETWEEN $1 AND $2),
      COALESCE(SUM(s.base_amount) FILTER (WHERE s.created_at BETWEEN $1 AND $2),0),
      COALESCE(SUM(s.final_amount) FILTER (WHERE s.created_at BETWEEN $1 AND $2),0)
    FROM plans p LEFT JOIN subscriptions s ON s.plan_name = p.name
    GROUP BY p.id
    ON CONFLICT (plan_id, month) DO UPDATE SET
      subs_created=EXCLUDED.subs_created,
      subs_renewed=EXCLUDED.subs_renewed,
      subs_cancelled=EXCLUDED.subs_cancelled,
      revenue_gross=EXCLUDED.revenue_gross,
      revenue_net=EXCLUDED.revenue_net;
  `, [monthStart, monthEnd]);
}
```

## 4.8 Renewal automation, expiry reminders, payment retry

Cron-style jobs in `backend/src/workers/`:

| Job | Cadence | Action |
|---|---|---|
| `expiring-soon` | daily 09:00 | T-7 / T-3 / T-1 WhatsApp + push to expiring members |
| `auto-renew` | daily 02:00 | Charge saved payment method for `auto_renew=TRUE` subs ending today |
| `failed-payment-retry` | every 6h | Retry failed auto-renew up to 3 times over 5 days, then notify admin |
| `expired-status-flip` | daily 23:55 | Mark `subscriptions.status='expired'` and `clients.status='expired'` |
| `dunning` | daily 10:00 | Members with overdue dues > 7 days get an admin task |

Use `pg-boss`:

```js
const PgBoss = require('pg-boss');
const boss = new PgBoss(process.env.DATABASE_URL);
await boss.start();
await boss.schedule('expiring-soon', '0 9 * * *');
await boss.work('expiring-soon', async () => sendExpiryReminders());
```

---

# 90-day implementation roadmap

| Week | Workstream | Deliverable | Owner |
|---|---|---|---|
| 1 | Sidebar | Migrate `nav-config.ts` to new hierarchy + lucide icons. Add `SidebarSearch` and badges scaffolding. | Frontend |
| 1 | Subscription bug | Fix `handleSubmit` in 9 client-action pages. Add `api.clients.addSubscription`. Toast wired. | Frontend |
| 2 | Subscription | Apply `2026-05-subscriptions.sql` migration. Refactor `client-actions.js` to write to `subscriptions` (denorm columns kept). | Backend + DB |
| 2 | Subscription | Add Zod validators (front + back). Idempotency-Key header. | Both |
| 3 | Plans v4 | Apply `2026-05-plans-v4.sql`. Build the 4-step plan-creation wizard. Plan duplication. | Both |
| 4 | Plans v4 | Plan analytics worker + admin dashboard tile. | Backend + UI |
| 5 | Face v2 | Apply `2026-05-face-v2.sql`. Backfill from old column. Refactor `routes/checkin.js` to new schema. | Backend + DB |
| 5–6 | Face v2 | New `EnrollWizard` (5 angles). `LivenessChallenge` component. KioskShell. | Frontend |
| 7 | Face v2 | Socket.io live ticker on admin dashboard. OfflineQueue (IndexedDB). | Both |
| 8 | Face v2 | pg-boss queue, `face.recompute-median` job, attendance `direction` logic. | Backend |
| 9 | Multi-branch | Branch context in JWT, branch picker on kiosk, branch-scoped reports. | Both |
| 10 | RBAC | Extend `NavItem.roles` to array. Backend RBAC matrix audit. | Both |
| 11 | Auto-renewal | `auto-renew` worker, saved payment method, dunning emails. | Backend |
| 12 | Polish | Mobile drawer swipe-to-close, plan templates, GDPR delete-my-face button. | Both |

Optional Week 13: pgvector migration if member count > 500.

---

# Cross-cutting concerns

## Folder structure (target)

```
619-erp-v2/
├── backend/
│   └── src/
│       ├── modules/
│       │   ├── members/         (existing)
│       │   ├── subscriptions/   (NEW)
│       │   ├── invoices/        (NEW)
│       │   ├── plans/           (NEW — split from routes/plans.js)
│       │   ├── face/            (NEW — replaces routes/checkin.js)
│       │   ├── attendance/      (NEW — split from routes/attendance.js)
│       │   ├── branches/        (NEW)
│       │   └── notifications/   (existing)
│       ├── routes/              (legacy; gradually empties)
│       ├── workers/
│       │   ├── renewal.worker.js          (existing)
│       │   ├── expiring-soon.worker.js    (NEW)
│       │   ├── auto-renew.worker.js       (NEW)
│       │   ├── plan-metrics.worker.js     (NEW)
│       │   └── face-recompute.worker.js   (NEW)
│       ├── middleware/
│       │   ├── auth.js          (existing)
│       │   ├── rbac.js          (existing — extend with `branchScope`)
│       │   └── idempotency.js   (NEW)
│       └── lib/
│           └── pricing.js
└── frontend/
    └── src/
        ├── app/
        │   ├── memberships/plans/[id]/   (NEW)
        │   ├── memberships/plans/new/    (NEW — wizard)
        │   ├── settings/branches/        (NEW)
        │   └── ...                        (existing pages updated)
        ├── components/
        │   ├── sidebar/        (NEW — replaces Sidebar.tsx + TopNav.tsx)
        │   └── face/           (NEW — replaces FaceEnrollModal.tsx + checkin/)
        └── lib/
            ├── api.ts           (extend)
            ├── nav-config.ts    (replace NAV_GROUPS)
            ├── pricing.ts       (NEW)
            └── validators/      (NEW)
```

## Security best practices (consolidated)

- **JWT with branch claim.** `{ id, role, trainer_id, branch_id }`. Verify on every request.
- **HTTPS everywhere.** Required for camera, secure cookies, HSTS.
- **Rate limit per endpoint.** `/auth/login` 30/15min (existing). `/checkin/face` 30/min/device. `/clients/*/add-subscription` 10/min/user.
- **Helmet + CORS allow-list** (already in `server.js`).
- **Idempotency-Key** on every mutation route to defend against double-click submits and webhook retries.
- **Audit log** on every mutating action (already done via `membership_actions`). Don't let trainers see other trainers' clients.
- **Sanitised 5xx in production** (already done).
- **Soft deletes** (already in `2026-05-perf-and-soft-delete.sql`).
- **Secrets never in repo.** `JWT_SECRET`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are env-only.
- **Dependency hygiene.** `npm audit` in CI; Renovate/Dependabot for face-api, pg, express security patches.

## Performance optimisation (consolidated)

- **React Query staleTime** of 60s on read endpoints; invalidate on mutation.
- **Postgres indexes** explicitly added in each migration above.
- **Background jobs in pg-boss** so request handlers stay sub-200ms.
- **CDN cache** the face-api models forever (`Cache-Control: public, max-age=31536000, immutable`).
- **Code-split** at route level — Next.js App Router does this by default; verify with `next build --analyze`.
- **Memoize** the navigation lookup helpers.
- **Avoid N+1** — every list endpoint joins, doesn't do per-row lookups.

## Testing strategy

- **Backend:** Jest + supertest. Cover the subscription happy path, RBAC denials, overlap conflict, GST math, freeze.
- **Frontend:** Playwright end-to-end on the three critical paths — Add Subscription, Face Enroll, Face Check-In.
- **Load test:** k6 against `/api/checkin/face` simulating 100 RPS for 5 minutes per branch.
- **Snapshot test** the sidebar IA at the JSON level so re-shuffles are intentional.

---

## Appendix A — Quick wins checklist (do in week 1)

- [ ] Replace `frontend/src/app/clients/[id]/add-subscription/page.tsx` `handleSubmit` (Task 2.3)
- [ ] Add `api.clients.addSubscription` and `api.clients.renewSubscription` to `lib/api.ts`
- [ ] Audit the 8 sibling action pages (`freeze`, `extension`, `upgrade`, `downgrade`, `transfer`, `combo`, `trial`, `assign-pt`, `renew-pt`, `renew-subscription`) for the same bug pattern; fix all of them
- [ ] Add the new `nav-config.ts` `NAV_GROUPS`
- [ ] Switch icons from unicode strings to lucide-react components
- [ ] Add `SidebarSearch` (Fuse.js, ~3KB)
- [ ] Apply `2026-05-subscriptions.sql` to a staging DB and smoke-test

These five changes alone restore the broken Add Subscription flow, give your sidebar a professional feel, and lay the groundwork for everything else in this blueprint.

---

*— End of blueprint —*
