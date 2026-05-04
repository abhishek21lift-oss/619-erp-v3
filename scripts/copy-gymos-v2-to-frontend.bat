@echo off
REM ═════════════════════════════════════════════════════════════════════
REM  619 Fitness — One-click launcher for GymOS v2 push
REM  Just DOUBLE-CLICK this file.
REM ═════════════════════════════════════════════════════════════════════
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-gymos-v2-to-frontend.ps1"
pause
