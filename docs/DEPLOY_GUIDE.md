# 619 Fitness ERP — Deployment Guide for the v3.1 Audit Fixes

You have **two GitHub repos** and **one Supabase project** to update:

| Component | Repo / target |
| --- | --- |
| Backend (Express + Postgres API on Render) | `https://github.com/abhishek21lift-oss/619-erp-v3.git` (root of this folder, branch `main`) |
| Frontend (Next.js on Vercel) | `https://github.com/abhishek21lift-oss/619-erp-frontend.git` (the `frontend/` subfolder, branch `main`) |
| Supabase Postgres database | Run one combined SQL file in the SQL Editor |

Run the **Supabase migration first**, then push backend, then push frontend. Skip ahead to the section relevant to you.

---

## 1. Supabase — run the combined migration

A single combined file has been generated for you:

```
db/migrations/COMBINED-supabase-schema.sql   (~95 KB, idempotent)
```

It bundles all 7 migrations in the correct order (v2 base → v3 additive ×3 → face check-in → perf + soft-delete → **RLS + receipt sequence**). Every statement is `IF NOT EXISTS` / `IF EXISTS` / `DO` block, so it is safe to re-run on an already-populated database.

### Steps

1. Open Supabase → your project → **SQL Editor** → **New query**.
2. (If you have any production data) take a manual backup first: **Database → Backups → Manual backup**.
3. Open `db/migrations/COMBINED-supabase-schema.sql` in your editor, copy the entire file, paste into the Supabase SQL editor, click **Run**.
4. Verify the bottom row of the output reads `619 v3.1 RLS + hardening applied`.
5. Sanity-check RLS is on:

   ```sql
   SELECT tablename, rowsecurity, forcerowsecurity
   FROM pg_tables JOIN pg_class c ON c.relname = tablename
   WHERE schemaname = 'public' ORDER BY tablename;
   ```

   Every business table should show `rowsecurity = t` and `forcerowsecurity = t`.
6. Re-seed the demo passwords from the backend (so the bcrypt hashes match the runtime version):

   ```bash
   cd backend
   node src/db/seed.js
   ```

> **Important:** the Express backend connects as the `postgres` role through the connection string in your Render env (`DATABASE_URL`). That role bypasses RLS on Supabase, so all existing endpoints continue to work. The anon / authenticated roles (used by direct PostgREST calls from a browser) now get nothing — exactly what we want.

---

## 2. Backend repo — push to GitHub (Render auto-deploys)

The audit changed these backend files:

```
backend/src/db/pool.js                       (configurable pool size)
backend/src/db/receipts.js                   (NEW — sequence-backed receipts)
backend/src/middleware/auth.js               (cache + soft-delete check)
backend/src/routes/auth.js                   (cache invalidation hooks)
backend/src/routes/attendance.js             (next(err) instead of leaking err.message)
backend/src/routes/checkin.js                (early-exit on confident match + safe errors)
backend/src/routes/client-actions.js         (RBAC guard on all 11 actions, transfer admin-only)
backend/src/routes/clients.js                (sequence-backed receipts + safe errors)
backend/src/routes/dashboard.js              (DOY-indexed birthday/anniversary)
backend/src/routes/payments.js               (sequence-backed receipts + idempotent delete)
backend/src/routes/plans.js                  (NaN bug fix in PUT)
backend/src/routes/reports.js                (next(err) instead of err.message)
backend/src/routes/trainers.js               (scrub bypass for self + manager)
backend/src/server.js                        (login limiter scoped properly)
backend/src/server.v3.js                     (no-wildcard CORS)

db/migrations/2026-05-rls-and-hardening.sql  (NEW)
db/migrations/COMBINED-supabase-schema.sql   (NEW — for Supabase Editor)

docs/AUDIT_REPORT.md                         (NEW)
docs/DEPLOY_GUIDE.md                         (this file)
```

### Commands (run from the project root, `D:\619-erp-v2-FINAL\619-erp-v2`)

```bash
# 1. Confirm you're on main and pull anything teammates pushed
git checkout main
git pull --rebase origin main

# 2. See what changed
git status
git diff --stat

# 3. Stage every fix
git add backend/src \
        db/migrations/2026-05-rls-and-hardening.sql \
        db/migrations/COMBINED-supabase-schema.sql \
        docs/AUDIT_REPORT.md \
        docs/DEPLOY_GUIDE.md

# 4. Commit with a clear message
git commit -m "Audit v3.1: RLS, RBAC on client-actions, receipt sequence, leak-safe errors

- Critical: enable RLS on every public-schema table (deny anon/authenticated)
- Critical: trainers can no longer mutate clients not assigned to them
- High: replace Math.random/Date.now receipt numbers with sequence-backed gen
- High: plans.js PUT NaN bug, dashboard DOY index hit, scrub bypass for self
- High: stop leaking err.message; route everything through global handler
- Medium: auth user-cache, configurable pool size, ErrorBoundary outermost
- New helper: backend/src/db/receipts.js (sequence-backed unique receipt nos)
- New migration: db/migrations/2026-05-rls-and-hardening.sql
- Combined one-shot Supabase migration: db/migrations/COMBINED-supabase-schema.sql"

# 5. Push — Render watches main and will redeploy automatically
git push origin main
```

### Verify Render redeployed cleanly

1. Render dashboard → your backend service → **Events**: a new deploy should be in progress within ~30 s.
2. After it goes green, hit `https://<your-render-url>/api/health` — it should respond with `{ status: "ok", … }`.
3. Tail the logs once: should see `619 ERP API listening on port …` and `Connected to Supabase PostgreSQL`.

---

## 3. Frontend repo — push to GitHub (Vercel auto-deploys)

The audit changed these frontend files (inside `frontend/`):

```
src/app/login/page.tsx        (removed plaintext-password biometric replay)
src/app/layout.tsx            (ErrorBoundary outermost)
src/lib/http.ts               (bounded-LRU cache)
src/lib/api.ts                (typed DashSummary)
```

`tsconfig.audit.json` is a temporary file from the typecheck run — feel free to delete it, or just don't stage it.

### Commands (run from `D:\619-erp-v2-FINAL\619-erp-v2\frontend`)

```bash
cd frontend

# 1. Sync with main
git checkout main
git pull --rebase origin main

# 2. See changes (you'll likely see CRLF normalization noise on a few files
#    that you can ignore by checking the actual diff)
git status

# 3. Stage ONLY the audit-related files (skip the temp tsconfig)
git add src/app/login/page.tsx \
        src/app/layout.tsx \
        src/lib/http.ts \
        src/lib/api.ts

# Optional cleanup of the temp file
rm -f tsconfig.audit.json

# 4. Commit
git commit -m "Audit v3.1: secure biometric flow, ErrorBoundary outermost, LRU cache

- SECURITY: stop storing the user's password (base64) in localStorage.
  Biometric login now only unlocks an already-issued JWT session and
  sweeps any legacy 619_bio_pass key on first paint.
- Reorder providers so ErrorBoundary catches AuthProvider throws.
- http.ts cache is now a bounded LRU (max 200 entries) so it can't grow
  unbounded over long sessions.
- DashSummary typed instead of any."

# 5. Push — Vercel watches main and will redeploy automatically
git push origin main
```

### Verify Vercel redeployed cleanly

1. Vercel dashboard → your project → latest deployment should be **Ready** in ~1–2 min.
2. Open the deployed URL → log in with your normal credentials.
3. After login, open DevTools → Application → Local Storage and confirm there is **no `619_bio_pass` key**. (If you had biometric enabled before, the new code wipes it on first paint of the login page.)

---

## 4. Post-deploy smoke tests (5 minutes)

Walk through these in order. Any failure should be reported with the response payload.

| # | Action | Expected |
| - | --- | --- |
| 1 | `GET https://<api>/api/health` | 200, `status: ok` |
| 2 | Log in as `admin@619fitness.com / admin@619` | Lands on dashboard, KPIs render |
| 3 | Log in as a trainer | Sees only own clients in `/clients`; `/trainers` shows own salary, others scrubbed |
| 4 | As trainer, try `POST /api/clients/<other-trainer-client-id>/freeze` | 403 `Access denied: client is not assigned to you` |
| 5 | As trainer, try `POST /api/clients/<id>/transfer` | 403 `Only admin/manager/reception can transfer clients` |
| 6 | As admin, record a payment | 201, receipt number formatted `RCP-YYYYMMDD-NNNNNN` |
| 7 | Run `curl https://<your-supabase>.supabase.co/rest/v1/clients?select=*` with the **anon** key | Empty array (RLS denies) |
| 8 | In Supabase SQL Editor: `SELECT count(*) FROM members;` | Returns the real count (because the SQL editor runs as a superuser, bypassing RLS — this is correct) |

---

## 5. Rollback plan (if something goes wrong)

```bash
# Backend (root repo)
git revert HEAD --no-edit && git push origin main
# Render will auto-redeploy the previous version.

# Frontend
cd frontend
git revert HEAD --no-edit && git push origin main
# Vercel will auto-redeploy.

# Supabase (RLS rollback only — leave schema in place)
# Run in SQL editor:
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
```

> RLS rollback should only be used if a misconfigured backend can't authenticate as `postgres`. The right long-term fix is to ensure Render's `DATABASE_URL` uses the `postgres` user, not the anon JWT.

---

## 6. What I deliberately did NOT change (recommended follow-ups)

- pgvector for face descriptors (audit report → H10).
- JWT in httpOnly cookies + CSRF token (mitigates XSS token theft).
- Refresh-token rotation flow (the `refresh_tokens` table is already in the schema, just unused).
- Real Content-Security-Policy header (currently `helmet({ contentSecurityPolicy: false })`).
- Multi-tenant `branch_id` rollout (columns are present but nullable, queries don't scope).

These are tracked in `docs/AUDIT_REPORT.md` so you can pick them up in a later sprint.
