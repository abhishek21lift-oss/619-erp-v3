# ═══════════════════════════════════════════════════════════════════
#  619 Fitness — Push GymOS v2 (Navigation + Dashboard) changes
# ═══════════════════════════════════════════════════════════════════
#  WHAT THIS DOES:
#    Copies the 10 GymOS v2 files (6 new + 4 modified) from this
#    staging folder into your separate frontend GitHub repo.
#
#  Backend / Supabase: NO CHANGES NEEDED for this batch.
#
#  HOW TO RUN:
#    Right-click → "Run with PowerShell"
#    OR double-click  copy-gymos-v2-to-frontend.bat  (created beside this file)
#    When prompted, paste the FULL path to your frontend repo folder
#    (e.g.  D:\619-frontend  or  C:\Users\Lenovo\projects\619-frontend)
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

$Source = $PSScriptRoot
if (-not $Source) { $Source = Split-Path -Parent $MyInvocation.MyCommand.Path }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  619 Fitness — GymOS v2 (Navigation + Dashboard) push" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Source (this staging folder):" -ForegroundColor Gray
Write-Host "  $Source"
Write-Host ""

$Dest = Read-Host "Paste FULL path to your FRONTEND repo (e.g. D:\619-frontend)"
$Dest = $Dest.Trim('"').Trim("'").Trim()

if (-not (Test-Path $Dest)) {
    Write-Host ""
    Write-Host "ERROR: Folder not found: $Dest" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Detect layout: <repo>/src or <repo>/frontend/src
$DestSrc          = Join-Path $Dest 'src'
$DestFrontendSrc  = Join-Path $Dest 'frontend\src'
$BaseDest         = $null

if (Test-Path $DestFrontendSrc) {
    $BaseDest = Join-Path $Dest 'frontend'
    Write-Host "Detected layout: <repo>/frontend/src" -ForegroundColor Yellow
} elseif (Test-Path $DestSrc) {
    $BaseDest = $Dest
    Write-Host "Detected layout: <repo>/src" -ForegroundColor Yellow
} else {
    $BaseDest = $Dest
    Write-Host "No src/ found — assuming <repo>/src (will create)" -ForegroundColor Yellow
}

Write-Host "Destination base: $BaseDest" -ForegroundColor Gray
Write-Host ""

# 10 files: 6 new + 4 modified
$Files = @(
    # --- NEW (6) ---
    @{ From = 'frontend\src\lib\nav-config.ts';                  To = 'src\lib\nav-config.ts'                   ; Tag = 'NEW' },
    @{ From = 'frontend\src\lib\favorites.ts';                   To = 'src\lib\favorites.ts'                    ; Tag = 'NEW' },
    @{ From = 'frontend\src\components\CommandPalette.tsx';      To = 'src\components\CommandPalette.tsx'       ; Tag = 'NEW' },
    @{ From = 'frontend\src\components\Breadcrumbs.tsx';         To = 'src\components\Breadcrumbs.tsx'          ; Tag = 'NEW' },
    @{ From = 'frontend\src\components\NotificationBell.tsx';    To = 'src\components\NotificationBell.tsx'     ; Tag = 'NEW' },
    @{ From = 'frontend\src\components\TopBar.tsx';              To = 'src\components\TopBar.tsx'               ; Tag = 'NEW' },
    # --- MODIFIED (4) ---
    @{ From = 'frontend\src\components\Sidebar.tsx';             To = 'src\components\Sidebar.tsx'              ; Tag = 'MOD' },
    @{ From = 'frontend\src\app\dashboard\page.tsx';             To = 'src\app\dashboard\page.tsx'              ; Tag = 'MOD' },
    @{ From = 'frontend\src\app\layout.tsx';                     To = 'src\app\layout.tsx'                      ; Tag = 'MOD' },
    @{ From = 'frontend\src\app\globals.css';                    To = 'src\app\globals.css'                     ; Tag = 'MOD' }
)

$copied = 0; $skipped = 0
foreach ($f in $Files) {
    $srcFile = Join-Path $Source $f.From
    $dstFile = Join-Path $BaseDest $f.To

    if (-not (Test-Path $srcFile)) {
        Write-Host ("  SKIP {0,-3} {1}  (source missing)" -f $f.Tag, $f.From) -ForegroundColor DarkYellow
        $skipped++
        continue
    }

    $dstDir = Split-Path -Parent $dstFile
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        Write-Host "  mkdir  $dstDir" -ForegroundColor DarkGray
    }

    Copy-Item -Path $srcFile -Destination $dstFile -Force
    $color = if ($f.Tag -eq 'NEW') { 'Green' } else { 'Cyan' }
    Write-Host ("  {0,-4}  {1}" -f $f.Tag, $f.To) -ForegroundColor $color
    $copied++
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  $copied file(s) copied, $skipped skipped" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Offer to run git commands ──
$gitRoot = $null
if (Test-Path (Join-Path $Dest '.git'))      { $gitRoot = $Dest }
elseif (Test-Path (Join-Path $BaseDest '.git')) { $gitRoot = $BaseDest }

if ($gitRoot) {
    $branch = "feat/gymos-v2-navigation-dashboard"
    $commit = "feat(ui): GymOS v2 navigation + dashboard

- New IA: 7-group sidebar (Home/Sales/Members/Training/Operations/Finance/Insights)
- Collapsible sidebar rail with persisted state + per-group expand/collapse
- Pinned favorites in the sidebar (per-user localStorage)
- Cmd-K command palette: fuzzy nav search, member search, quick actions
- Auto-generated breadcrumbs (resolves /clients/[id] to member name)
- Notification bell (renewals, dues, recent payments) with snooze + mark-read
- Shared TopBar (breadcrumbs + search trigger + notifications + avatar)
- Dashboard v2: 5 hero KPIs with delta % + sparklines, smart alert banners,
  revenue trend, sales funnel widget, today's action queue
- ~480 lines of new component CSS appended to globals.css

No backend or Supabase schema changes."

    Write-Host "Found .git at: $gitRoot" -ForegroundColor Green
    Write-Host ""
    Write-Host "Suggested git workflow:" -ForegroundColor Yellow
    Write-Host "  cd `"$gitRoot`""
    Write-Host "  git checkout -b $branch"
    Write-Host "  git add -A"
    Write-Host "  git commit -m `"feat(ui): GymOS v2 navigation + dashboard`""
    Write-Host "  git push -u origin $branch"
    Write-Host "  # Then open a PR on GitHub and merge to main."
    Write-Host ""

    $auto = Read-Host "Run these git commands automatically on a new branch? (y/n)"
    if ($auto -eq 'y' -or $auto -eq 'Y') {
        Push-Location $gitRoot
        try {
            Write-Host ""; Write-Host "→ git status (before)" -ForegroundColor Cyan
            git status --short

            Write-Host ""; Write-Host "→ git checkout -b $branch" -ForegroundColor Cyan
            git checkout -b $branch 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Branch may already exist — switching instead..." -ForegroundColor DarkYellow
                git checkout $branch
            }

            Write-Host ""; Write-Host "→ git add -A" -ForegroundColor Cyan
            git add -A

            Write-Host ""; Write-Host "→ git commit" -ForegroundColor Cyan
            git commit -m $commit

            Write-Host ""; Write-Host "→ git push -u origin $branch" -ForegroundColor Cyan
            git push -u origin $branch

            Write-Host ""
            Write-Host "DONE — pushed to GitHub on branch '$branch'." -ForegroundColor Green
            Write-Host "Open a PR at: (your repo URL)/pull/new/$branch" -ForegroundColor Green
        } catch {
            Write-Host "Git error: $_" -ForegroundColor Red
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Host "(No .git folder detected — run git commands manually.)" -ForegroundColor DarkGray
}

Write-Host ""
Read-Host "Press Enter to close"
