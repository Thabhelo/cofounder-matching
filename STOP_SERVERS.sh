#!/bin/bash

# ==========================================
# Helper: Kill process on specific port
# ==========================================
kill_port() {
  local port=$1
  local name=$2

  if lsof -ti:$port > /dev/null 2>&1; then
    echo "  $name found on port $port. Killing..."
    # Try graceful kill first
    lsof -ti:$port | xargs kill -15 2>/dev/null
    sleep 1
    # Force kill if still there
    if lsof -ti:$port > /dev/null 2>&1; then
       echo "  $name stubborn. Force killing..."
       lsof -ti:$port | xargs kill -9 2>/dev/null
    fi
    echo "  [OK] Port $port freed."
  else
    echo "  [OK] Port $port is already free."
  fi
}

echo "=================================="
echo "Stopping Development Environment"
echo "=================================="
echo ""

# 1. Stop Backend (Port 8000)
echo "Stopping Backend..."
kill_port 8000 "Backend"

# Cleanup specific uvicorn workers just in case
pkill -f "uvicorn app.main:app" 2>/dev/null

# 2. Stop Frontend (Port 3000)
echo ""
echo "Stopping Frontend..."
kill_port 3000 "Frontend"

# Cleanup generic next-server instances if safe
# (Only do this if you don't have other Next.js apps running!)
pkill -f "next-server" 2>/dev/null

# 3. Housekeeping
echo ""
echo "Cleaning up..."
rm -f logs/*.pid 2>/dev/null

# Clear Python Cache (prevents import errors on restart)
if [ -d "backend" ]; then
    echo "  Clearing Python cache..."
    find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
    find backend -name "*.pyc" -delete 2>/dev/null
fi

# 4. Stop Docker (Preserve data/networks for faster restart)
echo ""
echo "Stopping Database..."
# 'stop' pauses containers (fast). 'down' destroys them (slow).
docker compose stop 2>/dev/null || echo "  [WARNING] Docker not running or compose file missing."

echo ""
echo "=================================="
echo "[OK] Environment Shutdown Complete"
echo "=================================="
