# 619 Fitness — Aurora Operating System

A modern gym/fitness management ERP. Members, trainers, classes, payments,
attendance and reporting in one place. Built as a Next.js 16 frontend
(glassmorphism aurora UI) over an Express + Supabase Postgres backend.

```
619-erp-v2/
├── frontend/         Next.js 16 App Router · React 18 · Tailwind · TypeScript
├── backend/          Express 4 + Postgres API
├── db/migrations/    Supabase / Postgres schema and migrations
├── docs/             Project docs (live + archived)
│   └── archive/      Older one-off docs kept for history
├── scripts/          Build / deploy / git-push helper scripts (.bat / .ps1)
└── README.md         You are here
```

> If you see a folder called `_DELETE_ME_old_cruft/` at the project root,
> that's stale junk left from earlier iterations. Delete it from File
> Explorer at your convenience — nothing in the live project references it.

---

## Stack

| Layer       | Tech                                                           |
| ----------- | -------------------------------------------------------------- |
| Frontend    | Next.js 16 (App Router) · React 18 · TypeScript · Tailwind 3   |
| UI          | Custom **Aurora glass** design system (see `globals.css`)      |
| Backend     | Express 4 · `pg` · `helmet` · `cors` · `express-rate-limit`    |
| Database    | Supabase Postgres                                              |
| Auth        | JWT (HS256) with 7-day expiry, opaque token (id-only payload)  |
| Hosting     | Vercel (frontend) · Render (backend) · Supabase (db)           |

---

## Quick start

### Prereqs
- Node.js ≥ 18
- A Supabase project (free tier is fine) with the schema in
  `db/migrations/supabase-schema.sql` applied
- A `JWT_SECRET` (generate with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)

### Backend

```bash
cd backend
cp .env.example .env        # then edit .env with real values
npm install
npm run dev                 # http://localhost:5000
curl http://localhost:5000/api/health
```

Required env: `DATABASE_URL`, `JWT_SECRET`. Optional: `FRONTEND_URL`,
`PORT`, `NODE_ENV`, `JWT_EXPIRES_IN`.

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev                  # http://localhost:3000
```

---

## The Aurora UI

The design system lives entirely in `frontend/src/app/globals.css` and is
driven by CSS custom properties + utility classes (`.card`, `.btn-primary`,
`.kpi-card`, `.glass`, etc.). Want to retheme the whole app? Edit the `:root`
variables at the top of that file — every page repaints automatically.

Key primitives:

- `.glass` / `.card` — frosted glass surface with the signature gradient
  highlight stripe
- `.kpi-card` — stat tile with colored top accent (`.green`, `.red`,
  `.blue`, `.purple`, `.yellow`)
- `.btn-primary` / `.btn-ghost` / `.btn-outline` / `.btn-success` /
  `.btn-danger` — gradient-shine buttons
- `.display` / `.text-gradient` — gradient text helpers
- `.login-shell` — full-page aurora background with drifting orbs
- `.member-hero` — gradient hero card for the mobile member portal

---

## Backend API surface

Mounted under `/api`:

| Path              | Description                                   |
| ----------------- | --------------------------------------------- |
| `/auth`           | Login, refresh, password reset, `/me`         |
| `/clients`        | Members CRUD, plan assignment, KYC, segments  |
| `/trainers`       | Trainer CRUD, sessions, schedules             |
| `/payments`       | Receipts, dues, refunds, ledger               |
| `/dashboard`      | KPI summary feed                              |
| `/attendance`     | Member + trainer check-ins                    |
| `/reports`        | Collection, retention, occupancy reports      |
| `/health`         | Liveness probe                                |

Security: `helmet`, `cors` (with allow-list), `trust proxy=1`, request
logger, rate limit (2k/15min global · 30/15min on `/auth/login`), graceful
shutdown on SIGTERM/SIGINT, hidden 5xx error messages in production.

---

## Roles

- **admin** — full access, billing, member onboarding, reports
- **trainer** — own clients, attendance, classes
- **member** — mobile portal: classes, payments, attendance

---

## Deployment notes

- **Backend (Render):** repository points to `backend/`,
  `npm start` is the start command, env vars set in the Render dashboard.
- **Frontend (Vercel):** root directory `frontend/`,
  `NEXT_PUBLIC_API_URL` points at the Render API URL.
- **Database (Supabase):** apply migrations in this order:
  1. `db/migrations/supabase-schema.sql` (v2 base)
  2. `db/migrations/supabase-migration-v3.sql` (additive v3 — subscriptions, follow-ups, etc.)
  3. `db/migrations/supabase-v3-migration.sql` (additive v3 — plans, trials, enquiries)
  4. `db/migrations/supabase-schema-v3.sql` (additive v3 SaaS — members, bookings, classes, audit log)
  5. `db/migrations/face-checkin.sql` (face descriptors + log)
  6. `db/migrations/2026-05-perf-and-soft-delete.sql` (indexes + soft-delete)

  Run `supabase-schema-v3-recovery.sql` only if step 4 stalls on missing
  trainers — it re-seeds the demo trainers and class schedules.

  Steps 4–6 are required if you intend to run `npm run start:v3` (the
  v3 server / member portal modules). The v2 server (`npm start`) only
  needs steps 1–3 plus 5 if you want face check-in.

---

## What's new in v3

- Frontend upgraded **Next 9 → Next 16**, App Router, strict TypeScript
- Brand-new **Aurora glassmorphism UI** — completely re-themed without
  rewriting any page logic, by replacing `globals.css`
- Root folder cleaned up — 15+ scattered scripts and ad-hoc deploy docs
  consolidated into `scripts/` and `docs/archive/`
- Backend hardened: graceful shutdown, request logger, hidden production
  error messages, `trust proxy`, `disable x-powered-by`, dependency bumps
- Express 5-friendly — preflight handler removed, modern `helmet` config
- Mobile member portal hero now uses a gradient + halo glow

---

## License

Proprietary — © 619 Fitness Studio.
