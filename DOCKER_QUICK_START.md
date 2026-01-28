# Docker Quick Start Guide

## What Changed

Your project now has production-grade Docker containerization and CI/CD pipelines following 2025/2026 best practices.

### Files Created/Modified

**Created:**
- `compose.yaml` - Modern Docker Compose file (renamed from docker-compose.yml)
- `backend/Dockerfile` - Multi-stage production-ready backend image
- `backend/.dockerignore` - Optimizes backend build context
- `frontend/Dockerfile` - Multi-stage production-ready frontend image
- `frontend/.dockerignore` - Optimizes frontend build context
- `.github/workflows/ci.yml` - Automated testing and linting
- `.github/workflows/build.yml` - Docker image building and security scanning
- `.github/workflows/deploy.yml` - Automated deployment pipeline
- `docs/DOCKER_CICD.md` - Comprehensive documentation

**Modified:**
- `frontend/next.config.js` - Added standalone output mode for Docker

## Quick Start

### 1. Local Development with Docker

```bash
# Start all services (PostgreSQL, backend, frontend)
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### 2. Build Images Locally

```bash
# Build backend
docker build -t cofounder-backend:latest ./backend

# Build frontend
docker build -t cofounder-frontend:latest ./frontend
```

### 3. Test the Setup

```bash
# Check all services are running
docker compose ps

# Test backend health
curl http://localhost:8000/health

# Test frontend
curl http://localhost:3000

# Run backend migrations
docker compose exec backend alembic upgrade head
```

## Key Features

### Docker Images

**Backend:**
- Base: Python 3.11 slim
- Size: ~300MB (optimized)
- Security: Non-root user
- Health checks: Included

**Frontend:**
- Base: Node 20 Alpine
- Size: ~150MB (optimized)
- Security: Non-root user
- Health checks: Included

### CI/CD Workflows

**On Pull Request:**
1. Run tests and linting
2. Type checking
3. Security vulnerability scanning
4. Code coverage reporting

**On Push to Main:**
1. Build Docker images
2. Push to GitHub Container Registry
3. Scan images for vulnerabilities
4. Deploy to staging (automatic)

**On Tag (v*):**
1. Deploy to production
2. Run smoke tests
3. Create deployment tags

## GitHub Secrets Setup

Before CI/CD works, add these secrets in GitHub:

**Settings -> Secrets and Variables -> Actions -> New repository secret**

Required secrets:
```
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Next Steps

1. **Test locally:**
   ```bash
   docker compose up -d
   docker compose logs -f
   ```

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: add Docker containerization and CI/CD pipelines"
   git push
   ```

3. **Configure GitHub Secrets** (see above)

4. **Create a pull request** - Watch CI run automatically

5. **Deploy to production:**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker compose logs

# Rebuild images
docker compose build --no-cache
docker compose up -d
```

### Permission errors
```bash
# Ensure environment files exist
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### Database connection fails
```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Restart PostgreSQL
docker compose restart postgres
```

## Documentation

For detailed information, see:
- `docs/DOCKER_CICD.md` - Complete Docker and CI/CD documentation
- `docs/DOCUMENTATION.md` - Project documentation
- `QUICK_START.md` - Development setup guide

## Questions?

If you encounter issues:
1. Check `docs/DOCKER_CICD.md` for troubleshooting
2. View logs: `docker compose logs -f [service]`
3. Check GitHub Actions logs for CI/CD issues
