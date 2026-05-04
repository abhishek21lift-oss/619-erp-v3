# 619 Fitness — Aurora Operating System

A modern gym/fitness management ERP. Members, trainers, classes, payments,
attendance and reporting in one place. Built as a Next.js 14 frontend
(glassmorphism aurora UI) over an Express + Supabase Postgres backend.

```
619-erp-v2/
├── frontend/         Next.js 14 App Router · Tailwind · TypeScript
├── backend/          Express + Postgres API
│   └── 619-erp-backend/
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
| Frontend    | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3   |
| UI          | Custom **Aurora glass** design system (see `globals.css`)      |
| Backend     | Express 4 · `pg` · `helmet` · `cors` · `express-rate-limit`    |
| Database    | Supabase Postgres                                              |
| Auth        | JWT (HS256) with 7-day expiry                                  |
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
cd backend/619-erp-backend
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

- **Backend (Render):** repository points to `backend/619-erp-backend`,
  `npm start` is the start command, env vars set in the Render dashboard.
- **Frontend (Vercel):** root directory `frontend/`,
  `NEXT_PUBLIC_API_URL` points at the Render API URL.
- **Database (Supabase):** apply `db/migrations/supabase-schema.sql`,
  then `supabase-migration-v3.sql`. `supabase-schema-v3-recovery.sql`
  is a recovery script — only use it if you know why.

---

## What's new in v3

- Frontend upgraded **Next 9 → Next 14**, App Router, strict TypeScript
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
