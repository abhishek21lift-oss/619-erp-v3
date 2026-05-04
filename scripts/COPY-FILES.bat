@echo off
setlocal EnableDelayedExpansion
title 619 Fitness - Copy Frontend Files
color 0A

echo.
echo ===============================================================
echo   619 Fitness Studio - Copy frontend files to your repo
echo ===============================================================
echo.
echo This script copies the 8 changed files into your frontend
echo GitHub repo folder. After it finishes, push using GitHub
echo Desktop or run "git push" yourself.
echo.

set "SRC=%~dp0frontend\src"

echo Source folder:
echo   %SRC%
echo.

set /p "DEST=Paste the FULL path to your FRONTEND repo (e.g. D:\619-frontend): "

REM Strip surrounding quotes if user pasted with quotes
set "DEST=%DEST:"=%"

if not exist "%DEST%" (
    echo.
    echo  ERROR: Folder not found:  %DEST%
    echo  Open File Explorer, copy the path from the address bar,
    echo  and run this script again.
    echo.
    pause
    exit /b 1
)

REM Detect if repo uses <repo>\src or <repo>\frontend\src
set "BASE=%DEST%"
if exist "%DEST%\frontend\src" set "BASE=%DEST%\frontend"

echo.
echo Destination base: %BASE%
echo.
echo Copying files...
echo.

REM Make folders if needed (xcopy auto-creates intermediates with /I)
if not exist "%BASE%\src\app"               mkdir "%BASE%\src\app"
if not exist "%BASE%\src\app\login"         mkdir "%BASE%\src\app\login"
if not exist "%BASE%\src\app\clients\new"   mkdir "%BASE%\src\app\clients\new"
if not exist "%BASE%\src\app\plans"         mkdir "%BASE%\src\app\plans"
if not exist "%BASE%\src\lib"               mkdir "%BASE%\src\lib"
if not exist "%BASE%\src\components"        mkdir "%BASE%\src\components"

call :copy_one "%SRC%\app\globals.css"            "%BASE%\src\app\globals.css"
call :copy_one "%SRC%\app\layout.tsx"             "%BASE%\src\app\layout.tsx"
call :copy_one "%SRC%\app\login\page.tsx"         "%BASE%\src\app\login\page.tsx"
call :copy_one "%SRC%\app\clients\new\page.tsx"   "%BASE%\src\app\clients\new\page.tsx"
call :copy_one "%SRC%\lib\api.ts"                 "%BASE%\src\lib\api.ts"
call :copy_one "%SRC%\components\Sidebar.tsx"     "%BASE%\src\components\Sidebar.tsx"
call :copy_one "%SRC%\components\BrandLogo.tsx"   "%BASE%\src\components\BrandLogo.tsx"
call :copy_one "%SRC%\app\plans\page.tsx"         "%BASE%\src\app\plans\page.tsx"

echo.
echo ===============================================================
echo   DONE. Files copied to:
echo   %BASE%\src\
echo ===============================================================
echo.
echo NEXT STEPS to push to GitHub:
echo.
echo   Option 1 - GitHub Desktop (easiest):
echo     1. Open GitHub Desktop
echo     2. Select your frontend repo
echo     3. You'll see the 8 changed files
echo     4. Type a commit message at the bottom
echo     5. Click "Commit to main"
echo     6. Click "Push origin"
echo.
echo   Option 2 - Command line:
echo     cd /d "%DEST%"
echo     git add -A
echo     git commit -m "feat: new UI, PT plans, anniversary field"
echo     git push origin main
echo.
pause
exit /b 0

:copy_one
copy /Y "%~1" "%~2" >nul
if errorlevel 1 (
    echo   FAIL  %~nx2
) else (
    echo   OK    %~2
)
goto :eof
