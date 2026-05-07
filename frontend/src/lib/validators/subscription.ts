// src/lib/validators/subscription.ts
//
// Shared client-side validation for the membership subscription flows.
// Mirrors the backend checks in `backend/src/routes/client-actions.js` so
// errors surface immediately instead of after a round-trip. Per blueprint
// §2.6, the same rules MUST run on both ends — the server is the source of
// truth, but the client gets the user's attention faster.
//
// Used by:
//   - frontend/src/app/clients/[id]/add-subscription/page.tsx
//   - frontend/src/app/clients/[id]/renew-subscription/page.tsx
//   - frontend/src/app/clients/[id]/upgrade/page.tsx (and siblings, when
//     they reuse the multi-row plan picker)

export interface PlanRowInput {
  plan: string;
  startDate: string;
  endDate: string;
  basePrice: string | number;
  sellingPrice: string | number;
  coupon?: string | null;
}

export interface ValidationResult<T> {
  /** First human-readable error encountered, or null on success. */
  error: string | null;
  /** Normalised rows on success. */
  rows?: T[];
}

/**
 * Validate the rows entered in the subscription / renewal table. Returns
 * the first error so the form can show it inline; returning early keeps
 * the toast cycle simple (one error per submit attempt).
 *
 * Rules:
 *   1. At least one row.
 *   2. Each row picks a plan, has start + end, end > start.
 *   3. Selling price > 0 (paid subs only — trials use a separate flow).
 *   4. Base price >= 0.
 *   5. Selling price not absurdly higher than base (catches typos like
 *      ₹65,000 instead of ₹6,500). Threshold: 1.5×.
 */
export function validatePlanRows(
  rows: PlanRowInput[],
): ValidationResult<PlanRowInput> {
  if (!rows || rows.length === 0) {
    return { error: 'Add at least one plan row' };
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const n = i + 1;

    if (!r.plan) return { error: `Row ${n}: pick a membership plan` };
    if (!r.startDate) return { error: `Row ${n}: start date is required` };
    if (!r.endDate) return { error: `Row ${n}: end date is required` };

    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    if (Number.isNaN(start.getTime())) {
      return { error: `Row ${n}: start date is invalid` };
    }
    if (Number.isNaN(end.getTime())) {
      return { error: `Row ${n}: end date is invalid` };
    }
    if (end <= start) {
      return { error: `Row ${n}: end date must be after start date` };
    }

    const base = Number(r.basePrice);
    const sell = Number(r.sellingPrice);

    if (Number.isNaN(sell) || sell <= 0) {
      return { error: `Row ${n}: selling price must be greater than 0` };
    }
    if (Number.isNaN(base) || base < 0) {
      return { error: `Row ${n}: base price cannot be negative` };
    }
    if (base > 0 && sell > base * 1.5) {
      return {
        error: `Row ${n}: selling price looks suspiciously higher than base — please double-check`,
      };
    }
  }

  return { error: null, rows };
}

/**
 * Convenience wrapper that throws the validation error so call sites can
 * use `try/catch` flow control if they prefer that to the result object.
 */
export function assertValidPlanRows(rows: PlanRowInput[]): void {
  const { error } = validatePlanRows(rows);
  if (error) throw new Error(error);
}
