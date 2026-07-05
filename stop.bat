@echo off
title InvoiceFlow - Stopping Servers
cd /d "%~dp0"

echo ============================================
echo   Stopping InvoiceFlow Servers...
echo ============================================
echo.

:: Kill processes on common API ports
for %%p in (8000 8001 8002 8003 8004 8005) do (
    for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr /c:":%%p " ^| findstr "LISTENING" 2^>nul') do (
        taskkill /F /PID %%a >nul 2>&1 && echo [OK] Killed process on port %%p (PID: %%a)
    )
)

:: Kill processes on common frontend ports
for %%p in (3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010) do (
    for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr /c:":%%p " ^| findstr "LISTENING" 2^>nul') do (
        taskkill /F /PID %%a >nul 2>&1 && echo [OK] Killed process on port %%p (PID: %%a)
    )
)

echo.
echo [OK] All InvoiceFlow servers stopped.
echo.

:: Close the API window if still open
taskkill /FI "WINDOWTITLE eq InvoiceFlow API" /F >nul 2>&1

timeout /t 2 /nobreak >nul
