# 619 ERP v2 — Code Review / Issues Report

Scope: full review of `backend/`, `frontend/`, `supabase-schema.sql`, configs, and deployment guide. Issues are grouped by severity. Each item has a file/line reference where possible.

---

## CRITICAL — Fix Immediately

### 1. Production secrets are in `backend/.env`
**File:** `backend/.env`
```
DATABASE_URL=postgresql://postgres.adffjnztzrolibtuvhgc:7MvtQzhRsLq66lAo@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
JWT_SECRET=8d3897d79b76dcbf8851fa1af24618524e22e237f4200730506eaeb730e77d6060747d465c0d8c7c30eca3814c698b3b
```
This file contains the real Supabase database password and the production JWT signing key. `.env` is in `.gitignore`, but the file is sitting in the working tree. If this folder was ever pushed before `.gitignore` was added, copied/zipped, or shared, those secrets are compromised.

**Action:**
- Rotate the Supabase database password immediately.
- Generate a new `JWT_SECRET` (which will invalidate all existing logins — that's the desired effect).
- Confirm `git log --all -- backend/.env` shows nothing if the repo was ever initialized.
- Replace `.env` with `.env.example` containing dummy values.

### 2. Login rate-limiter is registered too late and never runs
**File:** `backend/src/server.js` lines 71 and 80
```js
app.use('/api/auth', require('./routes/auth'));   // line 71 — handles /api/auth/login
...
app.post('/api/auth/login', loginLimiter);        // line 80 — never reached
```
The auth router on line 71 fully handles `POST /api/auth/login` and sends the response. The dedicated `loginLimiter` middleware on line 80 is registered after the router so Express never reaches it. Login is only throttled by the general 2000-per-15-min limiter, not the intended 30-per-15-min limiter — brute-force protection is effectively disabled.

**Fix:** Mount `loginLimiter` *before* the auth router:
```js
app.post('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
```

### 3. CORS allows any origin with credentials
**File:** `backend/src/server.js` lines 20–25
```js
app.use(cors({ origin: true, credentials: true, ... }));
```
`origin: true` reflects whatever Origin the request sends, and `credentials: true` allows credentials. Any website your users visit can issue authenticated requests against your API on their behalf. The bearer-token model partially limits the blast radius (no cookies are sent automatically) but the CORS policy is still wide open.

**Fix:** Use the `FRONTEND_URL` env var you already have:
```js
const allowed = [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);
app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.includes(o)), credentials: true, ... }));
```

### 4. Frontend ↔ backend API mismatches break two features
**File:** `frontend/src/lib/api.ts` vs `backend/src/routes/auth.js`

a. **Create-user is broken.** Frontend `api.auth.createUser` POSTs to `/api/auth/users`, but the backend route is `POST /api/auth/create-user`. The Settings → "Create Login Account" form will always 404.

b. **Change-password is broken.** Frontend uses `POST /api/auth/change-password` with body `{current, newPw}`. Backend uses `PUT /api/auth/change-password` with body `{currentPassword, newPassword}`. Wrong method *and* wrong field names — every password change attempt fails.

**Fix:** pick one contract and align both sides. Suggested:
```ts
// api.ts
createUser: (data) => req('/api/auth/create-user', { method:'POST', body: JSON.stringify(data) }),
changePassword: (currentPassword, newPassword) =>
  req('/api/auth/change-password', { method:'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
```

### 5. SQL injection patterns (low actual risk, bad practice)
**Files:** `backend/src/routes/reports.js` line 65, `backend/src/routes/attendance.js` line 62
```js
${tid ? "AND c.trainer_id='" + tid + "'" : ''}     // reports.js /dues
${req.user.role === 'trainer' ... ? `AND a.trainer_id = '${req.user.trainer_id}'` : ''}  // attendance.js
```
These interpolate `req.user.trainer_id` directly into SQL. The values come from the DB so the *exploitable* risk is small today, but if a trainer record ever has an apostrophe in `trainer_id` (or one is created via a different flow), this breaks. Use parameterized queries like the other routes do.

---

## HIGH — Real Bugs Affecting Functionality

### 6. Fallback API URL in `api.ts` doesn't match the deployment guide
**File:** `frontend/src/lib/api.ts` line 5
```ts
const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://six19-erp-api.onrender.com';
```
The deployment guide and Render service name use `619-erp-api.onrender.com`. The fallback says `six19-erp-api.onrender.com`. If `NEXT_PUBLIC_API_URL` is ever missing on Vercel, every API call goes to a domain that probably doesn't exist.

### 7. Trainer can re-assign a client to another trainer (privilege issue)
**File:** `backend/src/routes/clients.js` PUT `/:id`, lines 174–192
The POST route correctly forces `trainer_id = req.user.trainer_id` for trainer-role users. The PUT route does **not** — it accepts whatever `trainer_id` the request body sends. A trainer who knows a client's UUID can edit that client and re-assign them (or unset the trainer). The 403 check at line 167 only verifies they currently own the row.

**Fix:** mirror the POST logic:
```js
const trainer_id = req.user.role === 'trainer' ? req.user.trainer_id : (d.trainer_id || null);
```

### 8. `parseFloat(...) ?? fallback` does not behave like you expect
**File:** `backend/src/routes/clients.js` PUT, lines 169–172
```js
const base = parseFloat(d.base_amount) ?? existing[0].base_amount;
```
`parseFloat('')` returns `NaN`, not `null`/`undefined`, so `??` does **not** fall back. NaN flows into the SQL UPDATE and stores NaN/`null` in the numeric columns. Replace with:
```js
const base = Number.isFinite(parseFloat(d.base_amount)) ? parseFloat(d.base_amount) : existing[0].base_amount;
```
Same pattern for `disc`, `final`, `paid`.

### 9. `incentive_rate` default kicks in for legitimate value `0`
**Files:** `backend/src/routes/payments.js` line 61, `backend/src/routes/clients.js` line 140
```js
const rate = parseFloat(tr[0]?.incentive_rate || 0.5);
```
If a trainer has `incentive_rate = 0` (someone with no incentive at all), `0 || 0.5` evaluates to `0.5` and they unexpectedly get 50% incentive. Use `??` instead of `||`.

### 10. `/trainers` page exposes salaries to non-admin users
**Files:** `frontend/src/app/trainers/page.tsx` line 6, `backend/src/routes/trainers.js` line 8
The `/trainers` page is rendered without `<Guard role="admin">` (every other admin-only page has it). The backend `GET /api/trainers` and `GET /api/trainers/:id` are also not protected by `adminOnly` — they only require `auth`. So any authenticated trainer can list every other trainer's salary, incentive rate, mobile, address, etc. via the API or the page UI.

**Fix:** wrap the page in `<Guard role="admin">`, and add `adminOnly` to the trainer list/get routes (or scope the response to omit salary/incentive for non-admin viewers).

### 11. Race / inconsistency on payments
**Files:** `backend/src/routes/clients.js` POST, `backend/src/routes/payments.js` POST/DELETE

- Client POST inserts a client row, then conditionally inserts a payment. There's no transaction; if the payment insert fails, the client exists with `balance_amount` already net of the unpaid payment.
- Payment DELETE reverses `balance_amount` and `paid_amount` outside a transaction; concurrent payment creates/deletes can interleave and leave totals wrong.

**Fix:** wrap both flows in `BEGIN; ... COMMIT;` using a single client checked out from the pool.

### 12. Auto-expire write on every clients GET
**File:** `backend/src/routes/clients.js` lines 44–45
```js
await pool.query(`UPDATE clients SET status='expired', updated_at=NOW() WHERE status='active' AND pt_end_date < CURRENT_DATE`);
```
Runs on **every** call to `GET /api/clients` for every user — full-table scan + write. As the table grows or under list polling, this creates lock contention and unnecessary writes. Move it to a daily scheduled job (cron / pg_cron / Render cron) or a trigger.

### 13. Reports page destructuring is fragile
**File:** `frontend/src/app/reports/page.tsx` lines 25–34
```js
const calls = [api.reports.monthly(year)];
if (isAdmin) calls.push(api.reports.trainerSummary());
calls.push(api.reports.dues());
Promise.all(calls).then(([m, t, d]) => { ... else setDues(t); })
```
For trainers, only two promises resolve, so `d` is `undefined` and `t` is the dues array. The branch handles it (`setDues(t)`), but it's confusing and one accidental edit will break it. Reorder so positions are stable:
```js
const [monthlyR, duesR, trainersR] = await Promise.all([
  api.reports.monthly(year), api.reports.dues(),
  isAdmin ? api.reports.trainerSummary() : Promise.resolve([])
]);
```

### 14. SQL seed has bcrypt hashes the comments admit may be wrong
**File:** `supabase-schema.sql` lines 234–251
The schema inserts hardcoded bcrypt hashes for the demo accounts and the comment block at line 226+ explicitly says these "may not match the actual bcrypt output on your system." If a user follows the deployment guide and skips `seed.js`, login will fail and they'll think the app is broken. The seed step should be mandatory and the SQL hashes should be omitted.

### 15. `auth.js` ignores its own helper
**File:** `backend/src/routes/auth.js`
The file imports `adminOnly` from middleware but never uses it — instead every admin route has an inline `if (req.user.role !== 'admin') return 403`. Easy place for someone to forget the check on a future route. Standardize on `adminOnly` middleware.

---

## MEDIUM — Quality, UX, Maintainability

### 16. `tsconfig.json` has `strict: false`
**File:** `frontend/tsconfig.json`
With strict mode off, optional fields like `Client.balance_amount?: number` resolve to `number | undefined`, and code like `c.balance_amount > 0` silently compares undefined → false without a TS error. Turn strict mode on; expect to fix a wave of type errors but you'll catch real bugs.

### 17. Dead schema — tables exist but no UI/routes
**File:** `supabase-schema.sql`
- `weight_logs` — fetched in `GET /api/clients/:id` but no UI to add entries and no POST route.
- `renewals`, `incentives`, `plans`, `settings` — defined in schema but no API routes or pages reference them.

Either implement them or drop the tables to reduce confusion.

### 18. Browser-only `confirm()` / `alert()` everywhere
**Files:** `frontend/src/app/clients/page.tsx`, `payments/page.tsx`, `trainers/page.tsx`, `settings/page.tsx`
Native confirm/alert are jarring, can't be styled, and don't match the rest of the dark UI. Replace with a small modal component.

### 19. `/clients` "Expiring" filter pill always shows count `0`
**File:** `frontend/src/app/clients/page.tsx` line 67
```js
['Expiring','expiring',0,'var(--blue)'],
```
Hardcoded zero. Filter works server-side but the pill never reflects how many clients match.

### 20. Tokens in `localStorage`
**File:** `frontend/src/lib/auth-context.tsx`
JWT in `localStorage` is the normal SPA pattern but is XSS-readable. Anything that injects a `<script>` (analytics, third-party widget, dependency compromise) can exfiltrate the token. Consider httpOnly cookie + CSRF token if you ever embed third-party JS.

### 21. `client_id` generation is racy
**File:** `backend/src/routes/clients.js` lines 97–102
```js
SELECT client_id FROM clients ORDER BY client_id DESC LIMIT 1
// then increment in JS and INSERT
```
Two concurrent client creates can read the same `last` and try to insert the same `FS0042`. The schema's UNIQUE constraint on `client_id` will reject one with a 500 error. Use a sequence (`CREATE SEQUENCE clients_client_id_seq`) and `nextval` in the INSERT, or wrap in a `SELECT ... FOR UPDATE` transaction.

### 22. No DB trigger for `updated_at`
Every route manually appends `updated_at = NOW()` to UPDATE statements. One missed UPDATE leaves a stale value. Add a generic trigger:
```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;
-- attach to each table with updated_at
```

### 23. Health check is rate-limited
**File:** `backend/src/server.js`
`/api/health` is included under `apiLimiter`. Render's keep-alive pingers (or your own uptime monitor) will eventually trip the limit. Mount `/api/health` *before* `app.use('/api/', apiLimiter)`.

### 24. `paid_amount` reversal on payment DELETE can desync
**File:** `backend/src/routes/payments.js` lines 101–107
`paid_amount = GREATEST(0, paid_amount - $1)` clamps at zero, but `balance_amount = balance_amount + $1` does not. After enough deletes you can end up with `paid + balance ≠ final`. Compute both from a `SUM(payments.amount)` view, or recalculate both atomically.

### 25. Trainer sees all clients on attendance page (filter by status only)
**File:** `frontend/src/app/attendance/page.tsx` line 24
The frontend requests `api.clients.list({ status:'active' })` without a trainer filter. The backend correctly scopes trainers' results, but for admins this returns *all* active clients (which is fine). For very large gyms the page will be slow — consider pagination/search.

### 26. `next.config.js` `compiler.styledComponents: false` is a no-op
**File:** `frontend/next.config.js`
That's the default. The comment in the file ("suppress hydration warnings from browser extensions") doesn't match what the option does. Remove or replace with a real fix.

### 27. `app.options('*', …)` and `app.use('/api/*', …)`
**File:** `backend/src/server.js`
These work in Express 4 (your current version) but break in Express 5 (`path-to-regexp` v6 rejects bare wildcards). Pin to Express 4 in `engines` or migrate to `'/*splat'`.

### 28. `ssl: { rejectUnauthorized: false }`
**File:** `backend/src/db/pool.js`
Standard for Supabase pooler but disables certificate verification end-to-end. Acceptable here, but flag it for future hardening (download Supabase's CA cert and pass it in `ssl.ca`).

### 29. Password policy too weak
6 characters minimum, no complexity check, no breached-password check. For an app holding payment records, a 10–12 char minimum and a quick check against the top 1k common passwords would be cheap and significant.

---

## LOW — Polish

- `Sidebar` "Attendance" link goes to `/attendance` for everyone — fine, but the page is wrapped in `Guard` (no role) so any logged-in user can attend. Confirm that's intended.
- `BarChart` in `dashboard/page.tsx` mixes absolute-positioned month labels inside a flex column — labels get crowded on narrow widths.
- Reports page month label row is rendered separately from the bars; on long Hindi/Indian month names they could misalign.
- Lots of inline styles instead of CSS classes — fine, just inconsistent with the otherwise class-based `globals.css`.
- `frontend/package.json` — no ESLint config / `next lint` rules pinned.
- `backend/package.json` — no test framework, no `.eslintrc`.

---

## Suggested Fix Order

1. Rotate `.env` secrets and remove the file from disk.
2. Fix the login rate-limiter ordering (5-line change, big impact).
3. Tighten CORS to `FRONTEND_URL`.
4. Repair the create-user / change-password endpoint mismatches.
5. Add `<Guard role="admin">` to `/trainers` and `adminOnly` to the trainers list/get routes.
6. Force `trainer_id` on `PUT /api/clients/:id` for trainer-role users.
7. Replace `parseFloat(...) ?? fallback` with `Number.isFinite` guards.
8. Move auto-expire and bcrypt-hash seeding out of hot paths.
9. Wrap multi-statement flows in transactions.
10. Turn on `strict: true` in `tsconfig.json` and clean up the type errors that surface.
