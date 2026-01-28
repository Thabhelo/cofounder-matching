#!/bin/bash

echo "Stopping all servers..."

# Stop backend
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✓ Backend stopped"
    fi
    rm logs/backend.pid
fi

# Stop frontend
if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        echo "✓ Frontend stopped"
    fi
    rm logs/frontend.pid
fi

# Stop PostgreSQL
echo "Stopping PostgreSQL..."
docker compose down

echo ""
echo "All servers stopped!"
