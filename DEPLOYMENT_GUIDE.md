# 619 Fitness ERP — Complete Deployment Guide v2

## Architecture

```
Browser → Vercel (Next.js) → Render (Express API) → Supabase (PostgreSQL)
```

---

## STEP 1 — Supabase Database (10 minutes)

### 1.1 Create project
1. Visit https://supabase.com → Sign up free
2. Click **"New project"**
3. Name: `619-erp`, choose region closest to you
4. Set a strong **database password** — SAVE IT
5. Wait ~2 minutes for provisioning

### 1.2 Run the schema
1. In Supabase dashboard → **SQL Editor** (left sidebar)
2. Click **New query**
3. Open `supabase-schema.sql` from this folder
4. Copy the ENTIRE contents → Paste → Click **Run**
5. You should see: *"Success. No rows returned"*

### 1.3 Fix passwords with the seed script
The SQL creates demo users, but their bcrypt hashes need to be generated fresh.

**Option A — Run seed script locally:**
```bash
cd backend
npm install
# Edit .env with your DATABASE_URL first
node src/db/seed.js
```

**Option B — Use Supabase SQL Editor** to set passwords:
```sql
-- This sets admin@619 as the admin password
-- Generate a proper hash with: node -e "console.log(require('bcryptjs').hashSync('admin@619',10))"
-- Then replace the hash below with your generated one
UPDATE users SET password = 'YOUR_BCRYPT_HASH_HERE' WHERE email = 'admin@619fitness.com';
```

### 1.4 Get your connection string
1. Supabase → **Settings** → **Database**
2. Scroll to **"Connection string"** section
3. Choose **"URI"** tab
4. Copy the string:
   ```
   postgresql://postgres.XXXX:[YOUR-PASSWORD]@aws-0-XX.pooler.supabase.com:6543/postgres
   ```
5. **Save this** — you need it for Step 2

---

## STEP 2 — Backend on Render (15 minutes)

### 2.1 Push backend to GitHub

```bash
# From the 619-erp-v2 folder:
cd backend
git init
git add .
git commit -m "619 ERP backend v2"

# Create a repo at github.com called "619-erp-backend", then:
git remote add origin https://github.com/YOUR_USERNAME/619-erp-backend.git
git branch -M main
git push -u origin main
```

### 2.2 Create Render Web Service
1. Visit https://render.com → Sign up free
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub → Select `619-erp-backend`

### 2.3 Configure the service

| Setting | Value |
|---------|-------|
| **Name** | `619-erp-api` |
| **Region** | Singapore (or closest to you) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node src/server.js` |
| **Plan** | Free (or Starter for always-on) |

### 2.4 Add Environment Variables

Click **"Environment"** tab and add ALL of these:

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | Your Supabase URI from Step 1.4 | Must include password |
| `JWT_SECRET` | (generate below) | Minimum 32 characters |
| `JWT_EXPIRES_IN` | `7d` | |
| `NODE_ENV` | `production` | |
| `FRONTEND_URL` | `https://619-erp.vercel.app` | Fill in after Step 3 |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copy the output (96 hex chars) and use it as JWT_SECRET.

### 2.5 Deploy & verify
1. Click **"Create Web Service"** → wait 3-4 minutes
2. Test the health endpoint:
   ```
   https://619-erp-api.onrender.com/api/health
   ```
   You should see: `{"status":"ok","app":"619 Fitness ERP",...}`

3. Test login:
   ```bash
   curl -X POST https://619-erp-api.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@619fitness.com","password":"admin@619"}'
   ```
   You should get back a JWT token.

**If login fails:** Run the seed script to reset passwords:
```bash
cd backend
DATABASE_URL="your-supabase-url" node src/db/seed.js
```

---

## STEP 3 — Frontend on Vercel (10 minutes)

### 3.1 Push frontend to GitHub

```bash
cd frontend
git init
git add .
git commit -m "619 ERP frontend v2"

# Create a repo called "619-erp-frontend", then:
git remote add origin https://github.com/YOUR_USERNAME/619-erp-frontend.git
git branch -M main
git push -u origin main
```

### 3.2 Deploy on Vercel
1. Visit https://vercel.com → Sign up free
2. Click **"Add New Project"**
3. Import `619-erp-frontend` from GitHub
4. Vercel auto-detects Next.js — leave all framework settings as-is

### 3.3 Add Environment Variable
Before clicking Deploy:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://619-erp-api.onrender.com` |

### 3.4 Deploy
Click **"Deploy"** — takes ~2 minutes.

Your live URL will be something like:
```
https://619-erp-frontend.vercel.app
```

---

## STEP 4 — Connect CORS (2 minutes)

Go back to Render → `619-erp-api` → **Environment**:
1. Update `FRONTEND_URL` to your actual Vercel URL
2. Click **"Save Changes"**
3. Render auto-redeploys (1 min)

---

## STEP 5 — Test the Live App

Open your Vercel URL and verify these work:

### Login
| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@619fitness.com | admin@619 |
| **Trainer** | riya@619fitness.com | trainer@619 |
| **Trainer** | abhishek@619fitness.com | trainer@619 |

### Admin can:
- See ALL clients across all trainers
- Manage trainers
- View global revenue reports
- Create/disable login accounts
- Delete clients and payments

### Trainer can:
- See ONLY their own clients
- Record payments for their clients
- Mark attendance
- View their own reports

**⚠️ Change all default passwords immediately after first login!**

---

## Local Development Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env:
#   DATABASE_URL = your Supabase URI
#   JWT_SECRET   = any long string for dev
npm run dev
# API: http://localhost:5000
# Health: http://localhost:5000/api/health
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev
# App: http://localhost:3000
```

---

## Folder Structure

```
619-erp-v2/
├── supabase-schema.sql          ← Run in Supabase SQL Editor
├── DEPLOYMENT_GUIDE.md          ← This file
│
├── backend/                     ← Node.js Express API (→ Render)
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js            ← Entry point, all middleware
│       ├── db/
│       │   ├── pool.js          ← PostgreSQL connection (pg library)
│       │   └── seed.js          ← Reset demo passwords
│       ├── middleware/
│       │   └── auth.js          ← JWT verification middleware
│       └── routes/
│           ├── auth.js          ← Login, create users, manage accounts
│           ├── clients.js       ← Client CRUD (trainer-scoped)
│           ├── trainers.js      ← Trainer CRUD (admin only)
│           ├── payments.js      ← Payment recording
│           ├── dashboard.js     ← Aggregated KPI stats
│           ├── attendance.js    ← Daily attendance marking
│           └── reports.js       ← Monthly reports, dues, trainer summary
│
└── frontend/                    ← Next.js App Router (→ Vercel)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── .env.local.example
    └── src/
        ├── lib/
        │   ├── api.ts           ← All API calls + TypeScript types
        │   └── auth-context.tsx ← JWT + user state (React context)
        ├── components/
        │   ├── Sidebar.tsx      ← Navigation (role-aware)
        │   └── Guard.tsx        ← Auth protection wrapper
        └── app/
            ├── layout.tsx       ← Root layout + AuthProvider
            ├── globals.css      ← Complete dark theme CSS
            ├── page.tsx         ← Root redirect
            ├── login/           ← Login page
            ├── dashboard/       ← KPI dashboard (stunning)
            ├── clients/         ← List + new + detail/edit
            ├── trainers/        ← Admin trainer management
            ├── payments/        ← Payment recording + history
            ├── attendance/      ← Daily attendance marking
            ├── reports/         ← Revenue charts + dues
            └── settings/        ← Account management + passwords
```

---

## Environment Variables Reference

### Backend (.env)
```
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
JWT_SECRET=<64+ random hex chars>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

---

## Troubleshooting

### "Invalid credentials" on login
→ Passwords weren't seeded. Run: `node src/db/seed.js` from the backend folder with DATABASE_URL set

### CORS error in browser console
→ Set `FRONTEND_URL` in Render env vars to your **exact** Vercel URL (no trailing slash)

### Render app "sleeps" after 15 minutes (free tier)
→ First request after sleep takes 30–60s. Upgrade to Render Starter ($7/mo) for always-on

### "SSL connection required" error
→ The pool.js already handles this with `ssl: { rejectUnauthorized: false }`. Make sure you deployed the latest code.

### Build fails on Vercel
→ Check that `NEXT_PUBLIC_API_URL` is set before deploying (not after)

### "relation does not exist" database errors
→ Re-run `supabase-schema.sql` in the SQL Editor

---

## Adding New Trainers (Post-Deployment)

1. Go to **Trainers** page → Add trainer profile (name, rate, etc.)
2. Go to **Settings** → Create Login Account
   - Enter their name + email + password
   - Role: Trainer
   - Link to the trainer profile you just created
3. Give them their login credentials
4. They can now log in and see only their clients

---

## Security Notes

- Passwords are hashed with bcrypt (cost factor 10) — never stored plain
- JWTs expire after 7 days — users must log in again
- All API routes verify the JWT on every request
- Trainer role is DB-enforced: even if someone modifies the frontend, the API will reject cross-trainer data access
- Rate limiting: 30 login attempts per 15 min per IP
