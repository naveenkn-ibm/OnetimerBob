@echo off
echo ========================================
echo   OneTimer Bob - Development Startup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

REM Check if backend directory exists
if not exist "backend" (
    echo [ERROR] Backend directory not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Check if frontend directory exists
if not exist "frontend" (
    echo [ERROR] Frontend directory not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

echo ========================================
echo   Step 1: Installing Dependencies
echo ========================================
echo.

REM Install backend dependencies
echo [INFO] Installing backend dependencies...
cd backend
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install backend dependencies!
        cd ..
        pause
        exit /b 1
    )
) else (
    echo [INFO] Backend dependencies already installed
)
cd ..

REM Install frontend dependencies
echo [INFO] Installing frontend dependencies...
cd frontend
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install frontend dependencies!
        cd ..
        pause
        exit /b 1
    )
) else (
    echo [INFO] Frontend dependencies already installed
)
cd ..

echo.
echo ========================================
echo   Step 2: Starting Servers
echo ========================================
echo.
echo [INFO] Starting backend server in new window...
echo [INFO] Starting frontend server in new window...
echo.
echo ========================================
echo   IMPORTANT INSTRUCTIONS
echo ========================================
echo.
echo 1. Two new terminal windows will open:
echo    - Backend Server (Port 3000)
echo    - Frontend Application (Port 5173)
echo.
echo 2. Wait for both servers to start completely
echo.
echo 3. Look for these messages:
echo    Backend:  "Server listening on port 3000"
echo    Frontend: "Local: http://localhost:5173/"
echo.
echo 4. Open your browser to:
echo    http://localhost:5173
echo.
echo 5. To stop servers:
echo    Press Ctrl+C in each terminal window
echo.
echo ========================================
echo.

REM Start backend in new window
start "OneTimer Bob - Backend Server" cmd /k "cd backend && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
start "OneTimer Bob - Frontend" cmd /k "cd frontend && npm run dev"

echo [SUCCESS] Servers are starting...
echo.
echo Check the new terminal windows for startup progress.
echo.
echo Press any key to close this window...
pause >nul

@REM Made with Bob
