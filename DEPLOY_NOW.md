# 619 ERP — Re-Deployment Guide (After Bug Fixes & UI Refresh)

This walks you through redeploying the **fixed** backend and the **redesigned** frontend. Allow ~25 minutes total.

---

## Before you start — 1 minute

You will need:

1. The Supabase project you already created (login: https://supabase.com).
2. The Render account you already created (login: https://render.com).
3. The Vercel account you already created (login: https://vercel.com).
4. Your local terminal open at `D:\619-erp-v2-FINAL\619-erp-v2`.

---

## STEP 1 — Rotate your secrets (CRITICAL, 5 min)

Your previous `.env` file had your **production database password and JWT secret in plaintext**. Rotate both before redeploying.

### 1.1 Reset the Supabase database password
1. Open Supabase → your project → **Settings** → **Database**.
2. Click **Reset database password** → save the new password somewhere safe.
3. Scroll down to **Connection string → URI** and copy the new connection string.
   It will look like:
   ```
   postgresql://postgres.xxxxxxxxxxxx:NEW_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
   ```

### 1.2 Generate a fresh JWT secret
On your local machine:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copy the 96-character hex string. This is your new `JWT_SECRET`.

### 1.3 Update your local `.env` (so `node src/db/seed.js` works)
Open `D:\619-erp-v2-FINAL\619-erp-v2\backend\.env` and replace the values:
```
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:NEW_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
JWT_SECRET=YOUR_NEW_96_CHAR_HEX_HERE
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://619-erp-frontend.vercel.app
```

> Important: this file is in `.gitignore`, but make sure you've **never committed it**. Run:
> ```bash
> cd backend
> git log --all -- .env
> ```
> If anything prints, the secret was published — that's why we just rotated it.

---

## STEP 2 — Reset the demo passwords in Supabase (2 min)

The schema seed bcrypt hashes don't always match. Run the seed script once against your fresh database:

```bash
cd D:\619-erp-v2-FINAL\619-erp-v2\backend
npm install
node src/db/seed.js
```

You should see:
```
✅ Connected to Supabase PostgreSQL
🔐 Setting up demo account passwords...
✅ admin@619fitness.com  /  admin@619
✅ riya@619fitness.com  /  trainer@619
✅ abhishek@619fitness.com  /  trainer@619
✅ rajat@619fitness.com  /  trainer@619
✅ Seed complete!
```

If you see "DATABASE_URL is not set" — your `.env` isn't being read. Make sure you're inside the `backend` folder.

---

## STEP 3 — Push the fixed backend to GitHub (3 min)

If your backend repo already exists on GitHub, just push the new code:

```bash
cd D:\619-erp-v2-FINAL\619-erp-v2\backend
git add .
git commit -m "Fix: rate limiter order, CORS, transactions, parseFloat NaN, force trainer_id on PUT, scrub trainer fields, change-password compat"
git push origin main
```

If the repo doesn't exist yet:

```bash
cd D:\619-erp-v2-FINAL\619-erp-v2\backend
git init
git add .
git commit -m "619 ERP backend v2 (fixed)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/619-erp-backend.git
git push -u origin main
```

---

## STEP 4 — Update Render env vars and redeploy (5 min)

1. Open https://dashboard.render.com → your service `619-erp-api`.
2. Click **Environment** in the left tab.
3. **Update these three variables:**
   - `DATABASE_URL` → paste the **new** connection string from Step 1.1
   - `JWT_SECRET` → paste the **new** 96-char hex from Step 1.2
   - `FRONTEND_URL` → set to your exact Vercel URL (no trailing slash), e.g. `https://619-erp-frontend.vercel.app`
4. Click **Save Changes**. Render auto-redeploys (1–2 min).
5. Watch the **Logs** tab. When you see:
   ```
   API running on http://localhost:5000
   ✅ Connected to Supabase PostgreSQL
   ```
   the backend is live.
6. Verify in your browser:
   ```
   https://619-erp-api.onrender.com/api/health
   ```
   You should see: `{"status":"ok","time":"..."}`

> Existing logins are now invalid (the JWT secret changed). All users — including you — will need to log in again. That's expected.

---

## STEP 5 — Redeploy the frontend on Vercel (5 min)

### 5.1 Push the frontend changes
```bash
cd D:\619-erp-v2-FINAL\619-erp-v2\frontend
git add .
git commit -m "UI: glass aesthetic redesign; fix change-password and create-user endpoints; fix subscription duration calc; add admin guard to /trainers"
git push origin main
```

### 5.2 Confirm the env var on Vercel
1. Open https://vercel.com → your project `619-erp-frontend` → **Settings** → **Environment Variables**.
2. Make sure `NEXT_PUBLIC_API_URL` exists and equals **exactly** your Render URL:
   ```
   NEXT_PUBLIC_API_URL = https://619-erp-api.onrender.com
   ```
   No trailing slash. Apply to **Production, Preview, and Development**.
3. If you changed it, go to **Deployments** → on the latest deployment, click `...` → **Redeploy** → check "Use existing Build Cache" off → **Redeploy**.

### 5.3 If you didn't change the env var
The git push from 5.1 alone triggers a new deployment. Wait for the "Ready" badge in Vercel.

---

## STEP 6 — Smoke test the live app (3 min)

Open your Vercel URL in a fresh **Incognito** window (so no stale token).

### Login screen
- Use `admin@619fitness.com` / `admin@619`
- Should look glassy, with the new mesh-gradient background.

### Inside the app
- **Dashboard** loads with KPIs, revenue chart, recent payments. Glass cards with hover lift.
- **Clients → Add Client** — pick "Half Yearly", change start date → **end date now updates correctly**. (This was the bug.)
- **Settings → Change Password** — enter current `admin@619`, set a new one, save → should succeed and you can log out and back in with the new password. (This was the other bug.)
- **Settings → Create Login Account** — create a test trainer. Should now succeed (was 404 before).
- **Trainers** page — admin can see, edit, delete trainers in glass cards. Try logging in as a trainer (`riya@619fitness.com` / `trainer@619`) — they should NOT see `/trainers` in the sidebar nav, and visiting `/trainers` directly redirects them to dashboard.

If any of these fail, check:
- The browser **Network** tab for the failing request and its status code.
- Render **Logs** for backend errors.
- That `NEXT_PUBLIC_API_URL` matches your Render URL exactly.

---

## STEP 7 — Tell users to update their passwords (1 min)

Since the JWT secret rotated, every user has to log in fresh. Once in, every account should change its password from the Settings page (the demo passwords are now public knowledge in the schema/docs).

---

## What was fixed in this build

**Critical bugs**
- Login rate limiter is now mounted *before* the auth router, so brute-force protection actually runs (was being skipped completely).
- CORS no longer accepts `origin: true` — it whitelists `FRONTEND_URL` and localhost only.
- The `/api/auth/change-password` route now accepts the field names the frontend sends (it also accepts the legacy ones, so older clients keep working). Password change works.
- The `/api/auth/create-user` route is now correctly hit by the frontend (the frontend was POSTing to the wrong path). Settings → Create Login Account works.
- SQL string-interpolation in `reports.js /dues` and `attendance.js /today-summary` replaced with parameterized queries.
- `parseFloat('') ?? fallback` (which evaluates to NaN, not the fallback) replaced with a `Number.isFinite` guard so blank inputs no longer write NaN into the database.
- `incentive_rate ?? 0.5` instead of `|| 0.5` so a legitimate `0` rate isn't silently overridden to 50%.
- `PUT /api/clients/:id` now forces `trainer_id` for trainer-role users — they can no longer reassign a client to a different trainer.
- `GET /api/trainers` now scrubs salary, incentive_rate, address, mobile, etc. for non-admin viewers.
- `/trainers` page is wrapped in `<Guard role="admin">` — non-admins are redirected.
- Auto-expire of stale memberships now runs at most once per hour, off the hot read path.
- Client creation, payment creation, and payment deletion are wrapped in transactions so partial failures can't desync `paid_amount` / `balance_amount`.

**Subscription duration**
- The end date now recomputes from the **new** start date whenever the user picks a different start date. (The previous code read the *old* start date from a stale closure.)
- The end date initialises immediately when you open "Add Client" instead of staying blank until you click something.
- Same fix applied in the Edit-Client view.

**UI**
- New glass design system in `globals.css`: backdrop-blur cards, layered shadows, mesh-gradient background, refined typography, hover micro-interactions.
- Trainers page rebuilt with glass cards (avatars, KPIs per trainer, edit/delete actions, modal form).
- All other pages pick up the new look automatically because they share the same class names.

---

## Local Development (optional)

Backend:
```bash
cd backend
npm install
npm run dev     # nodemon on http://localhost:5000
```

Frontend:
```bash
cd frontend
npm install
# Set frontend/.env.local to:
#   NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev     # http://localhost:3000
```

---

## Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Login returns "Invalid credentials" | Bcrypt hashes never set | Run `node src/db/seed.js` from `backend/` with `DATABASE_URL` in `.env` |
| Browser console: "CORS blocked" | `FRONTEND_URL` on Render doesn't match exact Vercel URL | Update env var on Render → Save (auto-redeploys) |
| All API calls return 401 | JWT secret changed; tokens expired | Log out and back in |
| First request takes 30–60s | Render free tier sleeps after 15 min | Upgrade to Render Starter ($7/mo) for always-on |
| "Not found: POST /api/auth/users" | Stale frontend deployment from before this fix | Push frontend again, redeploy on Vercel |
| Subscription end date doesn't update | Stale frontend cached in browser | Hard refresh (Ctrl+Shift+R) |
