@echo off
REM ════════════════════════════════════════════════════════════════════
REM  ULTRA-EASY one-click pusher for GymOS v2 changes
REM
REM  HOW TO USE:
REM    1. Double-click this file
REM    2. When asked, paste the path to your frontend repo
REM    3. Wait. Done.
REM ════════════════════════════════════════════════════════════════════
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0EASY-PUSH-TO-GITHUB.ps1"
pause
