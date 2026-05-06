# 619 Fitness ERP — Deployment Runbook

This is the full path to take the codebase from local to production across
**Vercel (frontend) + Render (backend) + Supabase (database)**. Follow it
top-to-bottom on a fresh setup, or jump to a section for re-deploys.

> **Repo layout assumption.** Two GitHub repos:
>
> - `619-erp-frontend` ← contents of `frontend/`
> - `619-erp-backend` ← contents of `backend/`
>
> The monorepo at `D:\619-erp-v2-FINAL\619-erp-v2` is the working tree;
> `scripts/EASY-PUSH-TO-GITHUB.ps1` mirrors changes into the two repos.

---

## 1. Database — Supabase

### 1.1 Apply migrations (in order)

In the Supabase dashboard → **SQL Editor → New query**, paste and run:

1. `db/migrations/supabase-schema.sql` — base tables, indexes, seed data.
2. `db/migrations/supabase-migration-v3.sql` — v3 schema additions.
3. `db/migrations/face-checkin.sql` — face-recognition columns.
4. **`db/migrations/2026-05-perf-and-soft-delete.sql`** — new in this pass:
   pg_trgm search, soft-delete columns, audit columns, expiring-soon index.

Don't run `supabase-schema-v3-recovery.sql` — that's a recovery script for a
specific pre-v3 corruption pattern. Skip it on greenfield.

### 1.2 Reset the default admin password

The seed bcrypt hash for `admin@619fitness.com` may not match on a fresh
Supabase instance (bcrypt salts differ per machine). After the schema
applies:

```bash
# From your laptop, with backend installed:
cd backend
node src/db/seed.js
```

That seed script regenerates the hash with the local bcryptjs. If you
prefer not to run Node locally, use the change-password endpoint after
logging in once with the default `admin@619`.

### 1.3 Grab the connection string

Supabase → **Project Settings → Database → Connection string → URI**.
Pick the **Transaction pooler (port 6543)** for the backend — it survives
Render's container restarts without leaking sockets.

```
postgres://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

---

## 2. Backend — Render

### 2.1 Push to GitHub

```bash
cd backend
git init                       # only first time
git add -A
git commit -m "feat: dashboard period filter, hardened error handling, ILIKE search"
git branch -M main
git remote add origin git@github.com:<your-user>/619-erp-backend.git
git push -u origin main
```

For follow-up pushes:

```bash
cd backend
git add -A
git commit -m "<your commit message>"
git push origin main
```

### 2.2 Create the Render service (one-time)

1. **New → Web Service** → connect `619-erp-backend`.
2. Environment: **Node**.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Instance type: **Starter** is fine for one gym, **Standard** for
   multi-gym (better cold-start + memory).
6. Auto-deploy: **on**, branch `main`.

### 2.3 Environment variables

Set in **Render → Environment**. The backend boots-and-fails fast if any
required key is missing.

| Key              | Required | Example                                                             |
|------------------|----------|---------------------------------------------------------------------|
| `DATABASE_URL`   | yes      | `postgres://postgres.…:…@aws-0-…pooler.supabase.com:6543/postgres`  |
| `JWT_SECRET`     | yes      | 64+ hex chars (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | no       | `7d` (default)                                                      |
| `FRONTEND_URL`   | yes      | `https://619-erp-frontend.vercel.app`                               |
| `NODE_ENV`       | yes      | `production`                                                        |
| `PORT`           | no       | Render injects this automatically — don't override                  |

Render will auto-deploy after you save. The first build takes ~2 min.

### 2.4 Smoke-test the API

```bash
curl https://619-erp-api.onrender.com/api/health
# => {"status":"ok","time":"…","env":{…}}
```

If you get `Forbidden by CORS`, your `FRONTEND_URL` doesn't match the
origin Vercel is serving on. Fix it in Render env, redeploy.

---

## 3. Frontend — Vercel

### 3.1 Push to GitHub

```bash
cd frontend
git init                       # only first time
git add -A
git commit -m "feat(ui): new design system, donut KPIs, dashboard rebuild, error boundary"
git branch -M main
git remote add origin git@github.com:<your-user>/619-erp-frontend.git
git push -u origin main
```

### 3.2 Create the Vercel project (one-time)

1. **Add New → Project** → import `619-erp-frontend`.
2. Framework preset: **Next.js** (auto-detected).
3. Root directory: leave blank (frontend repo's root *is* the Next app).
4. Build command: `npm run build`.
5. Output directory: `.next` (default).
6. Install command: `npm install`.

### 3.3 Environment variables

Vercel → **Settings → Environment Variables**. Apply to **Production +
Preview + Development** unless noted.

| Key                   | Required | Example                              |
|-----------------------|----------|--------------------------------------|
| `NEXT_PUBLIC_API_URL` | yes      | `https://619-erp-api.onrender.com`   |

Anything starting with `NEXT_PUBLIC_` is bundled into the client. Don't
store secrets there.

### 3.4 Trigger a deploy

```bash
cd frontend
git push origin main
```

Vercel auto-deploys. Watch the build log — first build will install
`recharts` (newly added in this pass) so it's a few seconds slower.

### 3.5 Hard-refresh once live

Tailwind / global CSS may be cached by the browser. Hit **Ctrl+Shift+R**
on the production URL after first deploy.

---

## 4. Local development

### 4.1 Backend

```bash
cd backend
cp .env.example .env           # paste DATABASE_URL + JWT_SECRET
npm install
npm run dev                    # http://localhost:5000
curl http://localhost:5000/api/health
```

### 4.2 Frontend

```bash
cd frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                    # http://localhost:3000
```

Both processes hot-reload. Login with `admin@619fitness.com` / `admin@619`
after the seed runs.

---

## 5. Production checklist before going live

- [ ] `JWT_SECRET` is **at least 48 random hex chars** in Render env.
- [ ] `NODE_ENV=production` on Render — hides 5xx error messages.
- [ ] `FRONTEND_URL` exactly matches the Vercel production origin
      (including `https://`, no trailing slash).
- [ ] Default admin password changed away from `admin@619`.
- [ ] Supabase project paused-on-no-activity is **disabled** (free tier
      pauses after 7 days idle, which kills the API).
- [ ] Daily `pg_dump` or Supabase Point-in-Time recovery is **enabled**.
- [ ] `2026-05-perf-and-soft-delete.sql` migration applied — without it,
      ILIKE search on `clients` does a full sequential scan.
- [ ] Vercel **Analytics** + Render **Logs** retention bumped if you'll
      need >7-day forensics.

---

## 6. Rolling back

```bash
# Backend (Render)
git revert <commit-sha>
git push origin main           # Render redeploys automatically

# Frontend (Vercel)
# Open Vercel → Deployments → click the previous green deploy → Promote to Production
```

Database — only forward migrations are checked in. If a migration breaks,
restore via Supabase **Database → Backups → Restore**.

---

## 7. Post-deploy smoke test (3 minutes, every release)

Hit these in order. If any step fails, **roll back** before debugging — a
broken production is worse than a stale one.

### 7.1 Backend health (1 min)

```bash
# Liveness — must return 200 with non-null env values.
curl -s https://619-erp-api.onrender.com/api/health | jq

# Login — should return a JWT.
curl -s -X POST https://619-erp-api.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@619fitness.com","password":"<your-pw>"}' | jq .token | head -c 40
echo

# Authenticated read — should return a JSON array (may be empty).
TOKEN=<paste-token-from-above>
curl -s -H "Authorization: Bearer $TOKEN" \
  'https://619-erp-api.onrender.com/api/clients?limit=1' | jq 'length'

# Dashboard summary — should return JSON with `clients`, `revenue`, etc.
curl -s -H "Authorization: Bearer $TOKEN" \
  'https://619-erp-api.onrender.com/api/dashboard/summary?period=7d' | jq 'keys'
```

Expected keys on `/dashboard/summary`:
`["active_pt_clients","anniversaries_today","attendance_today","birthdays_today","clients","expiring_soon","monthly_chart","pending_renewals","period","recent_payments","revenue","top_trainers","total_dues"]`.

### 7.2 Frontend (2 min)

Open the production URL in a fresh incognito window:

- [ ] `/login` — logo renders, light theme, submitting valid creds redirects to `/dashboard`.
- [ ] `/dashboard` — KPIs render values, **three donut charts** render (membership / revenue / renewals), period tabs change the highlighted button **and** trigger a network request to `?period=…`.
- [ ] Click **Refresh** → button shows spinner, finishes within 2s.
- [ ] Resize to mobile (375px wide) — KPIs stack 2-up, charts stack vertically, sidebar collapses to drawer.
- [ ] DevTools → Console: **zero red errors** on the dashboard.
- [ ] DevTools → Network: navigate to `/dashboard` again within 30s; the second mount should hit the cache (no `/api/dashboard/summary` request) — confirms the new HTTP cache works.
- [ ] Force an error: open `/clients/0000-not-a-real-id` → ErrorBoundary fallback shows, **does not whitescreen**.

If everything is green, you're done.

---

## 8. Rolling back

### 8.1 Frontend (Vercel) — fastest path

1. **Vercel → your project → Deployments.**
2. Find the previous green deploy.
3. Click **⋯ → Promote to Production**.
4. The promotion is atomic; users hitting the URL during the swap see one or the other, never a half-deploy.

### 8.2 Backend (Render)

```bash
# Identify the last good commit on main:
git log --oneline -10

# Revert the bad commit. This creates a new commit that undoes the change,
# which is safer than a force-push because Render's git history stays linear.
git revert <bad-commit-sha>
git push origin main
```

Render auto-deploys the revert. If the bad commit included an env-var
change, also revert that in **Render → Environment**.

### 8.3 Database (Supabase)

Migrations in this repo are **forward-only**. If a migration broke
something, the recovery path is:

1. **Supabase → Database → Backups → Restore.** Pick the most recent
   backup before the migration ran.
2. Or, if you only need to undo the last migration's structural change,
   write a hand-rolled `down.sql` and run it. Common reversals:

   ```sql
   -- Undo column add
   ALTER TABLE clients DROP COLUMN deleted_at;

   -- Undo index add
   DROP INDEX IF EXISTS idx_clients_name_trgm;
   ```

The `2026-05-perf-and-soft-delete.sql` migration is **non-destructive** —
adding indexes and nullable columns is always safe to roll forward and to
roll back individually.

---

## 9. Monitoring & alerting

Even on a small install, set these up before you go to bed the night of a
deploy:

| What                | Where                                                                                  | Threshold                                              |
|---------------------|----------------------------------------------------------------------------------------|--------------------------------------------------------|
| API uptime          | Render → **Health checks** → `/api/health`                                             | 200 OK every 60s; alert on 3 consecutive failures.     |
| API error rate      | Render → **Logs** filter `[5`                                                          | Alert if > 0.5 % of requests in 5 min are 5xx.         |
| DB connections      | Supabase → **Reports → Database**                                                      | Alert at 80 % of plan limit.                           |
| Frontend errors     | Vercel → **Speed Insights / Web Analytics** (or wire Sentry)                           | Alert on > 1 % JS error rate.                          |
| Auth abuse          | Render logs grep `POST /api/auth/login`                                                | Alert on > 30 logins/15min from same IP.               |

Free options that take 10 minutes each: **Better Stack** (Render uptime),
**Sentry** (frontend exceptions), **Logtail** (centralized log search).

---

## 10. Troubleshooting cheatsheet

| Symptom                                   | Likely cause                                                          | Fix                                      |
|-------------------------------------------|-----------------------------------------------------------------------|------------------------------------------|
| Login returns 500                          | `JWT_SECRET` shorter than 16 chars                                    | Regenerate, redeploy backend             |
| All pages bounce to /login on refresh      | `NEXT_PUBLIC_API_URL` wrong, or backend down                          | Curl `/api/health`                       |
| CORS error in console                      | `FRONTEND_URL` env var doesn't match origin                           | Update on Render, redeploy               |
| Dashboard slow on big datasets             | New indexes not applied                                               | Run `2026-05-perf-and-soft-delete.sql`   |
| Charts crash with "recharts not found"     | `npm install` skipped on Vercel (cached)                              | Clear build cache → redeploy             |
| Cold-start 30 s delay on first request     | Render free tier sleeps; bump to Starter or use external pinger       | Upgrade plan                             |
| Toast notifications don't appear            | `<ToastProvider>` removed from `app/layout.tsx`                       | Check the layout still wraps children    |
| ErrorBoundary catches everything           | A page throws on every render (e.g. accessing `null.foo`)             | Check the boundary's logged error first  |
| Search is case-sensitive                   | Old route still uses `LIKE LOWER(...)`; pull latest backend           | Confirm backend deploy succeeded         |
| `Period` tab does nothing                  | Frontend deployed before backend `?period=` change                    | Push backend, redeploy                   |
