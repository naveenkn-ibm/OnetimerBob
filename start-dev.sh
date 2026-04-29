#!/bin/bash

echo "========================================"
echo "  OneTimer Bob - Development Startup"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[INFO] Node.js version:"
node --version
echo ""

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "[ERROR] Backend directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "[ERROR] Frontend directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "========================================"
echo "  Step 1: Installing Dependencies"
echo "========================================"
echo ""

# Install backend dependencies
echo "[INFO] Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install backend dependencies!"
        cd ..
        exit 1
    fi
else
    echo "[INFO] Backend dependencies already installed"
fi
cd ..

# Install frontend dependencies
echo "[INFO] Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install frontend dependencies!"
        cd ..
        exit 1
    fi
else
    echo "[INFO] Frontend dependencies already installed"
fi
cd ..

echo ""
echo "========================================"
echo "  Step 2: Starting Servers"
echo "========================================"
echo ""
echo "[INFO] Starting backend server..."
echo "[INFO] Starting frontend server..."
echo ""
echo "========================================"
echo "  IMPORTANT INSTRUCTIONS"
echo "========================================"
echo ""
echo "1. Two servers will start:"
echo "   - Backend Server (Port 3000)"
echo "   - Frontend Application (Port 5173)"
echo ""
echo "2. Wait for both servers to start completely"
echo ""
echo "3. Look for these messages:"
echo "   Backend:  'Server listening on port 3000'"
echo "   Frontend: 'Local: http://localhost:5173/'"
echo ""
echo "4. Open your browser to:"
echo "   http://localhost:5173"
echo ""
echo "5. To stop servers:"
echo "   Press Ctrl+C in this terminal"
echo ""
echo "========================================"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "[INFO] Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start backend in background
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "[SUCCESS] Servers are starting..."
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

# Made with Bob
