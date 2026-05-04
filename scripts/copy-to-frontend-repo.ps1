# ═══════════════════════════════════════════════════════════════════
#  619 Fitness Studio — Copy updated frontend files to your repo
# ═══════════════════════════════════════════════════════════════════
#  WHAT THIS DOES:
#    Copies the 8 changed files from this folder into your separate
#    frontend GitHub repo, creating any missing folders.
#
#  HOW TO RUN:
#    1. Right-click this file → "Run with PowerShell"
#       (or open PowerShell, cd to this folder, run: .\copy-to-frontend-repo.ps1)
#    2. When prompted, paste the FULL path to your frontend repo folder
#       (e.g. D:\619-frontend  or  C:\Users\Lenovo\projects\619-frontend)
#    3. The script copies everything and shows what it did.
#    4. Then cd into that folder and: git add -A; git commit -m "..."; git push
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

# Source = this folder
$Source = $PSScriptRoot
if (-not $Source) { $Source = Split-Path -Parent $MyInvocation.MyCommand.Path }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  619 Fitness — Push frontend changes to your repo" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Source folder (this script):" -ForegroundColor Gray
Write-Host "  $Source"
Write-Host ""

# Ask for destination
$Dest = Read-Host "Paste the FULL path to your FRONTEND repo (e.g. D:\619-frontend)"
$Dest = $Dest.Trim('"').Trim("'").Trim()

if (-not (Test-Path $Dest)) {
    Write-Host ""
    Write-Host "ERROR: Folder not found: $Dest" -ForegroundColor Red
    Write-Host "Open File Explorer, navigate to your frontend repo, click the address bar, copy the path, and try again."
    Read-Host "Press Enter to exit"
    exit 1
}

# Detect repo layout: some repos keep code at <repo>/src, others at <repo>/frontend/src
$DestSrc = Join-Path $Dest 'src'
$DestFrontendSrc = Join-Path $Dest 'frontend\src'
$BaseDest = $null

if (Test-Path $DestFrontendSrc) {
    $BaseDest = Join-Path $Dest 'frontend'
    Write-Host ""
    Write-Host "Detected layout: <repo>/frontend/src" -ForegroundColor Yellow
} elseif (Test-Path $DestSrc) {
    $BaseDest = $Dest
    Write-Host ""
    Write-Host "Detected layout: <repo>/src" -ForegroundColor Yellow
} else {
    # Neither exists — assume <repo>/src and create as needed
    $BaseDest = $Dest
    Write-Host ""
    Write-Host "No existing src/ folder found — assuming layout: <repo>/src (will create)" -ForegroundColor Yellow
}

Write-Host "Destination base: $BaseDest" -ForegroundColor Gray
Write-Host ""

# Map of files: Source path (relative to this folder) -> Destination path (relative to $BaseDest)
$Files = @(
    @{ From = 'frontend\src\app\globals.css';            To = 'src\app\globals.css' },
    @{ From = 'frontend\src\app\layout.tsx';             To = 'src\app\layout.tsx' },
    @{ From = 'frontend\src\app\login\page.tsx';         To = 'src\app\login\page.tsx' },
    @{ From = 'frontend\src\app\clients\new\page.tsx';   To = 'src\app\clients\new\page.tsx' },
    @{ From = 'frontend\src\lib\api.ts';                 To = 'src\lib\api.ts' },
    @{ From = 'frontend\src\components\Sidebar.tsx';     To = 'src\components\Sidebar.tsx' },
    @{ From = 'frontend\src\components\BrandLogo.tsx';   To = 'src\components\BrandLogo.tsx' },
    @{ From = 'frontend\src\app\plans\page.tsx';         To = 'src\app\plans\page.tsx' }
)

$copied = 0
$skipped = 0
foreach ($f in $Files) {
    $srcFile = Join-Path $Source $f.From
    $dstFile = Join-Path $BaseDest $f.To

    if (-not (Test-Path $srcFile)) {
        Write-Host "  SKIP   $($f.From)  (source missing)" -ForegroundColor DarkYellow
        $skipped++
        continue
    }

    $dstDir = Split-Path -Parent $dstFile
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        Write-Host "  mkdir  $dstDir" -ForegroundColor DarkGray
    }

    Copy-Item -Path $srcFile -Destination $dstFile -Force
    Write-Host "  COPY   $($f.To)" -ForegroundColor Green
    $copied++
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  $copied file(s) copied, $skipped skipped" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Offer to run git commands
$inGit = Test-Path (Join-Path $Dest '.git')
if (-not $inGit) {
    $inGit = Test-Path (Join-Path $BaseDest '.git')
    if ($inGit) { $Dest = $BaseDest }
}

if ($inGit) {
    Write-Host "Found a .git folder at: $Dest" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps to push to GitHub:" -ForegroundColor Yellow
    Write-Host "  cd `"$Dest`""
    Write-Host "  git status"
    Write-Host "  git add -A"
    Write-Host "  git commit -m `"feat: new UI theme, PT plan generator, anniversary field, drop joining_date`""
    Write-Host "  git push origin main"
    Write-Host ""
    $auto = Read-Host "Run those git commands now automatically? (y/n)"
    if ($auto -eq 'y' -or $auto -eq 'Y') {
        Push-Location $Dest
        try {
            Write-Host ""
            Write-Host "→ git status" -ForegroundColor Cyan
            git status
            Write-Host ""
            Write-Host "→ git add -A" -ForegroundColor Cyan
            git add -A
            Write-Host ""
            Write-Host "→ git commit" -ForegroundColor Cyan
            git commit -m "feat: new UI theme, PT plan generator, anniversary field, drop joining_date"
            Write-Host ""
            Write-Host "→ git push origin main" -ForegroundColor Cyan
            git push origin main
            Write-Host ""
            Write-Host "DONE — pushed to GitHub." -ForegroundColor Green
        } catch {
            Write-Host "Git error: $_" -ForegroundColor Red
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Host "(No .git folder detected — run git commands manually after copying.)" -ForegroundColor DarkGray
}

Write-Host ""
Read-Host "Press Enter to close"
