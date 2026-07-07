@echo off
title InvoiceFlow - Start Servers
cd /d "%~dp0"

echo ============================================
echo   Checking System Dependencies...
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python.
    pause
    exit /b 1
)

:: Check and setup Python virtual environment
if not exist ".venv" (
    echo [..] Creating Python virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

:: Install Python dependencies if sentinel file is missing
if not exist ".venv\installed.sentinel" (
    echo [..] Installing Python dependencies...
    .venv\Scripts\pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Python dependencies.
        pause
        exit /b 1
    )
    echo. > .venv\installed.sentinel
    echo [OK] Python dependencies installed.
)

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)

:: Install Node.js dependencies if node_modules is missing
if not exist "node_modules" (
    echo [..] Installing Node.js dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Node.js dependencies.
        pause
        exit /b 1
    )
    echo [OK] Node.js dependencies installed.
)

echo.
echo ============================================
echo   Starting InvoiceFlow Servers...
echo ============================================
echo.

:: Start FastAPI Backend on Port 8000 using virtualenv Python
echo [..] Launching FastAPI backend on http://localhost:8000
start "InvoiceFlow API" cmd /c ".venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

:: Start Node.js Proxy on Port 3000
set PORT=3000
set API_BASE_URL=http://127.0.0.1:8000
echo [..] Launching Frontend Express server on http://localhost:3000
start "InvoiceFlow Web" cmd /c "node server.js"

:: Wait for both servers to spin up
ping -n 4 127.0.0.1 >nul

:: Open browser
start http://localhost:3000
