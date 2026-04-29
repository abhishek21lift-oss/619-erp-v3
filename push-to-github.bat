@echo off
REM ─────────────────────────────────────────────────────────────
REM  619 Fitness — one-click push to GitHub
REM
REM  HOW TO USE:
REM  1. Create an empty repo on github.com (no README, no .gitignore)
REM  2. Copy the HTTPS URL it gives you (looks like https://github.com/USER/REPO.git)
REM  3. Edit the two lines below this banner with your info
REM  4. Save, then double-click this file
REM ─────────────────────────────────────────────────────────────

REM ── EDIT THESE TWO LINES ─────────────────────────────────────
set GIT_EMAIL=abhishek21lift@gmail.com
set REPO_URL=https://github.com/YOUR_USERNAME/619-erp-v3.git
REM ─────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo === 619 Fitness — Push to GitHub ===
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed.
    echo Download it from https://git-scm.com/download/win
    pause
    exit /b 1
)

if "%REPO_URL%"=="https://github.com/YOUR_USERNAME/619-erp-v3.git" (
    echo [ERROR] You forgot to edit REPO_URL at the top of this file.
    echo Replace YOUR_USERNAME with your real GitHub username.
    pause
    exit /b 1
)

REM Initialize repo if not already
if not exist .git (
    echo Initializing new git repository...
    git init
    git branch -M main
    git config user.email "%GIT_EMAIL%"
    git config user.name  "Abhishek Katiyar"
)

echo.
echo Staging all files (node_modules excluded by .gitignore)...
git add .

echo.
echo Files about to be committed:
git status --short

echo.
set /p CONFIRM="Press Enter to commit and push, or Ctrl+C to cancel: "

git commit -m "v3 SaaS upgrade — members, bookings, classes, notifications"

REM Add remote if missing
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo Adding remote: %REPO_URL%
    git remote add origin %REPO_URL%
)

echo.
echo Pushing to GitHub...
echo (If prompted: a browser window will open — sign in with GitHub)
git push -u origin main

if errorlevel 0 (
    echo.
    echo === SUCCESS ===
    echo Your code is now on GitHub: %REPO_URL%
) else (
    echo.
    echo === Push failed ===
    echo Most common cause: authentication. Try:
    echo   git config --global credential.helper manager-core
    echo Then run this script again.
)

echo.
pause
