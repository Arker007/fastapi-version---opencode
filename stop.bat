@echo off
title InvoiceFlow - Stop Servers
cd /d "%~dp0"

echo ============================================
echo   Stopping InvoiceFlow Servers...
echo ============================================
echo.

:: Kill FastAPI Backend on Port 8000
for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr :8000 ^| findstr "LISTENING" 2^>nul') do (
    powershell -Command "Stop-Process -Id %%a -Force" >nul 2>&1 && echo [OK] Stopped Backend process on port 8000 (PID: %%a)
)

:: Kill Node.js Frontend on Port 3000
for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr :3000 ^| findstr "LISTENING" 2^>nul') do (
    powershell -Command "Stop-Process -Id %%a -Force" >nul 2>&1 && echo [OK] Stopped Frontend process on port 3000 (PID: %%a)
)



echo.
echo [OK] All InvoiceFlow servers stopped.
ping -n 3 127.0.0.1 >nul
