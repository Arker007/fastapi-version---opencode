@echo off
title InvoiceFlow - Billing & Inventory System
cd /d "%~dp0"

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    pause
    exit /b 1
)

:: Install Python dependencies if missing
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo [..] Installing Python dependencies...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Python dependencies
        pause
        exit /b 1
    )
    echo [OK] Python dependencies installed
)

:: Install Node.js dependencies if missing
if not exist "node_modules\express" (
    echo [..] Installing Node.js dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Node.js dependencies
        pause
        exit /b 1
    )
    echo [OK] Node.js dependencies installed
)

:: Find free ports
for /f "tokens=1,2" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0find-ports.ps1"') do (
    set API_PORT=%%a
    set FRONTEND_PORT=%%b
)

echo.
echo ============================================
echo   InvoiceFlow Starting...
echo ============================================
echo.
echo   API Port      : %API_PORT%
echo   Frontend Port : %FRONTEND_PORT%
echo.

:: Start FastAPI backend in a new window
start "InvoiceFlow API" cmd /c "python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port %API_PORT%"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Node.js proxy with environment overrides
echo [..] Starting frontend server...
echo.
echo   Frontend : http://localhost:%FRONTEND_PORT%
echo   API      : http://localhost:%API_PORT%
echo   Docs     : http://localhost:%API_PORT%/docs
echo.
echo   Default Login: admin / admin123
echo.
echo ============================================
echo   Press Ctrl+C in this window to stop
echo ============================================
echo.

:: Open browser after a short delay
timeout /t 2 /nobreak >nul
start http://localhost:%FRONTEND_PORT%

set PORT=%FRONTEND_PORT%
set API_BASE_URL=http://127.0.0.1:%API_PORT%
node server.js
