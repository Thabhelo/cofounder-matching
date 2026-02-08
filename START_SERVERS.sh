#!/bin/bash

# ==========================================
# Helper Function: Wait for a port to open
# ==========================================
wait_for_port() {
  local port=$1
  local name=$2
  local retries=30
  echo -n "Waiting for $name to be ready on port $port..."
  while ! nc -z localhost $port 2>/dev/null; do
    sleep 1
    retries=$((retries - 1))
    if [ $retries -eq 0 ]; then
      echo -e "\n${RED}[ERROR] Timed out waiting for $name${NC}"
      exit 1
    fi
    echo -n "."
  done
  echo -e " ${GREEN}Done!${NC}"
}

echo "=================================="
echo "Co-Founder Matching Platform Setup"
echo "=================================="
echo ""

# Create logs directory first
mkdir -p logs

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed${NC}"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Start PostgreSQL
echo -e "${GREEN}Starting PostgreSQL...${NC}"
docker compose up -d postgres
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to start PostgreSQL${NC}"
    exit 1
fi

wait_for_port 5432 "PostgreSQL"

# Backend setup
echo ""
echo -e "${GREEN}Setting up Backend...${NC}"
cd backend

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate venv and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if .env has Clerk keys
if grep -q "your_secret_key_here" .env 2>/dev/null; then
    echo -e "${YELLOW}[WARNING] Backend .env has placeholder Clerk keys${NC}"
    echo "You need to add real Clerk keys to backend/.env"
    echo "Get them from: https://dashboard.clerk.com"
    echo ""
fi

# Run migrations
echo "Running database migrations..."
alembic upgrade head
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Database migration failed${NC}"
    echo ""
    echo "Common fixes:"
    echo "  1. If this is a fresh database, generate initial migration:"
    echo "     cd backend && alembic revision --autogenerate -m 'Initial schema'"
    echo "  2. If you switched branches, check out the correct migrations"
    echo "  3. Check logs/backend.log for details"
    echo ""
    exit 1
fi

# Clear Python cache before starting (ensures fresh imports)
echo "Clearing Python cache..."
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find . -name "*.pyc" -delete 2>/dev/null
find . -name "*.pyo" -delete 2>/dev/null

# Check if backend is already running on port 8000
if lsof -ti:8000 > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING] Port 8000 is already in use. Killing existing process...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Start backend server in background
echo "Starting backend server on http://localhost:8000..."
uvicorn app.main:app --reload --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2  # Give server time to start
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}[OK] Backend started (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}[ERROR] Backend failed to start. Check logs/backend.log${NC}"
fi

# Wait for backend to actually be up before starting frontend
wait_for_port 8000 "Backend API"

cd ..

# Frontend setup
echo ""
echo -e "${GREEN}Setting up Frontend...${NC}"
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies (this may take a minute)..."
    npm install --silent
fi

# Check if .env.local has Clerk keys
if grep -q "your_publishable_key_here" .env.local 2>/dev/null; then
    echo -e "${YELLOW}[WARNING] Frontend .env.local has placeholder Clerk keys${NC}"
    echo "You need to add real Clerk keys to frontend/.env.local"
    echo ""
fi

# Check if frontend is already running on port 3000
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING] Port 3000 is already in use. Killing existing process...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Start frontend server in background
echo "Starting frontend server on http://localhost:3000..."
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 2  # Give server time to start
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}[OK] Frontend started (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}[ERROR] Frontend failed to start. Check logs/frontend.log${NC}"
fi

cd ..

echo ""
echo "=================================="
echo -e "${GREEN}[OK] All servers started successfully!${NC}"
echo "=================================="
echo ""
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo "Frontend: http://localhost:3000"
echo ""
echo "Logs:"
echo "  Backend:  tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"
echo ""
echo "To stop all servers:"
echo "  ./STOP_SERVERS.sh"
echo ""
echo "Process IDs:"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""

# Save PIDs for stop script
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo -e "${YELLOW}Note: If authentication fails, make sure you have:${NC}"
echo "1. Created a Clerk account at https://clerk.com"
echo "2. Added your Clerk keys to both .env files"
echo "3. Configured Clerk redirect URLs in the dashboard"
