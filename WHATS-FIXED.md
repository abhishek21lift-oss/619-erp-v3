# 619 FITNESS STUDIO ERP — Fix Pack

This pack ships every fix you asked for in one go: a light & classy theme,
a cleaned-up sidebar (no Home tab, Dashboard at the top), a clearly visible
gym logo on the login screen, dedicated pages for **every** sidebar entry,
and a working staff attendance flow.

---

## 1. What changed at a glance

### Theme — light & classy
- `frontend/src/app/globals.css` — full repaint. CSS variables
  swapped from the dark "Aurora" stack to a soft ivory canvas with
  white cards, slate text, crimson accents. All component classes
  kept the same names so existing pages render with no edits.
- `frontend/src/app/layout.tsx` — meta `theme-color` set to white,
  `color-scheme` to light, page title updated to **619 FITNESS STUDIO**.

### Sidebar — Home gone, Dashboard promoted
- `frontend/src/lib/nav-config.ts` — the `home` group is removed.
  A new top-level `DASHBOARD_ITEM` is exported and rendered above
  the groups. Every sidebar item now points at a real, dedicated route.
- `frontend/src/components/Sidebar.tsx` — renders `DASHBOARD_ITEM`
  first, then the groups.

### Login screen — logo & branding
- `frontend/src/components/BrandLogo.tsx` — the logo now sits in a
  white tile with a soft crimson glow ring, so the gym mark reads
  cleanly on the light background. Falls back to a "619" gradient tile.
- `frontend/src/app/login/page.tsx` — heading is now **619 FITNESS STUDIO**
  (capital letters), the dark aurora orbs are replaced with subtle
  light halos, and the logo is rendered larger (108 px) so it's the
  first thing your athletes see.

### Sales pages (real, not query-string filters)
- `frontend/src/app/sales/leads/page.tsx` — Lead Inbox with KPI
  cards, search, and an "Open →" link to the lead's profile.
- `frontend/src/app/sales/enquiry/page.tsx` — Add Enquiry form (name,
  mobile, email, DOB, gender, interest, lead source, notes). Saves
  via `api.clients.create({ status: 'lead', … })` and bounces back
  to the inbox.
- `frontend/src/app/sales/funnel/page.tsx` — Conversion Funnel —
  Leads → Trials → Converted → Active, with a calculated conversion %.
- `frontend/src/app/sales/sources/page.tsx` — Lead Sources breakdown
  by `reference_no`, including conversion % per channel.

### Members pages — dedicated routes
- `frontend/src/app/members/active/page.tsx`
- `frontend/src/app/members/expiring/page.tsx`
- `frontend/src/app/members/lapsed/page.tsx`
- `frontend/src/app/members/birthdays/page.tsx`

All four are powered by a new shared component:
`frontend/src/components/MemberSegmentPage.tsx`

### Training, Operations, Finance, Insights — dedicated pages
- `frontend/src/app/training/transformations/page.tsx`
- `frontend/src/app/attendance/staff/page.tsx`  ← **the staff
  attendance fix lives here**
- `frontend/src/app/operations/leaderboard/page.tsx`
- `frontend/src/app/finance/dues/page.tsx`
- `frontend/src/app/finance/collection/page.tsx`
- `frontend/src/app/finance/pl/page.tsx`
- `frontend/src/app/finance/forecast/page.tsx`
- `frontend/src/app/insights/traffic/page.tsx`
- `frontend/src/app/insights/renewal/page.tsx`
- `frontend/src/app/insights/sessions/page.tsx`

### Staff attendance — the actual bug
The old `/attendance` page only handled members; there was no UI to
mark staff. Two fixes:

1. **Frontend** — new dedicated page at `/attendance/staff` that
   lists every coach, supports P / A / L marking, "Mark all
   present", a date picker, and a search box. Title bar on the
   members page now has a "Staff →" shortcut for admins.

2. **Backend** — `backend/619-erp-backend/src/routes/attendance.js`
   now accepts `?from=` and `?to=` on `GET /api/attendance` so the
   leaderboard, footfall, sessions and the staff attendance report
   can pull a date range. `POST /api/attendance` already supports
   `type='trainer'`, so no changes were needed there.

---

## 2. Files added or modified

```
backend/619-erp-backend/src/routes/attendance.js     (modified)

frontend/src/app/globals.css                         (modified)
frontend/src/app/layout.tsx                          (modified)
frontend/src/app/login/page.tsx                      (modified)
frontend/src/app/attendance/page.tsx                 (modified — admin "Staff →" link)
frontend/src/app/reports/page.tsx                    (modified — link target)

frontend/src/lib/nav-config.ts                       (modified)
frontend/src/components/Sidebar.tsx                  (modified)
frontend/src/components/BrandLogo.tsx                (modified)
frontend/src/components/MemberSegmentPage.tsx        (new)

frontend/src/app/attendance/staff/page.tsx           (new)
frontend/src/app/sales/leads/page.tsx                (new)
frontend/src/app/sales/enquiry/page.tsx              (new)
frontend/src/app/sales/funnel/page.tsx               (new)
frontend/src/app/sales/sources/page.tsx              (new)
frontend/src/app/members/active/page.tsx             (new)
frontend/src/app/members/expiring/page.tsx           (new)
frontend/src/app/members/lapsed/page.tsx             (new)
frontend/src/app/members/birthdays/page.tsx          (new)
frontend/src/app/training/transformations/page.tsx   (new)
frontend/src/app/operations/leaderboard/page.tsx     (new)
frontend/src/app/finance/dues/page.tsx               (new)
frontend/src/app/finance/collection/page.tsx         (new)
frontend/src/app/finance/pl/page.tsx                 (new)
frontend/src/app/finance/forecast/page.tsx           (new)
frontend/src/app/insights/traffic/page.tsx           (new)
frontend/src/app/insights/renewal/page.tsx           (new)
frontend/src/app/insights/sessions/page.tsx          (new)
```

---

## 3. How to push to your two GitHub repos

You have **619-erp-frontend** and **619-erp-backend** on GitHub. The
working folder on this machine has both side-by-side:

```
D:\619-erp-v2-FINAL\619-erp-v2\
    backend\619-erp-backend\         <- pushes to 619-erp-backend
    frontend\                        <- pushes to 619-erp-frontend
```

### One-time setup (skip if remotes are already wired)

Open PowerShell in each folder and check the remote:

```powershell
cd D:\619-erp-v2-FINAL\619-erp-v2\backend\619-erp-backend
git remote -v
# If it doesn't already point at your 619-erp-backend repo:
git remote set-url origin https://github.com/<your-user>/619-erp-backend.git
```

```powershell
cd D:\619-erp-v2-FINAL\619-erp-v2\frontend
git remote -v
# If it doesn't already point at your 619-erp-frontend repo:
git remote set-url origin https://github.com/<your-user>/619-erp-frontend.git
```

### Push the backend change

```powershell
cd D:\619-erp-v2-FINAL\619-erp-v2\backend\619-erp-backend
git status
git add src/routes/attendance.js
git commit -m "feat(attendance): support date-range queries for reports & dashboards"
git push origin main
```

> If your default branch is `master` instead of `main`, swap the
> branch name. Your hosting (Render in `api.ts`) should redeploy
> automatically once the push lands.

### Push the frontend changes

```powershell
cd D:\619-erp-v2-FINAL\619-erp-v2\frontend
git status

# Stage every changed and new file in one go
git add src/app/globals.css `
        src/app/layout.tsx `
        src/app/login/page.tsx `
        src/app/attendance/page.tsx `
        src/app/attendance/staff `
        src/app/sales `
        src/app/members `
        src/app/training `
        src/app/operations `
        src/app/finance `
        src/app/insights `
        src/app/reports/page.tsx `
        src/lib/nav-config.ts `
        src/components/Sidebar.tsx `
        src/components/BrandLogo.tsx `
        src/components/MemberSegmentPage.tsx

git commit -m "feat: light theme, dedicated sidebar pages, staff attendance, login branding"
git push origin main
```

If you'd rather just stage everything that changed, that's fine too:

```powershell
git add -A
git commit -m "feat: light theme, dedicated sidebar pages, staff attendance, login branding"
git push origin main
```

### After pushing

- **Vercel** (or wherever the frontend is hosted) will redeploy when
  it sees the new commit on `main`. Once it's live, hard-refresh
  (Ctrl + Shift + R) to bypass any cached CSS.
- **Render** (backend) — same. The `attendance.js` change is
  backwards-compatible: existing single-date queries keep working.

### Verify the staff attendance fix

1. Sign in as the admin (`abhishekatiyar@gmail.com`).
2. Sidebar → **Operations → Staff Attendance**.
3. You'll see every coach with three buttons (P / A / L). Tap one
   and the row updates instantly. The KPI strip at the top reflects
   present / absent / late / unmarked counts. The same data is
   summarised under Reports → Staff Attendance.

---

## 4. Sanity checklist before you go live

- [ ] Logo file actually exists at `frontend/public/logo.PNG` (or
      `.png`). The BrandLogo tries multiple casings, but if every
      lookup 404s it falls back to a "619" gradient tile — which
      still looks fine on the new light theme.
- [ ] `NEXT_PUBLIC_API_URL` env var on Vercel points at your
      Render backend. If unset, `frontend/src/lib/api.ts` defaults
      to `https://619-erp-api.onrender.com`.
- [ ] On the backend, the `attendance` table already has
      `(type, ref_id, date)` as a unique key (the POST upserts on
      that key). If you ever rebuild the DB, keep that constraint.

---

Train heavy. Run light. Good luck with the National in January 2027 —
281 / 201 / 301 here we come.
