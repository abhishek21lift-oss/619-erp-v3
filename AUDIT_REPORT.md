# 619 Fitness ERP — Audit Report

Date: 2026-04-30
Scope: bugs, security, schema/data consistency, code duplication
Live entry point: `backend/src/server.js` + `backend/src/routes/*` (the v3 server, modules folder, and `(admin)/(member)/(trainer)` route groups are treated as experimental and were left untouched).

Each item below is tagged with a severity and shows the file path, the issue, and what was changed. Items marked **NOT FIXED** are deliberate — typically because they're cosmetic, would require a schema migration on a live system, or live in the experimental v3 code path you said to ignore.

---

## CRITICAL — must be acted on before/at next deploy

### C1. Real production secrets sit in `backend/.env` inside the workspace

**File:** `backend/.env`

The file contains a live Supabase connection string (with DB password) and the live JWT secret:

```
DATABASE_URL=postgresql://postgres.adffjnztzrolibtuvhgc:gRk0QfE9j39H6O3r@…
JWT_SECRET=b79ded4f0c87832c…
```

`backend/.gitignore` does list `.env`, so a fresh `git add .` will skip it — but:

- If `.env` was ever committed before `.gitignore` was added, the secret is in git history forever.
- Anyone who has cloned/forked the repo, or anyone who looks at older commits, has the secret.
- The DEPLOYMENT_GUIDE tells new operators to run `git add .` from inside `backend/` after creating `.env`, which is a footgun.

**Action — CANNOT be fixed by editing code.** You must:

1. Rotate the Supabase database password (Supabase → Settings → Database → Reset password).
2. Generate a new JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
3. Update both values in Render → Environment, save, redeploy.
4. Run `git log -- backend/.env` locally to check whether it was ever committed; if yes, treat it as fully exposed.

**Mitigation added:** `backend/.env.example` and `frontend/.env.local.example` are now present so you don't have to keep editing the live `.env` to remember the shape.

---

### C2. Trainer can record a payment against ANOTHER trainer's client

**File:** `backend/src/routes/payments.js` (POST `/`)

Before the fix, the route only verified the JWT and that the client exists; it never checked that the trainer owns that client. A trainer who knows or guesses any `client_id` could POST a payment that would (a) inflate their own incentive (`incentive_amt` is computed from the trainer linked to the client, so this attack actually credits the *correct* trainer — but the trainer can also alter the data of clients they shouldn't see), and (b) update another trainer's client balance.

**Fixed.** Added an RBAC check inside the transaction:

```js
if (req.user.role === 'trainer' && cl[0].trainer_id !== req.user.trainer_id) {
  await tx.query('ROLLBACK');
  return res.status(403).json({ error: 'Access denied: client is not assigned to you' });
}
```

---

### C3. Trainer can mark attendance for ANY client / ANY trainer

**File:** `backend/src/routes/attendance.js` (POST `/`)

Same shape of bug: no ownership check. Attendance records have a UNIQUE (type, ref_id, date) constraint with ON CONFLICT DO UPDATE, so a trainer could overwrite another trainer's clients' attendance.

**Fixed.** Added:

- For `type === 'client'`: look up the client and reject if `trainer_id !== req.user.trainer_id`.
- For `type === 'trainer'`: only allow marking your own attendance.
- Force `d.trainer_id = req.user.trainer_id` so a trainer can't pretend to mark on behalf of someone else.

---

### C4. Sequential `client_id` ("FS0001"…) had a race

**File:** `backend/src/routes/clients.js` (POST `/`)

The original SQL:

```sql
SELECT client_id FROM clients ORDER BY client_id DESC LIMIT 1 FOR UPDATE
```

`FOR UPDATE` only locks the row(s) returned, not the table or any future inserts. Two concurrent POSTs can both read `FS0008`, both compute `FS0009`, and one will fail at INSERT (UNIQUE constraint), surfacing as a 500. Worse, the lexicographic ORDER BY breaks once you cross 9999 (`FS10000` < `FS9999`).

**Fixed.** Two changes:

1. Acquire `pg_advisory_xact_lock(hashtext('clients_seq'))` at the top of the transaction so concurrent creates are serialised.
2. Order by the numeric portion of the ID, not lexicographically:

```sql
SELECT client_id FROM clients
 WHERE client_id ~ '^FS[0-9]+$'
 ORDER BY CAST(SUBSTRING(client_id FROM 3) AS INTEGER) DESC
 LIMIT 1
```

---

## HIGH — bugs that produce wrong data

### H1. Negative `balance_amount` on overpayment

**Files:** `backend/src/routes/clients.js` (POST and PUT)

POST used `final - paid` (no clamp). PUT used `final-paid` (also no clamp). If the user enters `paid > final`, the client row stores a negative balance. The "Pending Dues" report only shows rows with `balance_amount > 0`, so it hides — but the client detail page renders `₹-500` next to "Balance".

**Fixed.** Both are now `Math.max(0, final - paid)`. The renew route was already doing this; payments.js POST already clamps via `GREATEST(0, ...)` in SQL. Now consistent everywhere.

### H2. Trainer with `trainer_id = NULL` can read/edit clients with `trainer_id = NULL`

**File:** `backend/src/routes/clients.js` (GET `/:id`, PUT `/:id`, POST `/:id/renew`)

The check `c.trainer_id !== req.user.trainer_id` evaluates to `null !== null` → `false`, so a trainer who hasn't been linked to a trainer profile would be allowed to access *unassigned* clients. Edge case but real (fresh trainer accounts often start unlinked).

**Fixed.** Added `(!req.user.trainer_id || …)` short-circuit in all three handlers — if a trainer has no `trainer_id`, they get 403 outright.

### H3. `auth-context` never refreshes user from the server

**File:** `frontend/src/lib/auth-context.tsx`

Original code: `setUser(prev => prev ?? (res.user as User))`. Because `prev` is already populated from `localStorage`, the response from `/api/auth/me` is *discarded*. So if an admin disables a trainer or changes their `trainer_id`, the trainer keeps their old role/scope until they log out and log back in.

**Fixed.** Always overwrite with `res.user` and re-persist to localStorage.

### H4. `api.ts` redirects on 401 from `/api/auth/me` during boot

**File:** `frontend/src/lib/api.ts`

The shared `req()` helper hard-redirects to `/login` on any 401 except `/api/auth/login`. But `auth-context.tsx` *expects* to call `/me` and handle the failure quietly. The 401 → location.replace race could throw the user back to /login mid-load with a flash of UI.

**Fixed.** Skip the auto-redirect on `/api/auth/me` too; the auth context handles it.

---

## MEDIUM — should fix when convenient

### M1. `clients/page.tsx` reads `.balance_amount` and `.status` as if non-optional

**File:** `frontend/src/app/clients/page.tsx`

`Client.balance_amount?: number` is optional in the type but the JSX did `c.balance_amount > 0` (true for `undefined > 0` is `false`, so technically OK), and `badge-${c.status}` would render `badge-undefined` if status was missing.

**Fixed.** Defensive `??` defaults applied.

### M2. Two server entry points + experimental modules

**Files:** `backend/src/server.v3.js`, `backend/src/modules/**`, `backend/src/middleware/{rbac,validate,errorHandler}.js`, `backend/src/workers/renewal.worker.js`, `frontend/src/app/(admin|member|trainer)/**`

Per your direction, these are kept but unused by the live deploy. The (member) and (trainer) route groups call `<Guard role="member">` / `<Guard role="trainer">`, and the schema's CHECK constraint allows only `'admin'` or `'trainer'` — so members literally cannot exist yet. They also use Tailwind classes, but the project has no `tailwind.config.js` and no `@tailwind` directives in `globals.css`, so the classes don't apply. None of this is loaded by the running app.

**NOT FIXED** — left alone per your instruction. When you're ready to promote v3, see "Future work" below.

### M3. `frontend/package.json` lists `tailwindcss: ^4.2.4` but Tailwind is not configured

The dependency is dead weight in the live build and only matters for the experimental v3 pages.

**NOT FIXED** — leaving install graph alone since the deploy is live.

### M4. Schema seed bcrypt hashes are wrong by design

**File:** `supabase-schema.sql` (lines 235–251)

The hashes pre-baked into the schema cannot validate against `'admin@619'` / `'trainer@619'` because bcrypt salts are non-deterministic per process. The deployment guide already tells you to run `node src/db/seed.js` after to fix them. Documented; not a bug.

### M5. `tsconfig.json` target is `es5`

Next.js 14 emits modern JS regardless, but ES5 target slows down build. Cosmetic.

**NOT FIXED.**

### M6. Body parser `urlencoded` is loaded but the API only handles JSON

Minor — no impact.

---

## LOW — observations, not defects

- **`payments.js` GET `/`** joins `c.name AS client_name` overwriting the snapshot stored in `payments.client_name`. This is actually fine: it shows the current client name even after a rename, and falls back to NULL only if the client row is hard-deleted (which it can be — admin route allows DELETE on clients with CASCADE on payments, so the payment row goes too). Behaves as expected.
- **`payments.js`** stores `incentive_amt` at write time using the *current* trainer rate — this is correct (snapshot semantics), so changing a trainer's incentive_rate later doesn't rewrite history.
- **`server.js`** uses Express 4 wildcard (`'/api/*'`). Fine for Express 4. If you ever upgrade to Express 5, change to a regex.
- **`pool.js`** uses `ssl: { rejectUnauthorized: false }`. Required for some Supabase URL forms; acceptable for a managed DB. If you want strict TLS, supply Supabase's CA bundle.

---

## Files changed in this audit

```
backend/src/routes/payments.js     ← C2 (RBAC on payment create)
backend/src/routes/attendance.js   ← C3 (RBAC on attendance mark)
backend/src/routes/clients.js      ← C4, H1, H2 (advisory lock, balance clamp, trainer scope)
backend/src/db/pool.js             ← clearer startup-error logging
backend/.env.example               ← NEW (template, no secrets)
frontend/.env.local.example        ← NEW (template)
frontend/src/lib/api.ts            ← H4 (skip redirect on /me)
frontend/src/lib/auth-context.tsx  ← H3 (always refresh user from server)
frontend/src/app/clients/page.tsx  ← M1 (null-safe rendering)
```

No files were deleted. No schema changes were made. The experimental v3 code is untouched.

---

## Future work (if/when you're ready)

1. **Promote v3 or delete it.** Right now it's a maintenance drag — broken Tailwind config, role 'member' that doesn't exist in the DB, two server entry points. Either (a) finish the v3 migration: add `members` to the role CHECK, write a Tailwind config, switch Render to `npm run start:v3`; or (b) delete `server.v3.js`, `src/modules/`, `src/middleware/{rbac,validate,errorHandler}.js`, `src/workers/`, and the `(admin|member|trainer)` route groups.

2. **Audit log.** Right now there's no record of who deleted a client / payment. Add a `audit_log` table that the DELETE handlers write to.

3. **Email/mobile uniqueness on `clients`.** The schema allows duplicates. If two members share a phone, you'll lose track.

4. **Backups.** Supabase free tier doesn't give point-in-time restore. If this is your business, take a `pg_dump` weekly.
