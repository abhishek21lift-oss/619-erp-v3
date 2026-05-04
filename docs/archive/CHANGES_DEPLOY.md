# How to roll these fixes out — already-live system

Read AUDIT_REPORT.md for what each change does and why.
This file is the step-by-step playbook. Total time: about 25 minutes.
There are NO database migrations — only code + secrets to rotate.

---

## Step 0 — Take a 60-second backup (optional but recommended)

In Supabase → SQL Editor → New Query, run:

```sql
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'trainers', COUNT(*) FROM trainers
UNION ALL SELECT 'clients',  COUNT(*) FROM clients
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance;
```

Copy the row counts somewhere — that's your "before" snapshot.

---

## Step 1 — Rotate secrets (CRITICAL — do this first, even before pushing code)

Your production DB password and JWT secret are sitting in `backend/.env` in your workspace. Treat them as compromised.

### 1a. Rotate the Supabase database password

1. Open Supabase → your project → **Settings → Database**.
2. Scroll to **Database password** → click **Reset database password**.
3. Copy the new password somewhere safe.

### 1b. Build the new connection string

Go to **Settings → Database → Connection string → URI**, copy it, then paste your new password where Supabase put `[YOUR-PASSWORD]`. Result looks like:

```
postgresql://postgres.adffjnztzrolibtuvhgc:NEW_PASSWORD_HERE@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

### 1c. Generate a fresh JWT secret

In a terminal:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

You'll get 96 hex characters. Copy it.

### 1d. Update Render env vars

1. Render → `619-erp-api` → **Environment** tab.
2. Update `DATABASE_URL` to the new URI from 1b.
3. Update `JWT_SECRET` to the value from 1c.
4. Click **Save Changes** — Render redeploys automatically (~2 min).

> Side effect: every existing JWT becomes invalid. Every signed-in user must log in again. That's the whole point.

### 1e. Update your local `.env`

Edit `backend/.env` to match the new values (so local dev doesn't break).

---

## Step 2 — Push the code fixes

The fixes are all in your workspace already. Confirm with:

```bash
cd D:\619-erp-v2-FINAL\619-erp-v2
git status
```

You should see modifications to:

- `backend/src/routes/payments.js`
- `backend/src/routes/attendance.js`
- `backend/src/routes/clients.js`
- `backend/src/db/pool.js`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth-context.tsx`
- `frontend/src/app/clients/page.tsx`

…and two new files:

- `backend/.env.example`
- `frontend/.env.local.example`

…and the docs:

- `AUDIT_REPORT.md`
- `CHANGES_DEPLOY.md`

### 2a. Commit and push backend

```bash
cd backend
git add .
git commit -m "fix: trainer RBAC on payments+attendance, balance clamp, advisory lock for client_id"
git push origin main
```

Render will auto-deploy in ~3 minutes. Watch the deploy log; once it says "Live", verify:

```bash
curl https://619-erp-api.onrender.com/api/health
```

Should return JSON with `"status":"ok"`.

### 2b. Commit and push frontend

```bash
cd ..\frontend
git add .
git commit -m "fix: refresh user from server on boot; null-safe client rendering; skip auto-redirect on /me"
git push origin main
```

Vercel will auto-deploy in ~2 minutes.

---

## Step 3 — Smoke test (5 minutes)

Open your live frontend URL. Do all of these in order:

### 3a. As admin (admin@619fitness.com)

1. **Log in.** Old token will be rejected (good — that's step 1d), then enter password and log in fresh. If "Invalid credentials", run `node src/db/seed.js` from backend with the NEW DATABASE_URL.
2. **Dashboard loads.** All KPIs show. No console errors.
3. **Clients page** — search for one client. Click into them. Hit Edit, change a phone number, save. Confirm change persists.
4. **Payments page** — record a payment of ₹100 against any client. Confirm the receipt appears in the list and the client's balance dropped by 100.
5. **Trainers page** — open one trainer's detail page. Confirm KPIs and recent payments load.
6. **Settings → Login Accounts** — confirm all users are listed.
7. **Settings → Change Password** — change your own password to something new. Log out, log back in with the new password.

### 3b. As trainer (e.g. abhishek@619fitness.com / trainer@619)

1. Log in.
2. **Clients page** shows only your own clients (not other trainers').
3. Try to record a payment. The client dropdown only shows your own clients — good.
4. Mark attendance for one of your clients. Should succeed.
5. **Open the browser dev tools → Network tab.** Try to POST a payment for a client_id that does not belong to you (paste it manually into the request body via "Edit and replay"). You should get a **403 Access denied: client is not assigned to you**. That's the new RBAC working.

If 3b#5 returns 200 (succeeds), the fix didn't deploy — check Render logs to confirm the new commit is live.

---

## Step 4 — Verify the row counts match

Run the same SQL from Step 0 again and compare. The only deltas should be the smoke-test payment from 3a#4 (and one attendance record from 3b#4). Anything else is a red flag — open Supabase → Logs to investigate.

---

## Rollback plan

Every change is just a code edit. To roll back:

```bash
git revert HEAD
git push origin main
```

Render and Vercel will redeploy the previous commit.

The only thing you cannot revert is the secret rotation in Step 1 — but you wouldn't want to. If you regret rotating, just rotate again.

---

## What I deliberately did NOT do

| Why I didn't | What |
|-|-|
| Already deployed live, would break things | No schema changes (no `ALTER TABLE`, no new tables, no constraint tightening). |
| You said keep server.js as the live one | No edits to `server.v3.js`, `src/modules/`, the v3 middleware, or the `(admin)/(member)/(trainer)` Next.js route groups. |
| Cosmetic only | No refactor of styles, no Tailwind config, no tsconfig modernisation. |
| Out of scope | No new features (no audit log, no email/SMS, no QR-code attendance, no Razorpay, no member portal). |

If you want any of those, ask in a follow-up and I'll plan them as a separate change set.
