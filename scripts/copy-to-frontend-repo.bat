@echo off
REM ═════════════════════════════════════════════════════════════════════
REM  619 Fitness Studio — One-click launcher for the copy script
REM  Just DOUBLE-CLICK this file. It runs the PowerShell script and
REM  bypasses any execution-policy block.
REM ═════════════════════════════════════════════════════════════════════
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-to-frontend-repo.ps1"
pause
