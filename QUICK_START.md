# Quick Start Guide

## Prerequisites Check

### 1. Docker (Required for Database)
```bash
docker --version
```
If not installed: https://www.docker.com/products/docker-desktop

### 2. Python 3.10+ (Required for Backend)
```bash
python3 --version
```

### 3. Node.js 18+ (Required for Frontend)
```bash
node --version
```

## Setup Steps

### Step 1: Get Clerk API Keys

1. Go to https://clerk.com and create an account
2. Create a new application
3. Go to "API Keys" in the dashboard
4. Copy your keys:
   - Publishable Key (starts with `pk_test_...`)
   - Secret Key (starts with `sk_test_...`)
   - Frontend API URL (under "Advanced" → shows your instance URL)

### Step 2: Configure Environment Variables

**Backend (`backend/.env`):**
```bash
# Already created, just update these lines:
CLERK_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_HERE
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
CLERK_FRONTEND_API=https://YOUR_CLERK_INSTANCE.clerk.accounts.dev
```

**Frontend (`frontend/.env.local`):**
```bash
# Already created, just update these lines:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_HERE
```

### Step 3: Configure Clerk Redirect URLs

In your Clerk dashboard:
1. Go to "Paths" or "URLs" section
2. Add these redirect URLs:
   - `http://localhost:3000/onboarding`
   - `http://localhost:3000/dashboard`

### Step 4: Start All Servers

**Option A: Automated (if Docker is installed)**
```bash
./START_SERVERS.sh
```

**Option B: Manual Start**

**Terminal 1 - PostgreSQL:**
```bash
docker compose up postgres
# Or if Docker Compose v2: docker compose up postgres
```

**Terminal 2 - Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Generate and run migrations
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (development only)
- **Health Check**: http://localhost:8000/health

## Testing the Application

1. **Visit** http://localhost:3000
2. **Click** "Get Started" or "Sign Up"
3. **Complete** Clerk authentication
4. **Fill out** 4-step onboarding form
5. **Explore** dashboard, resources, events, organizations

## Stopping Servers

**Option A: Automated**
```bash
./STOP_SERVERS.sh
```

**Option B: Manual**
- Press `Ctrl+C` in each terminal
- Stop Docker: `docker compose down`

## Troubleshooting

### Database Connection Errors
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
psql postgresql://user:password@localhost:5432/cofounder_matching
```

### Authentication Errors
- Verify Clerk keys are correct in both .env files
- Check CLERK_FRONTEND_API matches your Clerk dashboard
- Ensure redirect URLs are configured in Clerk dashboard

### Port Already in Use
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Migration Errors
```bash
cd backend
source venv/bin/activate

# Reset and regenerate
alembic downgrade base
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

### Node Modules Issues
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## What to Test

### 1. Authentication Flow
- [ ] Sign up with Clerk
- [ ] Complete onboarding
- [ ] View profile
- [ ] Update profile

### 2. Resources
- [ ] View resource list
- [ ] Filter resources
- [ ] View resource details

### 3. Events
- [ ] View events list
- [ ] RSVP to event (going/maybe/not_going)
- [ ] Change RSVP status
- [ ] View event capacity

### 4. Organizations
- [ ] View organizations
- [ ] Filter by type
- [ ] View organization details

### 5. API Features
- [ ] Health check returns database status
- [ ] Rate limiting (try > 100 requests/minute)
- [ ] Request ID in response headers

## Next Steps

Once everything works locally:
1. Review `PRODUCTION.md` for deployment guide
2. Run tests: `pytest` (backend) and `npm test` (frontend)
3. Check test coverage
4. Deploy to production

## Common Issues

**"ModuleNotFoundError" in Backend**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**"Module not found" in Frontend**
```bash
cd frontend
npm install
```

**"Clerk is not configured"**
- Add real Clerk keys (not placeholders)
- Restart servers after adding keys

**"Database does not exist"**
```bash
docker compose down
docker compose up -d postgres
# Wait 10 seconds for DB to initialize
cd backend && alembic upgrade head
```

## Support

- Backend logs: `tail -f logs/backend.log`
- Frontend logs: `tail -f logs/frontend.log`
- Database logs: `docker logs cofounder_matching_db`
