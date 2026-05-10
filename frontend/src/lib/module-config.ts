'use client';

import type { Role } from '@/lib/nav-config';

export type ModuleFieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

export type ModuleField = {
  key: string;
  label: string;
  type: ModuleFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export type ModuleRecord = {
  id: string;
  title: string;
  owner: string;
  status: string;
  priority: string;
  amount: number;
  dueDate: string;
  channel: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
};

export type ModuleConfig = {
  key: string;
  tab: string;
  title: string;
  eyebrow: string;
  description: string;
  role?: Role;
  accent: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  entityName: string;
  primaryAction: string;
  statuses: string[];
  priorities: string[];
  channels: string[];
  fields: ModuleField[];
  workflows: string[];
  insights: string[];
};

const statusSets = {
  lifecycle: ['Draft', 'Scheduled', 'Active', 'Paused', 'Completed'],
  approval: ['Pending', 'Approved', 'Rejected', 'Escalated', 'Completed'],
  finance: ['Pending', 'Paid', 'Overdue', 'Approved', 'Exported'],
  asset: ['Available', 'In Use', 'Maintenance', 'Damaged', 'Retired'],
  analytics: ['Healthy', 'Watch', 'At Risk', 'Improving', 'Critical'],
};

const defaultFields: ModuleField[] = [
  { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Enter a clear name' },
  { key: 'owner', label: 'Owner', type: 'text', required: true, placeholder: 'Team member or member name' },
  { key: 'status', label: 'Status', type: 'select', required: true },
  { key: 'priority', label: 'Priority', type: 'select', required: true },
  { key: 'amount', label: 'Value', type: 'number', required: true },
  { key: 'dueDate', label: 'Due date', type: 'date', required: true },
  { key: 'channel', label: 'Channel', type: 'select', required: true },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Operational notes, audience, approval context' },
];

const moduleCopy: Record<string, Partial<ModuleConfig>> = {
  'engagement-overview': {
    title: 'Engagement Overview Dashboard',
    description: 'Campaign health, audience activity, conversion signals, and retention actions in one workspace.',
    entityName: 'Engagement item',
    primaryAction: 'Create engagement item',
    workflows: ['Segment audience', 'Schedule outreach', 'Review responses', 'Trigger follow-up'],
    insights: ['Engagement score', 'Campaign ROI', 'At-risk members', 'Conversion lift'],
  },
  'engagement-members': {
    title: 'Member Engagement',
    description: 'Track member interactions, attendance nudges, app activity, and targeted outreach.',
    entityName: 'Engagement record',
    primaryAction: 'Log interaction',
    workflows: ['Score activity', 'Assign owner', 'Send nudge', 'Review retention risk'],
    insights: ['Active members', 'Dormant users', 'Nudge response', 'App adoption'],
  },
  'engagement-campaigns': {
    title: 'Campaigns',
    description: 'Build, schedule, monitor, and optimize multi-channel gym marketing campaigns.',
    entityName: 'Campaign',
    primaryAction: 'Create campaign',
    workflows: ['Define goal', 'Pick segment', 'Approve content', 'Launch campaign'],
    insights: ['Open rate', 'Click rate', 'Conversions', 'Cost per lead'],
  },
  'engagement-notifications': {
    title: 'Notifications',
    description: 'Create operational announcements, reminders, and alerts for members and staff.',
    entityName: 'Notification',
    primaryAction: 'Send notification',
    workflows: ['Choose audience', 'Write message', 'Schedule delivery', 'Track delivery'],
    insights: ['Sent today', 'Delivery rate', 'Read rate', 'Failed sends'],
  },
  'engagement-email': {
    title: 'Email Campaigns',
    description: 'Manage email newsletters, win-back sequences, offers, and performance reporting.',
    entityName: 'Email campaign',
    primaryAction: 'Create email',
    workflows: ['Select template', 'Validate list', 'Send test', 'Publish'],
    insights: ['Open rate', 'Bounce rate', 'Unsubscribes', 'Revenue attributed'],
  },
  'engagement-whatsapp': {
    title: 'WhatsApp Campaigns',
    description: 'Operate WhatsApp broadcasts, template approvals, balance checks, and member replies.',
    entityName: 'WhatsApp campaign',
    primaryAction: 'Create WhatsApp campaign',
    workflows: ['Pick template', 'Sync audience', 'Queue messages', 'Handle replies'],
    insights: ['Template approval', 'Replies', 'Delivery rate', 'Opt-outs'],
  },
  'engagement-sms': {
    title: 'SMS Campaigns',
    description: 'Run short-form promotional, transactional, renewal, and reminder SMS campaigns.',
    entityName: 'SMS campaign',
    primaryAction: 'Create SMS',
    workflows: ['Check balance', 'Clean numbers', 'Schedule blast', 'Review failures'],
    insights: ['SMS balance', 'Delivered', 'Failed', 'Renewals assisted'],
  },
  'engagement-push': {
    title: 'Push Notifications',
    description: 'Send mobile app pushes for reminders, streaks, challenges, and renewals.',
    entityName: 'Push notification',
    primaryAction: 'Create push',
    workflows: ['Pick trigger', 'Target device users', 'Schedule push', 'Measure taps'],
    insights: ['Devices reachable', 'Tap rate', 'App opens', 'Muted users'],
  },
  'engagement-offers': {
    title: 'Offers & Promotions',
    description: 'Create limited-time offers, coupon rules, eligibility, and redemption tracking.',
    entityName: 'Offer',
    primaryAction: 'Create offer',
    workflows: ['Set eligibility', 'Define discount', 'Publish offer', 'Audit redemption'],
    insights: ['Redemptions', 'Incremental revenue', 'Coupon leakage', 'Expiry risk'],
  },
  'engagement-loyalty': {
    title: 'Loyalty Program',
    description: 'Configure points, tiers, milestone rewards, and member loyalty movement.',
    entityName: 'Loyalty rule',
    primaryAction: 'Create loyalty rule',
    workflows: ['Set points rule', 'Assign tier', 'Reward milestone', 'Reconcile points'],
    insights: ['Points issued', 'Tier upgrades', 'Rewards claimed', 'Breakage'],
  },
  'engagement-rewards': {
    title: 'Rewards',
    description: 'Manage reward catalog, fulfillment status, inventory, and member redemptions.',
    entityName: 'Reward',
    primaryAction: 'Add reward',
    workflows: ['Create catalog item', 'Set stock', 'Approve claim', 'Mark fulfilled'],
    insights: ['Claims', 'Pending fulfillment', 'Stock value', 'Top reward'],
  },
  'engagement-feedback': {
    title: 'Feedback System',
    description: 'Collect structured feedback, assign follow-ups, and close the loop with members.',
    entityName: 'Feedback',
    primaryAction: 'Record feedback',
    workflows: ['Capture feedback', 'Classify topic', 'Assign owner', 'Close loop'],
    insights: ['NPS', 'Open feedback', 'Resolution time', 'Repeat issues'],
  },
  'engagement-polls': {
    title: 'Polls & Surveys',
    description: 'Build surveys, gather responses, analyze trends, and export response data.',
    entityName: 'Survey',
    primaryAction: 'Create survey',
    workflows: ['Draft questions', 'Select audience', 'Collect responses', 'Publish results'],
    insights: ['Responses', 'Completion rate', 'Avg score', 'Open comments'],
  },
  'engagement-reviews': {
    title: 'Reviews & Ratings',
    description: 'Track member reviews, trainer ratings, branch scores, and recovery actions.',
    entityName: 'Review',
    primaryAction: 'Add review',
    workflows: ['Monitor rating', 'Tag issue', 'Assign response', 'Request update'],
    insights: ['Average rating', 'New reviews', 'Unanswered', 'Recovered reviews'],
  },
  'engagement-community': {
    title: 'Community Posts',
    description: 'Moderate community content, member posts, reactions, and branch announcements.',
    entityName: 'Community post',
    primaryAction: 'Create post',
    workflows: ['Draft post', 'Moderate comments', 'Feature story', 'Archive thread'],
    insights: ['Post reach', 'Comments', 'Reactions', 'Reported content'],
  },
  'engagement-events': {
    title: 'Events',
    description: 'Plan gym events, workshops, capacity, registrations, check-ins, and reminders.',
    entityName: 'Event',
    primaryAction: 'Create event',
    workflows: ['Set capacity', 'Open registration', 'Send reminders', 'Track attendance'],
    insights: ['Registrations', 'Waitlist', 'No-shows', 'Event revenue'],
  },
  'engagement-challenges': {
    title: 'Challenges',
    description: 'Run fitness challenges with goals, leaderboards, rewards, and progress tracking.',
    entityName: 'Challenge',
    primaryAction: 'Create challenge',
    workflows: ['Set goal', 'Enroll members', 'Track progress', 'Award winners'],
    insights: ['Participants', 'Completion rate', 'Leaderboard moves', 'Reward cost'],
  },
  'engagement-social': {
    title: 'Social Engagement',
    description: 'Track social campaigns, influencer posts, shares, comments, and acquisition impact.',
    entityName: 'Social activity',
    primaryAction: 'Add social activity',
    workflows: ['Plan post', 'Track mentions', 'Engage comments', 'Attribute leads'],
    insights: ['Reach', 'Shares', 'Comments', 'Leads created'],
  },
  'engagement-retention': {
    title: 'Member Retention Analytics',
    description: 'Analyze churn risk, renewal opportunities, attendance decay, and retention cohorts.',
    entityName: 'Retention action',
    primaryAction: 'Create retention action',
    workflows: ['Find risk cohort', 'Assign outreach', 'Offer recovery', 'Measure save rate'],
    insights: ['Retention rate', 'Churn risk', 'Saved members', 'Renewal pipeline'],
  },
  'engagement-timeline': {
    title: 'Activity Timeline',
    description: 'Chronological member activity, staff notes, campaign touches, and audit history.',
    entityName: 'Timeline event',
    primaryAction: 'Add timeline note',
    workflows: ['Log event', 'Attach owner', 'Set reminder', 'Review history'],
    insights: ['Events today', 'Open reminders', 'Touch frequency', 'Owner workload'],
  },
  'engagement-followups': {
    title: 'Automated Follow-Ups',
    description: 'Configure automation rules for renewals, missed visits, leads, and feedback recovery.',
    entityName: 'Automation rule',
    primaryAction: 'Create follow-up rule',
    workflows: ['Choose trigger', 'Set delay', 'Pick channel', 'Monitor automation'],
    insights: ['Rules active', 'Runs today', 'Reply rate', 'Failures'],
  },
  'engagement-lead-nurturing': {
    title: 'Lead Nurturing',
    description: 'Nurture leads with staged sequences, trial nudges, offer follow-ups, and conversion tracking.',
    entityName: 'Nurture step',
    primaryAction: 'Create nurture step',
    workflows: ['Segment leads', 'Create sequence', 'Score interest', 'Convert lead'],
    insights: ['MQL count', 'Trials booked', 'Conversion rate', 'Sequence drop-off'],
  },
  'engagement-wishes': {
    title: 'Birthday/Anniversary Wishes',
    description: 'Automate birthday and anniversary wishes with templates, offers, and delivery tracking.',
    entityName: 'Wish template',
    primaryAction: 'Create wish',
    workflows: ['Sync dates', 'Pick template', 'Attach offer', 'Send wishes'],
    insights: ['Wishes due', 'Sent', 'Offer claims', 'Failed sends'],
  },
  'engagement-reengagement': {
    title: 'Re-engagement Campaigns',
    description: 'Recover inactive members through offers, calls, WhatsApp nudges, and trainer follow-up.',
    entityName: 'Re-engagement campaign',
    primaryAction: 'Create recovery campaign',
    workflows: ['Identify inactive', 'Assign trainer', 'Send offer', 'Track return'],
    insights: ['Inactive members', 'Returned', 'Offer use', 'Cost per save'],
  },
  'engagement-conversion': {
    title: 'Conversion Analytics',
    description: 'Measure engagement-to-sale performance across campaigns, leads, offers, and follow-ups.',
    entityName: 'Conversion metric',
    primaryAction: 'Add conversion metric',
    workflows: ['Map source', 'Track funnel', 'Compare channel', 'Export board'],
    insights: ['Lead to member', 'Trial to sale', 'Campaign assisted', 'Revenue lift'],
  },
};

const simpleModules: Record<string, Partial<ModuleConfig>> = {
  referrals: {
    title: 'Referral Management',
    description: 'Referral dashboard, invite tracking, rewards, coupon generation, analytics, leaderboard, and approval flow.',
    entityName: 'Referral',
    primaryAction: 'Create referral',
    statuses: ['Pending', 'Approved', 'Rejected', 'Rewarded', 'Expired'],
    workflows: ['Invite member', 'Track referred lead', 'Approve referral', 'Issue coupon'],
    insights: ['Top referrers', 'Pending rewards', 'Referral revenue', 'Coupon usage'],
  },
  leave: {
    title: 'Leave Requests',
    description: 'Apply leave, approval workflow, balance, calendar planning, manager notifications, and status tracking.',
    entityName: 'Leave request',
    primaryAction: 'Apply leave',
    statuses: statusSets.approval,
    workflows: ['Apply leave', 'Manager review', 'Notify staff', 'Update balance'],
    insights: ['Pending approvals', 'Leave balance', 'Coverage risk', 'Monthly leaves'],
  },
  'trainer-targets': {
    title: 'Trainer Targets',
    description: 'Monthly goals for clients, revenue, attendance, incentives, and achievement tracking.',
    entityName: 'Trainer target',
    primaryAction: 'Create target',
    statuses: ['Not Started', 'On Track', 'At Risk', 'Achieved', 'Incentive Paid'],
    workflows: ['Set target', 'Track progress', 'Calculate incentive', 'Approve payout'],
    insights: ['Revenue target', 'Client target', 'Attendance target', 'Achievement rate'],
  },
  reports: {
    title: 'Advanced Reports',
    description: 'Revenue, attendance, trainer, membership, expense, GST, branch, and analytics exports.',
    entityName: 'Report',
    primaryAction: 'Generate report',
    statuses: ['Ready', 'Queued', 'Exported', 'Scheduled', 'Failed'],
    workflows: ['Choose report', 'Apply date filter', 'Preview charts', 'Export PDF/Excel/CSV'],
    insights: ['Revenue reports', 'GST reports', 'Branch reports', 'Export queue'],
  },
  plans: {
    title: 'Plans Management',
    description: 'Membership, diet, workout, renewal, customization, comparison, and pricing management.',
    entityName: 'Plan',
    primaryAction: 'Create plan',
    statuses: ['Draft', 'Active', 'Archived', 'Promo', 'Renewal Only'],
    workflows: ['Set pricing', 'Add inclusions', 'Compare plans', 'Publish plan'],
    insights: ['Active plans', 'Renewal plans', 'Avg price', 'Most selected'],
  },
  appointments: {
    title: 'Appointments',
    description: 'Booking system, trainer scheduling, calendar view, reminders, slot and availability tracking.',
    entityName: 'Appointment',
    primaryAction: 'Book appointment',
    statuses: ['Requested', 'Confirmed', 'Rescheduled', 'Cancelled', 'Completed'],
    workflows: ['Pick trainer', 'Check slot', 'Send reminder', 'Complete appointment'],
    insights: ['Booked today', 'No-shows', 'Available slots', 'Trainer load'],
  },
  payroll: {
    title: 'Payroll',
    description: 'Salary, payslips, attendance integration, incentives, deductions, tax calculations, history, and exports.',
    entityName: 'Payroll run',
    primaryAction: 'Create payroll run',
    statuses: statusSets.finance,
    workflows: ['Import attendance', 'Calculate salary', 'Apply deductions', 'Export payslips'],
    insights: ['Net payable', 'Incentives', 'Deductions', 'Tax liability'],
  },
  expenses: {
    title: 'Expenses',
    description: 'Expense tracking, categories, receipt upload structure, approval flow, analytics, reports, and budgets.',
    entityName: 'Expense',
    primaryAction: 'Add expense',
    statuses: statusSets.approval,
    workflows: ['Capture expense', 'Attach receipt', 'Approve spend', 'Track budget'],
    insights: ['Monthly spend', 'Budget used', 'Pending approval', 'Top category'],
  },
  'member-analytics': {
    title: 'Member Analytics',
    description: 'Growth, active/inactive users, retention, churn, heatmaps, engagement scoring, and segmentation.',
    entityName: 'Member insight',
    primaryAction: 'Create segment',
    statuses: statusSets.analytics,
    workflows: ['Build segment', 'Review churn', 'Compare cohorts', 'Export insight'],
    insights: ['Growth', 'Retention', 'Churn', 'Engagement score'],
  },
  'billing-analytics': {
    title: 'Billing Analytics',
    description: 'Revenue trends, payment analytics, failures, pending dues, collection, subscriptions, and payment methods.',
    entityName: 'Billing insight',
    primaryAction: 'Create billing view',
    statuses: statusSets.analytics,
    workflows: ['Analyze revenue', 'Review failures', 'Track dues', 'Export collections'],
    insights: ['Revenue trend', 'Failed payments', 'Pending dues', 'Subscription MRR'],
  },
  branches: {
    title: 'Branches',
    description: 'Multi-branch management, analytics, performance, settings, staff assignment, member allocation, and revenue comparison.',
    entityName: 'Branch',
    primaryAction: 'Create branch',
    statuses: ['Active', 'Setup', 'Paused', 'Under Review', 'Closed'],
    workflows: ['Configure branch', 'Assign staff', 'Allocate members', 'Compare revenue'],
    insights: ['Branch revenue', 'Members', 'Staff load', 'Performance rank'],
  },
  staff: {
    title: 'Staff Analytics',
    description: 'Staff performance, attendance, productivity, KPI dashboard, ratings, salary, and shift analytics.',
    entityName: 'Staff KPI',
    primaryAction: 'Create KPI',
    statuses: statusSets.analytics,
    workflows: ['Set KPI', 'Track attendance', 'Review rating', 'Plan shift'],
    insights: ['Productivity', 'Attendance', 'Ratings', 'Salary trend'],
  },
  biometric: {
    title: 'Biometric & Face',
    description: 'Face recognition attendance, biometric logs, device sync, real-time tracking, verification, and access control.',
    entityName: 'Device log',
    primaryAction: 'Add device',
    statuses: ['Online', 'Offline', 'Syncing', 'Failed', 'Verified'],
    workflows: ['Enroll user', 'Sync device', 'Verify entry', 'Review logs'],
    insights: ['Devices online', 'Check-ins', 'Sync failures', 'Access denied'],
  },
  equipment: {
    title: 'Equipments',
    description: 'Inventory, maintenance schedules, service tracking, damage reports, availability, QR/barcode support, and purchase history.',
    entityName: 'Equipment',
    primaryAction: 'Add equipment',
    statuses: statusSets.asset,
    workflows: ['Add inventory', 'Schedule service', 'Report damage', 'Scan QR'],
    insights: ['Available items', 'Maintenance due', 'Damage reports', 'Asset value'],
  },
  notices: {
    title: 'Notice & Rules',
    description: 'Notice management, rule categories, announcement scheduling, rich text structure, push notifications, and archive.',
    entityName: 'Notice',
    primaryAction: 'Create notice',
    statuses: ['Draft', 'Scheduled', 'Published', 'Archived', 'Expired'],
    workflows: ['Write notice', 'Choose audience', 'Schedule publish', 'Archive notice'],
    insights: ['Published', 'Scheduled', 'Acknowledged', 'Archived'],
  },
  billing: {
    title: 'GST & Invoice',
    description: 'GST calculations, invoices, templates, tax reports, PDF invoice structure, billing history, and receipts.',
    entityName: 'Invoice',
    primaryAction: 'Create invoice',
    statuses: statusSets.finance,
    workflows: ['Calculate GST', 'Generate invoice', 'Record payment', 'Export tax report'],
    insights: ['GST collected', 'Invoices', 'Receipts', 'Tax reports'],
  },
  branding: {
    title: 'Branding & App',
    description: 'App branding, logo upload structure, themes, colors, mobile settings, splash screen, domain, and SEO settings.',
    entityName: 'Brand setting',
    primaryAction: 'Save brand setting',
    statuses: ['Draft', 'Active', 'Testing', 'Published', 'Rollback'],
    workflows: ['Upload logo', 'Choose colors', 'Preview mobile app', 'Publish theme'],
    insights: ['Theme version', 'Mobile settings', 'SEO score', 'Domain status'],
  },
  measurements: {
    title: 'Measurements',
    description: 'Body measurements, BMI/BMR calculator, progress charts, before/after comparisons, assessments, history, and goals.',
    entityName: 'Measurement',
    primaryAction: 'Add measurement',
    statuses: ['Logged', 'Reviewed', 'Goal Set', 'Improving', 'Needs Attention'],
    workflows: ['Record metrics', 'Calculate BMI/BMR', 'Compare progress', 'Set goal'],
    insights: ['BMI average', 'Goal progress', 'Assessments', 'Progress photos'],
  },
  workouts: {
    title: 'Workout & Diet',
    description: 'Workout builder, diet planner, exercise library, meal planner, trainer assignment, progress, recommendations, and analytics.',
    entityName: 'Workout/Diet plan',
    primaryAction: 'Create plan',
    statuses: ['Draft', 'Assigned', 'In Progress', 'Completed', 'Updated'],
    workflows: ['Build workout', 'Plan meals', 'Assign trainer', 'Track progress'],
    insights: ['Plans assigned', 'Completion', 'Nutrition score', 'AI recommendations'],
  },
};

const engagementAliases: Record<string, string> = {
  overview: 'engagement-overview',
  dashboard: 'engagement-overview',
  members: 'engagement-members',
  member: 'engagement-members',
  campaigns: 'engagement-campaigns',
  notifications: 'engagement-notifications',
  email: 'engagement-email',
  emails: 'engagement-email',
  whatsapp: 'engagement-whatsapp',
  sms: 'engagement-sms',
  balance: 'engagement-sms',
  push: 'engagement-push',
  offers: 'engagement-offers',
  promotions: 'engagement-offers',
  loyalty: 'engagement-loyalty',
  rewards: 'engagement-rewards',
  feedback: 'engagement-feedback',
  polls: 'engagement-polls',
  surveys: 'engagement-polls',
  reviews: 'engagement-reviews',
  ratings: 'engagement-reviews',
  community: 'engagement-community',
  posts: 'engagement-community',
  events: 'engagement-events',
  challenges: 'engagement-challenges',
  social: 'engagement-social',
  retention: 'engagement-retention',
  timeline: 'engagement-timeline',
  followups: 'engagement-followups',
  'automated-follow-ups': 'engagement-followups',
  nurturing: 'engagement-lead-nurturing',
  'lead-nurturing': 'engagement-lead-nurturing',
  wishes: 'engagement-wishes',
  birthdays: 'engagement-wishes',
  anniversaries: 'engagement-wishes',
  reengagement: 'engagement-reengagement',
  're-engagement': 'engagement-reengagement',
  conversion: 'engagement-conversion',
  analytics: 'engagement-conversion',
};

function pickAccent(key: string): ModuleConfig['accent'] {
  const accents: ModuleConfig['accent'][] = ['blue', 'green', 'yellow', 'purple', 'red'];
  return accents[Math.abs(hash(key)) % accents.length];
}

function hash(value: string) {
  return value.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function buildConfig(key: string, partial: Partial<ModuleConfig>): ModuleConfig {
  const title = partial.title || key.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  return {
    key,
    tab: partial.tab || key,
    title,
    eyebrow: partial.eyebrow || 'Gym operations',
    description: partial.description || 'Manage records, approvals, analytics, and exports for this module.',
    role: partial.role,
    accent: partial.accent || pickAccent(key),
    entityName: partial.entityName || title,
    primaryAction: partial.primaryAction || `Create ${title}`,
    statuses: partial.statuses || statusSets.lifecycle,
    priorities: partial.priorities || ['Low', 'Medium', 'High', 'Urgent'],
    channels: partial.channels || ['Front desk', 'App', 'WhatsApp', 'Email', 'Trainer', 'Branch'],
    fields: partial.fields || defaultFields,
    workflows: partial.workflows || ['Create record', 'Assign owner', 'Track status', 'Export data'],
    insights: partial.insights || ['Open items', 'Completion rate', 'Pending work', 'Value tracked'],
  };
}

export function getModuleConfig(area: string, tab?: string): ModuleConfig {
  const raw = (tab || area || 'overview').toLowerCase();
  const key =
    area === 'engagement'
      ? engagementAliases[raw] || `engagement-${raw}`
      : area === 'training' && raw === 'targets'
        ? 'trainer-targets'
        : area === 'members' && raw === 'referrals'
          ? 'referrals'
          : area === 'finance'
            ? raw
            : area === 'insights' && raw === 'members'
              ? 'member-analytics'
              : area === 'insights' && raw === 'billing'
                ? 'billing-analytics'
                : area === 'settings'
                  ? raw
                  : raw;

  const copy = moduleCopy[key] || simpleModules[key] || {};
  return buildConfig(key, { tab: raw, ...copy, role: copy.role || adminRoleFor(key) });
}

function adminRoleFor(key: string): Role | undefined {
  if (['referrals', 'appointments'].includes(key)) return undefined;
  if (key.startsWith('engagement-') && !['engagement-notifications', 'engagement-whatsapp', 'engagement-sms', 'engagement-community', 'engagement-challenges'].includes(key)) return 'admin';
  return ['payroll', 'expenses', 'reports', 'plans', 'trainer-targets', 'branches', 'staff', 'biometric', 'equipment', 'notices', 'billing', 'branding', 'measurements', 'workouts', 'member-analytics', 'billing-analytics', 'leave'].includes(key)
    ? 'admin'
    : undefined;
}

export function seedRecords(config: ModuleConfig): ModuleRecord[] {
  const owners = ['Aarav Sharma', 'Priya Nair', 'Rohan Mehta', 'Sneha Iyer', 'Karan Patel', 'Nisha Rao'];
  return Array.from({ length: 14 }).map((_, index) => {
    const status = config.statuses[index % config.statuses.length];
    const priority = config.priorities[(index + 1) % config.priorities.length];
    const channel = config.channels[(index + 2) % config.channels.length];
    const day = new Date();
    day.setDate(day.getDate() + index - 4);
    return {
      id: `${config.key}-${index + 1}`,
      title: `${config.entityName} ${index + 1}`,
      owner: owners[index % owners.length],
      status,
      priority,
      amount: 1500 + index * 725,
      dueDate: day.toISOString().slice(0, 10),
      channel,
      notes: `${config.workflows[index % config.workflows.length]} is ready for review.`,
      createdAt: new Date(Date.now() - index * 86400000).toISOString(),
    };
  });
}
