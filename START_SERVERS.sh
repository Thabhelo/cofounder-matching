#!/bin/bash

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
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Start PostgreSQL
echo -e "${GREEN}Starting PostgreSQL...${NC}"
docker compose up -d postgres
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start PostgreSQL${NC}"
    exit 1
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

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
    echo -e "${YELLOW}⚠️  WARNING: Backend .env has placeholder Clerk keys${NC}"
    echo "You need to add real Clerk keys to backend/.env"
    echo "Get them from: https://dashboard.clerk.com"
    echo ""
fi

# Run migrations
echo "Running database migrations..."
alembic upgrade head
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Database migrations not generated yet${NC}"
    echo "Generating initial migration..."
    alembic revision --autogenerate -m "Initial schema"
    alembic upgrade head
fi

# Start backend server in background
echo "Starting backend server on http://localhost:8000..."
uvicorn app.main:app --reload --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

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
    echo -e "${YELLOW}⚠️  WARNING: Frontend .env.local has placeholder Clerk keys${NC}"
    echo "You need to add real Clerk keys to frontend/.env.local"
    echo ""
fi

# Start frontend server in background
echo "Starting frontend server on http://localhost:3000..."
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

cd ..

echo ""
echo "=================================="
echo -e "${GREEN}✓ All servers started successfully!${NC}"
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
