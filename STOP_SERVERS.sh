#!/bin/bash

echo "=================================="
echo "Stopping all servers..."
echo "=================================="
echo ""

# Stop backend - try multiple methods to ensure it's killed
echo "Stopping backend server..."

# Method 1: Kill by PID file (if exists)
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "  Killing backend process (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
        sleep 1
        # Force kill if still running
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill -9 $BACKEND_PID 2>/dev/null
        fi
    fi
    rm -f logs/backend.pid
fi

# Method 2: Kill all uvicorn processes (in case PID file is stale)
echo "  Checking for other uvicorn processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "  [OK] Killed additional uvicorn processes" || true
sleep 1

# Stop frontend - try multiple methods
echo ""
echo "Stopping frontend server..."

# Method 1: Kill by PID file (if exists)
if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "  Killing frontend process (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
        sleep 1
        # Force kill if still running
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            kill -9 $FRONTEND_PID 2>/dev/null
        fi
    fi
    rm -f logs/frontend.pid
fi

# Method 2: Kill all node/npm processes on port 3000 (in case PID file is stale)
echo "  Checking for other Next.js processes..."
pkill -f "next-server" 2>/dev/null && echo "  [OK] Killed additional Next.js processes" || true
# Kill processes using port 3000
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null && echo "  [OK] Killed processes on port 3000" || true
sleep 1

# Clear Python cache to ensure fresh imports on next start
echo ""
echo "Clearing Python cache..."
cd backend 2>/dev/null && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null && find . -name "*.pyc" -delete 2>/dev/null && cd .. && echo "  [OK] Python cache cleared" || echo "  [WARNING] Could not clear cache (backend directory may not exist)"

# Stop PostgreSQL
echo ""
echo "Stopping PostgreSQL..."
docker compose down 2>/dev/null && echo "  [OK] PostgreSQL stopped" || echo "  [WARNING] PostgreSQL may not be running"

echo ""
echo "=================================="
echo "[OK] All servers stopped!"
echo "=================================="
