# 619 v3 — Integration Guide

How to apply everything that was just delivered to your existing v2 codebase.

## What was delivered (17 files)

### Documentation (3)
- `ARCHITECTURE.md` — master plan: modules, stack, API, wireframes, beyond-Glofox features
- `V3_INTEGRATION_GUIDE.md` — this file
- `wireframes.html` — open in any browser to see the 4 redesigned screens

### Database (1)
- `supabase-schema-v3.sql` — additive migration; safe on top of your existing v2 schema

### Backend modules (8)
- `backend/src/middleware/rbac.js` — role-based access control
- `backend/src/middleware/validate.js` — Zod-style request validation
- `backend/src/middleware/errorHandler.js` — central error responses
- `backend/src/modules/members/members.service.js` + `members.routes.js`
- `backend/src/modules/bookings/bookings.service.js` + `bookings.routes.js`  ← capacity + waitlist
- `backend/src/modules/notifications/notifications.service.js` + `notifications.routes.js`  ← multi-channel
- `backend/src/modules/sessions/sessions.routes.js` — PT scheduling with conflict detection
- `backend/src/modules/reports/reports.routes.js` — revenue, payouts, dues, CSV export
- `backend/src/workers/renewal.worker.js` — daily reminders + auto-renewal job
- `backend/src/server.v3.js` — composed v3 server (mount alongside your existing server.js)

### Frontend dashboards (3)
- `frontend/src/app/(admin)/dashboard/page.tsx`
- `frontend/src/app/(trainer)/dashboard/page.tsx`
- `frontend/src/app/(member)/dashboard/page.tsx`
- `frontend/src/app/(member)/classes/page.tsx`

---

## Step-by-step rollout

### 1. See the UI immediately
Double-click `wireframes.html` in Explorer. Tab between Admin / Trainer / Member / Booking views in your browser. No build required — it's pure HTML + Tailwind CDN. Use this to align stakeholders before any code goes in.

### 2. Apply the database migration
Open Supabase → SQL Editor → New query → paste contents of `supabase-schema-v3.sql` → Run.

The migration is **additive** and idempotent. Your v2 tables (`clients`, `payments`, etc.) keep working untouched. New tables (`members`, `bookings`, `class_sessions`, etc.) get created. Existing `clients` rows are auto-backfilled into `members`.

Verify with:
```sql
SELECT count(*) FROM members;            -- should ≥ count(*) from clients
SELECT count(*) FROM class_sessions;     -- ~42 (3 schedules × 14 days)
SELECT * FROM v_member_active_membership LIMIT 5;
```

### 3. Wire up the new backend
Two options:

**Option A — Run side-by-side (recommended):**
Keep `server.js` (v2) running on port 4000 for your current frontend. Run `server.v3.js` on port 4001 for new endpoints. Frontend can call both.

```bash
cd backend
npm i helmet express-rate-limit         # only new deps for v3
PORT=4001 node src/server.v3.js
```

**Option B — Merge into v2 server:**
In your existing `backend/src/server.js`, add:
```js
app.use('/api/v1/members',       require('./modules/members/members.routes'));
app.use('/api/v1/bookings',      require('./modules/bookings/bookings.routes'));
app.use('/api/v1/pt-sessions',   require('./modules/sessions/sessions.routes'));
app.use('/api/v1/notifications', require('./modules/notifications/notifications.routes'));
app.use('/api/v1/reports',       require('./modules/reports/reports.routes'));
```

### 4. Schedule the worker
The renewal worker handles class reminders, expiry nudges, and auto-renewal in one daily run.

Local dev:
```bash
node backend/src/workers/renewal.worker.js
```

Production options:
- Vercel Cron: add to `vercel.json` schedule pointing at `/api/cron/run-worker`
- Railway/Fly: add a sidecar process: `node src/workers/renewal.worker.js`
- Linux server: cron entry `0 6 * * * cd /app && node src/workers/renewal.worker.js`

### 5. Add Tailwind to the frontend
Your v2 uses custom CSS. The new dashboards expect Tailwind. Add it without breaking existing pages:

```bash
cd frontend
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:
```js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};
```

Add to `src/app/globals.css` (top):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Existing pages styled with custom CSS keep working; new pages use Tailwind.

### 6. Update the auth `Guard` for the member role
Your `Guard.tsx` only knows about `'admin' | 'trainer'`. Edit one line:

```diff
- interface Props { children: React.ReactNode; role?: 'admin'|'trainer'; }
+ interface Props { children: React.ReactNode; role?: 'admin'|'trainer'|'member'; }
```

### 7. Wire the route groups
Next.js App Router treats `(admin)`, `(trainer)`, `(member)` as **route groups** — folder-level grouping that doesn't appear in the URL. So `/(admin)/dashboard/page.tsx` renders at `/dashboard`. To route by role:

In your top-level redirect (currently `src/app/page.tsx`):
```tsx
useEffect(() => {
  if (!loading && user) {
    const dashboards = { admin:'/dashboard', trainer:'/dashboard', member:'/dashboard' };
    router.replace(dashboards[user.role] || '/login');
  }
}, [user, loading]);
```

Because all three role groups have a `dashboard/page.tsx`, you'll need to pick which one to render based on role. Two patterns:

**Pattern A (clean):** middleware-level redirect to role-specific path:
- Move dashboards to `/admin/dashboard`, `/trainer/dashboard`, `/member/dashboard` (drop the parens)
- After login, redirect to `/${user.role}/dashboard`

**Pattern B:** keep route groups, render conditionally inside one `dashboard/page.tsx`:
```tsx
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin')   return <AdminDashboardPage />;
  if (user?.role === 'trainer') return <TrainerDashboard />;
  if (user?.role === 'member')  return <MemberDashboardPage />;
}
```

Pattern A is more idiomatic; Pattern B requires no URL changes.

### 8. (When ready) Razorpay integration
The `payments` table now has `gateway`, `gateway_txn_id`, `gateway_status` columns and `RAZORPAY` is an allowed method. To wire it up:

```js
// backend/src/modules/payments/checkout.js
const Razorpay = require('razorpay');
const rz = new Razorpay({ key_id: process.env.RZP_KEY, key_secret: process.env.RZP_SECRET });

router.post('/checkout', auth, wrap(async (req, res) => {
  const order = await rz.orders.create({
    amount: req.body.amount * 100, currency: 'INR',
    notes: { member_id: req.user.member_id, membership_id: req.body.membership_id },
  });
  res.json({ data: { order_id: order.id, key: process.env.RZP_KEY } });
}));

router.post('/webhook', express.raw({ type:'*/*' }), wrap(async (req, res) => {
  // Verify signature, then INSERT INTO payments with gateway='razorpay', gateway_status=event.payload.payment.entity.status
  // ...
}));
```

The auto-renewal worker has a stubbed call to `razorpay.subscriptions.charge`; replace that with a real e-NACH/UPI mandate flow.

---

## Mapping to your original requirements

| Your requirement | Where it lives |
|---|---|
| 1. Admin / Trainer / Member roles | `users.role` constraint extended in v3 SQL; member portal at `(member)/*` |
| 2. Trainer dashboard with payouts | `(trainer)/dashboard/page.tsx`, `v_trainer_monthly_earnings` view, `/api/v1/reports/trainer-payouts` |
| 3. Member management (active/expired/new/payment status) | `members.service.js` list with filters; admin dashboard KPIs |
| 4. Payments with month/trainer/plan filters | `/api/v1/reports/revenue?group_by=month\|trainer\|plan` |
| 5. Three role-specific dashboards | `(admin)`, `(trainer)`, `(member)` route groups |
| 6. Class booking + PT scheduling + notifications + QR + auto-renewal + reports | `bookings`, `sessions`, `notifications`, `qr_tokens`, `renewal.worker.js`, `reports` modules |
| 7. Modern SaaS UI, mobile-first, card layout | All new dashboards use Tailwind, gradient cards, responsive grids; `wireframes.html` is the spec |
| 8. Tech stack | Next.js + Express + PostgreSQL kept; ARCHITECTURE.md §3 for the full stack |
| 9. DB schema for users/memberships/payments/payouts/sessions/attendance | `supabase-schema-v3.sql` covers all of these |
| 10. Reports + CSV/PDF export | `/api/v1/reports/export?type=&format=csv` |
| Improvements beyond Glofox | ARCHITECTURE.md §9 — 12 differentiators |

---

## Recommended next steps

1. **Tonight (1 hr):** Open `wireframes.html`, share with anyone reviewing — get sign-off on the look.
2. **Tomorrow (½ day):** Apply `supabase-schema-v3.sql` to a *staging* DB. Verify backfill.
3. **This week:** Stand up `server.v3.js` on port 4001, hit `/api/health`, then `/api/v1/members` with an admin JWT.
4. **Next sprint:** Pick ONE module to ship end-to-end (recommend: member portal login + dashboard read-only). Then add booking. Don't try to ship all 12 modules at once.
5. **Within 4 weeks:** WhatsApp template approval (takes 1-2 weeks lead time from Meta) — start the paperwork now since it's the biggest delight feature.
