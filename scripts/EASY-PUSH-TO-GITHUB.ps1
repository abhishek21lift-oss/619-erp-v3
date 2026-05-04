# ════════════════════════════════════════════════════════════════════
#  ULTRA-EASY one-click pusher
#  Copies the 10 GymOS v2 files into your frontend repo, then
#  saves & uploads them to GitHub. No git knowledge needed.
# ════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$Source = $PSScriptRoot
if (-not $Source) { $Source = Split-Path -Parent $MyInvocation.MyCommand.Path }

function Say($msg, $color = 'White') { Write-Host $msg -ForegroundColor $color }
function Bar { Write-Host ("=" * 68) -ForegroundColor Cyan }

Clear-Host
Bar
Say "  ONE-CLICK PUSH:  GymOS v2 (Navigation + Dashboard) -> GitHub" Cyan
Bar
Say ""
Say "I will do these things for you:" White
Say "  1. Copy 10 updated files into your frontend repo" Gray
Say "  2. Save them with a clear message" Gray
Say "  3. Upload them to GitHub" Gray
Say ""
Say "Backend & Supabase: NO CHANGES NEEDED. You only push the frontend." Yellow
Say ""

# ── STEP 1: ask for path ────────────────────────────────────────────
Say "STEP 1 of 4 -- Where is your frontend repo?" Cyan
Say "  Tip: open your repo folder in File Explorer, click the address" DarkGray
Say "  bar at the top, copy the path, then paste it below." DarkGray
Say ""
$Dest = Read-Host "Paste path here"
$Dest = $Dest.Trim('"').Trim("'").Trim()

if (-not (Test-Path $Dest)) {
    Say ""
    Say "  X  That folder does not exist:  $Dest" Red
    Say "     Double-check the path and run this script again." Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Detect <repo>/src vs <repo>/frontend/src
$BaseDest = $Dest
if (Test-Path (Join-Path $Dest 'frontend\src')) {
    $BaseDest = Join-Path $Dest 'frontend'
    Say "  Detected layout: <repo>\frontend\src" Yellow
} elseif (Test-Path (Join-Path $Dest 'src')) {
    Say "  Detected layout: <repo>\src" Yellow
} else {
    Say "  No src folder yet -- will create one." Yellow
}
Say ""

# ── STEP 2: copy files ──────────────────────────────────────────────
Say "STEP 2 of 4 -- Copying 10 files into your repo..." Cyan

$Files = @(
    'frontend\src\lib\nav-config.ts',
    'frontend\src\lib\favorites.ts',
    'frontend\src\components\CommandPalette.tsx',
    'frontend\src\components\Breadcrumbs.tsx',
    'frontend\src\components\NotificationBell.tsx',
    'frontend\src\components\TopBar.tsx',
    'frontend\src\components\Sidebar.tsx',
    'frontend\src\app\dashboard\page.tsx',
    'frontend\src\app\layout.tsx',
    'frontend\src\app\globals.css'
)

$copied = 0; $missing = @()
foreach ($f in $Files) {
    $src = Join-Path $Source $f
    # Strip the leading "frontend\" so destination matches the repo's layout
    $relTarget = $f -replace '^frontend\\', ''
    $dst = Join-Path $BaseDest $relTarget
    if (-not (Test-Path $src)) { $missing += $f; continue }

    $dstDir = Split-Path -Parent $dst
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }

    Copy-Item -Path $src -Destination $dst -Force
    Say ("  OK  {0}" -f $relTarget) Green
    $copied++
}

if ($missing.Count -gt 0) {
    Say ""
    Say "  ! Some source files were missing in this folder:" Yellow
    $missing | ForEach-Object { Say "    - $_" Yellow }
}
Say ""
Say "  Copied $copied of $($Files.Count) files." White
Say ""

if ($copied -eq 0) {
    Say "Nothing was copied. Aborting." Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── STEP 3: git save (commit) ───────────────────────────────────────
Say "STEP 3 of 4 -- Saving changes inside your repo..." Cyan

# Find the .git folder
$gitRoot = $null
if (Test-Path (Join-Path $Dest '.git'))      { $gitRoot = $Dest }
elseif (Test-Path (Join-Path $BaseDest '.git')) { $gitRoot = $BaseDest }

if (-not $gitRoot) {
    Say "  ! Could not find a .git folder in your repo." Yellow
    Say "    The files are copied, but I cannot save/upload them automatically." Yellow
    Say "    Open the folder, run 'git init', connect it to GitHub, then re-run." Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

Push-Location $gitRoot
try {
    # Check git is installed
    $gitCheck = & git --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Say "  X  Git is not installed on this computer." Red
        Say "     Install it from https://git-scm.com and run this script again." Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Say "  Git found: $gitCheck" Gray

    # Show what changed
    Say ""
    Say "  Files that will be saved:" Gray
    $changes = & git status --short 2>&1
    if (-not $changes) {
        Say "    (no changes detected -- maybe these files were already pushed)" DarkYellow
        Say ""
        Say "  Nothing to upload. Done." Green
        Read-Host "Press Enter to exit"
        exit 0
    }
    $changes | ForEach-Object { Say "    $_" DarkGray }
    Say ""

    # Stage everything
    Say "  + Staging all changes..." Gray
    & git add -A 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git add failed" }

    # Commit
    $msg = "feat(ui): GymOS v2 navigation + dashboard upgrade"
    Say "  + Saving with message: `"$msg`"" Gray
    & git commit -m $msg 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # commit returns non-zero if nothing to commit -- not always fatal
        $st = & git status --short
        if ($st) { throw "git commit failed" }
    }
    Say "  OK Saved locally." Green
    Say ""

    # ── STEP 4: push ────────────────────────────────────────────────
    Say "STEP 4 of 4 -- Uploading to GitHub..." Cyan
    $branchOut = & git rev-parse --abbrev-ref HEAD 2>&1
    $branch = $branchOut.Trim()
    Say "  Current branch: $branch" Gray

    $pushOut = & git push origin $branch 2>&1
    $pushOk  = ($LASTEXITCODE -eq 0)

    if (-not $pushOk) {
        Say "  ! First push didn't work -- trying with -u (set upstream)..." Yellow
        $pushOut = & git push -u origin $branch 2>&1
        $pushOk  = ($LASTEXITCODE -eq 0)
    }

    if ($pushOk) {
        Say ""
        Bar
        Say "  SUCCESS! Your changes are now on GitHub." Green
        Bar
        Say ""
        Say "What to do next:" White
        Say "  - If your site auto-deploys (Vercel/Netlify/Render), it will" Gray
        Say "    rebuild within a few minutes. Check your hosting dashboard." Gray
        Say "  - Otherwise, redeploy your frontend manually." Gray
        Say ""
    } else {
        Say ""
        Say "  X Push failed. Output:" Red
        $pushOut | ForEach-Object { Say "    $_" DarkRed }
        Say ""
        Say "  Most common reasons:" Yellow
        Say "    1. You aren't logged into GitHub from this computer." Yellow
        Say "       Run: git config --global credential.helper manager-core" Yellow
        Say "       Then push once manually so it asks for your login." Yellow
        Say "    2. Someone else pushed first. Run 'git pull --rebase'" Yellow
        Say "       inside the repo, then run this script again." Yellow
        Say "    3. The branch name 'origin' doesn't exist yet. In that case" Yellow
        Say "       open your repo on GitHub, copy the HTTPS URL, then run:" Yellow
        Say "       git remote add origin <URL>" Yellow
    }
} catch {
    Say "  X Something went wrong: $_" Red
} finally {
    Pop-Location
}

Say ""
Read-Host "Press Enter to close this window"
