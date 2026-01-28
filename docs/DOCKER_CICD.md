# Docker & CI/CD Documentation

## Overview

This document provides comprehensive information about the containerization and CI/CD setup for the Co-Founder Matching Platform, following 2025/2026 Docker best practices.

## Docker Setup

### File Naming Convention

We follow the modern Docker Compose naming standard:
- **Current**: `compose.yaml` (preferred as of 2025/2026)
- **Legacy**: `docker-compose.yml` (deprecated but still supported)

### Dockerfiles

#### Backend Dockerfile (`backend/Dockerfile`)

**Features:**
- Multi-stage build for optimized image size
- Python 3.11 slim base image
- Non-root user (appuser) for security
- Layer caching optimization
- Health checks included
- Production-ready configuration

**Build:**
```bash
docker build -t cofounder-backend:latest ./backend
```

**Run:**
```bash
docker run -p 8000:8000 --env-file backend/.env cofounder-backend:latest
```

#### Frontend Dockerfile (`frontend/Dockerfile`)

**Features:**
- Multi-stage build (deps -> builder -> runner)
- Node 20 Alpine base image
- Standalone output mode for optimal size
- Non-root user (nextjs) for security
- Layer caching optimization
- Health checks included
- Production-ready configuration

**Build:**
```bash
docker build -t cofounder-frontend:latest ./frontend
```

**Run:**
```bash
docker run -p 3000:3000 --env-file frontend/.env.local cofounder-frontend:latest
```

### Docker Compose

The `compose.yaml` file orchestrates all services:

**Services:**
1. **postgres** - PostgreSQL 16 Alpine database
2. **backend** - FastAPI application
3. **frontend** - Next.js application

**Features:**
- Health checks for all services
- Service dependencies with health conditions
- Network isolation (cofounder_network)
- Volume persistence for database
- Restart policies
- Environment variable configuration

**Commands:**
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# View service status
docker compose ps
```

## CI/CD Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Pull requests to main/develop
- Pushes to main/develop

**Jobs:**

#### Backend Lint & Test
- Runs on Python 3.11
- Spins up PostgreSQL 16 service
- Executes:
  - Type checking with mypy
  - Linting with ruff
  - Tests with pytest
  - Coverage reporting to Codecov

#### Frontend Lint & Test
- Runs on Node.js 20
- Executes:
  - Type checking with tsc
  - Linting with ESLint
  - Tests with Jest
  - Coverage reporting to Codecov

#### Security Scan
- Trivy vulnerability scanning
- Results uploaded to GitHub Security tab
- Scans both filesystem and dependencies

### 2. Build Workflow (`.github/workflows/build.yml`)

**Triggers:**
- Pushes to main/develop
- Tagged releases (v*)
- Pull requests to main

**Jobs:**

#### Build Backend Image
- Uses Docker Buildx for multi-platform builds
- Builds for linux/amd64 and linux/arm64
- Pushes to GitHub Container Registry (ghcr.io)
- Implements BuildKit caching for faster builds
- Tags images with:
  - Branch name
  - PR number
  - Semantic version
  - Commit SHA
  - Latest (for default branch)
- Scans built images with Trivy
- Uploads security results to GitHub

#### Build Frontend Image
- Same features as backend
- Includes build-time environment variables
- Optimized for Next.js standalone output

**Image Tags:**
```
ghcr.io/username/cofounder-matching/backend:main
ghcr.io/username/cofounder-matching/backend:v1.0.0
ghcr.io/username/cofounder-matching/backend:main-abc1234
ghcr.io/username/cofounder-matching/backend:latest
```

### 3. Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Manual workflow dispatch (staging or production)
- Pushes to main (staging)
- Tagged releases (production)

**Environments:**
- **Staging**: Auto-deploys from main branch
- **Production**: Deploys from version tags (v*)

**Features:**
- Environment-specific configurations
- Smoke tests after deployment
- Deployment summaries
- Rollback notifications on failure
- Zero-downtime deployment ready

**Manual Deployment:**
```bash
# Via GitHub UI: Actions -> Deploy -> Run workflow
# Select environment: staging or production
```

## Security Best Practices

### Container Security

1. **Non-root Users**
   - Backend runs as `appuser` (UID 1000)
   - Frontend runs as `nextjs` (UID 1001)

2. **Minimal Base Images**
   - Python 3.11 slim (not full)
   - Node 20 Alpine (not full)
   - PostgreSQL 16 Alpine

3. **Layer Optimization**
   - Dependencies installed first (better caching)
   - Build artifacts copied separately
   - Multi-stage builds reduce final image size

4. **Vulnerability Scanning**
   - Trivy scans on every build
   - Results uploaded to GitHub Security
   - Blocks deployments with critical vulnerabilities

5. **Secret Management**
   - No secrets in Dockerfiles
   - Environment variables only
   - GitHub Secrets for CI/CD

### Image Optimization

**Expected Improvements:**
- Backend: ~300MB (vs ~800MB with ubuntu base)
- Frontend: ~150MB (vs ~1.2GB without multi-stage)
- Build time: 50% faster with caching

## GitHub Secrets Required

Configure these in: Repository Settings -> Secrets and Variables -> Actions

### Required Secrets:
```
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_API_URL
```

### Optional Secrets (for deployment):
```
SSH_PRIVATE_KEY
STAGING_HOST
PRODUCTION_HOST
KUBECONFIG
```

## Local Development

### Using Docker Compose

1. **Set up environment variables:**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Edit the .env files with your values
```

2. **Start services:**
```bash
docker compose up -d
```

3. **View logs:**
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

4. **Run migrations:**
```bash
docker compose exec backend alembic upgrade head
```

5. **Access services:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Database: localhost:5432

### Development with Hot Reload

For development with hot reload, use volume mounts (already configured in compose.yaml):

```bash
# Backend hot-reload is enabled via volume mounts
# Frontend hot-reload requires running locally (not in container)
cd frontend && npm run dev
```

## Production Deployment

### Prerequisites

1. **Container Registry Access**
   - GitHub Container Registry (ghcr.io) is pre-configured
   - Or configure Docker Hub / AWS ECR / GCP GCR

2. **Server Requirements**
   - Docker Engine 24.0+
   - Docker Compose 2.0+
   - Minimum 2GB RAM, 2 CPU cores
   - SSL certificates for HTTPS

### Deployment Steps

1. **Tag a release:**
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

2. **Build workflow runs automatically**
   - Builds and pushes images
   - Scans for vulnerabilities

3. **Deploy workflow triggers**
   - Pulls images to server
   - Updates services
   - Runs smoke tests

4. **Manual deployment (if needed):**
```bash
# SSH into server
ssh user@server

# Pull latest images
docker compose pull

# Restart services with zero downtime
docker compose up -d --no-deps --build backend
docker compose up -d --no-deps --build frontend
```

### Health Monitoring

**Endpoints:**
- Backend: `GET http://api.domain.com/health`
- Frontend: `GET http://domain.com/api/health` (create this endpoint)

**Metrics:**
- Prometheus metrics available at `/metrics` in production
- Integrate with Grafana for visualization

## Troubleshooting

### Common Issues

#### Build fails with "permission denied"
```bash
# Ensure Docker daemon is running
docker info

# Check file permissions
ls -la backend/Dockerfile
```

#### Container exits immediately
```bash
# Check logs
docker compose logs backend

# Verify environment variables
docker compose config
```

#### Database connection fails
```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Verify connection string
docker compose exec backend env | grep DATABASE_URL
```

#### Image size too large
```bash
# Analyze image layers
docker history cofounder-backend:latest

# Check .dockerignore is working
docker build --no-cache -t test ./backend
```

### Performance Optimization

1. **Enable BuildKit caching:**
```bash
export DOCKER_BUILDKIT=1
docker compose build
```

2. **Prune unused resources:**
```bash
docker system prune -a --volumes
```

3. **Monitor resource usage:**
```bash
docker stats
```

## References

- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [GitHub Actions for Docker](https://docs.docker.com/build/ci/github-actions/)
- [Docker Best Practices 2025](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Security](https://docs.docker.com/engine/security/)

## Changelog

### 2026-01-28 - Initial Setup
- Created multi-stage Dockerfiles for backend and frontend
- Renamed docker-compose.yml to compose.yaml
- Set up GitHub Actions CI/CD workflows
- Implemented security scanning with Trivy
- Configured multi-platform builds (amd64/arm64)
- Added health checks and monitoring
