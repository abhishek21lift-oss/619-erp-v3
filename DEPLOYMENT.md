# 619 ERP — Deployment Guide (v4.0)

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ LTS |
| PostgreSQL | 14+ |
| npm | 9+ |

---

## 1. Environment Variables

### Backend (`backend/.env`)

```env
# ── Required ────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/619erp
JWT_SECRET=<random 32+ character secret>      # openssl rand -hex 32
FRONTEND_URL=https://your-domain.com           # no trailing slash

# ── Optional (sensible defaults shown) ──────────────────────
PORT=5000
NODE_ENV=production
JWT_EXPIRES_IN=7d
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

---

## 2. Database Setup

### New installation

```bash
psql $DATABASE_URL -f backend/src/db/schema.sql
```

### Upgrade from v3 (existing data)

```bash
psql $DATABASE_URL -f backend/src/db/migrations/001_v4_upgrade.sql
```

The migration is **idempotent** — safe to re-run if it errors partway.

### Create the first admin user

```sql
-- Run in psql after schema is applied
INSERT INTO users (name, email, password, role)
VALUES (
  'Admin',
  'admin@619fitness.com',
  -- bcrypt hash of your chosen password (cost 10)
  -- Generate: node -e "require('bcryptjs').hash('YourPassword',10).then(console.log)"
  '$2a$10$REPLACE_WITH_REAL_HASH',
  'admin'
);
```

---

## 3. Face Recognition Models

The face check-in module requires three model files in `frontend/public/models/`:

```
public/models/
├── tiny_face_detector_model-shard1
├── tiny_face_detector_model-weights_manifest.json
├── face_landmark_68_model-shard1
├── face_landmark_68_model-weights_manifest.json
├── face_recognition_model-shard1
├── face_recognition_model-shard2
└── face_recognition_model-weights_manifest.json
```

Download from the official face-api.js models repository:
```bash
cd frontend/public
git clone https://github.com/justadudewhohacks/face-api.js --depth=1 face-api-src
cp -r face-api-src/weights models
rm -rf face-api-src
```

---

## 4. Local Development

```bash
# Backend
cd backend
npm install
npm run dev           # nodemon on port 5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev           # Next.js on port 3000
```

Visit `http://localhost:3000`

---

## 5. Production Build

```bash
# Frontend
cd frontend
npm run build
npm start             # or deploy to Vercel / Netlify

# Backend
cd backend
npm install --omit=dev
node src/server.js    # or use PM2 / Docker
```

### PM2 (recommended for VPS)

```bash
npm install -g pm2
cd backend
pm2 start src/server.js --name 619-api
pm2 startup
pm2 save
```

---

## 6. Render.com Deploy (Current Setup)

### Backend Web Service

| Setting | Value |
|---------|-------|
| Build Command | `npm install` |
| Start Command | `node src/server.js` |
| Environment | Add all `.env` vars in Render dashboard |

### Frontend (Static Site or Next.js)

| Setting | Value |
|---------|-------|
| Build Command | `cd frontend && npm install && npm run build` |
| Publish Directory | `frontend/.next` |
| Environment | `NEXT_PUBLIC_API_URL` → backend URL |

---

## 7. Health Check

```bash
curl https://your-api.com/api/health
# → {"status":"ok","time":"...","env":{...}}
```

---

## 8. QA Checklist

### Authentication
- [ ] Login with admin credentials → redirect to `/dashboard`
- [ ] Login with trainer credentials → redirect to `/trainer/dashboard`
- [ ] Login with wrong password → error message shown
- [ ] Token expiry → logout and redirect to `/login`

### Members
- [ ] List loads with pagination (50 per page)
- [ ] Search by name, phone, email works
- [ ] Segment tabs: active / expired / frozen / dues / expiring / birthdays
- [ ] Click row → opens profile page
- [ ] Profile tabs: Overview / Attendance / Payments all load
- [ ] CSV export downloads valid file

### Payments
- [ ] Payment list loads with KPI strip
- [ ] Date range filter works
- [ ] Method filter works
- [ ] Record New Payment modal submits (admin)
- [ ] CSV export works

### Reports
- [ ] Monthly Revenue bar chart renders
- [ ] Year navigation (prev/next) works
- [ ] Pending Dues tab shows members with balance > 0
- [ ] Coach Summary shows trainer breakdown (admin only)

### Face Check-in
- [ ] Camera permission prompt shown
- [ ] Models load from `/public/models/`
- [ ] Face detected → scan line animates
- [ ] Liveness check (blink) triggered
- [ ] Successful recognition shows member name
- [ ] Offline banner shown when disconnected

### Security
- [ ] Direct API call without token → 401
- [ ] Trainer cannot access another trainer's client → 403/404
- [ ] Non-admin cannot delete client → 403
- [ ] Path traversal in body → 400
