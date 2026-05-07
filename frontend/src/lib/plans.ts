/**
 * Shared Membership Plans utility
 * Plans are stored in localStorage under PLANS_KEY.
 * All form pages read from here so plans stay in sync.
 */

export const PLANS_KEY = '619_plans_v1';

export type PlanKind = 'Membership' | 'PT';
export type PlanDuration = 'Monthly' | 'Quarterly' | 'Half Yearly' | 'Yearly';

export interface StoredPlan {
  id: string;
  kind: PlanKind;
  name: string;
  duration: PlanDuration;
  base_amount: number;
  discount: number;
  final_amount: number;
  sessions_per_week?: number;
  features: string[];
  popular?: boolean;
}

export const DURATIONS: PlanDuration[] = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'];

export const DEFAULT_PLANS: StoredPlan[] = [
  { id: 'm-monthly', kind: 'Membership', name: 'Monthly Membership', duration: 'Monthly', base_amount: 2500, discount: 0, final_amount: 2500, features: ['Full gym access', 'Locker facility', 'Free trial class'] },
  { id: 'm-qrt', kind: 'Membership', name: 'Quarterly Membership', duration: 'Quarterly', base_amount: 7000, discount: 500, final_amount: 6500, popular: true, features: ['Full gym access', 'Locker', '1 Body composition test', 'Free diet consult'] },
  { id: 'm-half', kind: 'Membership', name: 'Half-Yearly Membership', duration: 'Half Yearly', base_amount: 13000, discount: 1500, final_amount: 11500, features: ['Full gym access', 'Locker', 'Body composition test', 'Free diet consult', 'Group class access'] },
  { id: 'm-year', kind: 'Membership', name: 'Annual Membership', duration: 'Yearly', base_amount: 24000, discount: 4000, final_amount: 20000, features: ['Full gym access', 'Personal locker', 'Quarterly body comp tests', 'Diet plan', 'All group classes', 'Friend bring-a-day pass'] },
  { id: 'pt-monthly', kind: 'PT', name: 'PT Monthly', duration: 'Monthly', base_amount: 6000, discount: 0, final_amount: 6000, sessions_per_week: 3, features: ['12 PT sessions / month', 'Personalised workout plan', 'Form & technique correction'] },
  { id: 'pt-qrt', kind: 'PT', name: 'PT Quarterly', duration: 'Quarterly', base_amount: 16500, discount: 1500, final_amount: 15000, sessions_per_week: 3, popular: true, features: ['36 PT sessions', 'Personalised plan', 'Diet consultation', 'Progress photos'] },
  { id: 'pt-half', kind: 'PT', name: 'PT Half-Yearly', duration: 'Half Yearly', base_amount: 30000, discount: 4000, final_amount: 26000, sessions_per_week: 3, features: ['72 PT sessions', 'Custom workout plan', 'Detailed diet plan', 'Body comp tests', 'Free supplements consult'] },
  { id: 'pt-year', kind: 'PT', name: 'PT Annual', duration: 'Yearly', base_amount: 55000, discount: 10000, final_amount: 45000, sessions_per_week: 3, features: ['144+ PT sessions', 'Premium plan & diet', 'Quarterly body comp tests', 'Supplements consult', 'Priority slot booking'] },
];

/** Read plans from localStorage (SSR-safe). Returns DEFAULT_PLANS if none saved. */
export function getStoredPlans(): StoredPlan[] {
  if (typeof window === 'undefined') return DEFAULT_PLANS;
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    if (raw) {
      const parsed: StoredPlan[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_PLANS;
}

export function savePlans(plans: StoredPlan[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PLANS_KEY, JSON.stringify(plans)); } catch { /* ignore */ }
}

/** Names of Membership plans (for dropdowns) */
export function getMembershipPlanNames(plans: StoredPlan[]): string[] {
  const names = plans.filter((p) => p.kind === 'Membership').map((p) => p.name);
  return names.length > 0 ? names : ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'];
}

/** Names of PT plans (for dropdowns) */
export function getPTPlanNames(plans: StoredPlan[]): string[] {
  const names = plans.filter((p) => p.kind === 'PT').map((p) => p.name);
  return names.length > 0 ? names : ['PT Monthly', 'PT Quarterly', 'PT Half-Yearly', 'PT Annual'];
}

/** Get price for a plan by name */
export function getPlanPrice(plans: StoredPlan[], name: string): number {
  return plans.find((p) => p.name === name)?.final_amount ?? 0;
}

/** Get plan object by name */
export function getPlanByName(plans: StoredPlan[], name: string): StoredPlan | undefined {
  return plans.find((p) => p.name === name);
}
