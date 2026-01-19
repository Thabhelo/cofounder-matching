# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migrations
```bash
cd backend
# Generate initial migration (only needed once)
alembic revision --autogenerate -m "Initial schema"
# Apply migrations
alembic upgrade head
```

### 2. Environment Variables

**Required Variables:**
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Clerk Authentication  
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_FRONTEND_API=https://your-domain.clerk.accounts.dev

# Application
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

### 3. Dependencies
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend  
cd frontend
npm install
```

### 4. Security Checklist
- [ ] All secrets in environment variables (no hardcoded values)
- [ ] CORS_ORIGINS set to specific domains (not wildcards)
- [ ] ENVIRONMENT set to "production"
- [ ] Database uses strong password
- [ ] HTTPS enabled (handled by hosting platform)
- [ ] Rate limiting configured (100/minute default)

### 5. Production Features Enabled
- [ ] Structured logging
- [ ] Request ID tracking (X-Request-ID header)
- [ ] Global exception handlers (no stack trace leakage)
- [ ] Database health checks (/health endpoint)
- [ ] Prometheus metrics (/metrics endpoint)
- [ ] Rate limiting (SlowAPI)
- [ ] API docs disabled in production
- [ ] Transaction rollback handling

## Deployment Steps

### Backend (Render/Fly.io/Railway)

1. **Set Environment Variables** in platform dashboard
2. **Run Migrations**:
   ```bash
   alembic upgrade head
   ```
3. **Start Server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

### Frontend (Vercel)

1. **Set Environment Variables**:
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY
   - NEXT_PUBLIC_API_URL
   - NEXT_PUBLIC_CLERK_SIGN_IN_URL
   - NEXT_PUBLIC_CLERK_SIGN_UP_URL
   - NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
   - NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL

2. **Deploy**:
   ```bash
   npm run build
   vercel deploy --prod
   ```

## Monitoring

### Health Check
```bash
curl https://your-api-domain.com/health
# Returns: {"status":"healthy","environment":"production","database":"connected"}
```

### Metrics (Production Only)
```bash
curl https://your-api-domain.com/metrics
# Returns Prometheus-format metrics
```

### Logs
- All requests logged with request ID
- Format: `[request_id] METHOD /path`
- Errors logged with stack traces (not exposed to clients)

## Rate Limiting

Default limits:
- 100 requests/minute per IP
- Configurable in `app/main.py`

Rate limit headers in response:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Database Migrations

**Create New Migration:**
```bash
alembic revision --autogenerate -m "description"
```

**Apply Migrations:**
```bash
alembic upgrade head
```

**Rollback:**
```bash
alembic downgrade -1
```

## Troubleshooting

### Database Connection Issues
Check health endpoint:
```bash
curl https://your-api-domain.com/health
```
If database shows "disconnected", verify:
- DATABASE_URL is correct
- Database is running
- Network connectivity

### Authentication Issues
Verify:
- CLERK_FRONTEND_API is correct
- CLERK_SECRET_KEY is production key (not test)
- JWT tokens from Clerk match your instance

### Rate Limit Issues
If legitimate traffic is being rate limited:
- Increase limits in `app/main.py`
- Consider IP whitelisting for known services
- Use authentication-based rate limiting

## Performance Optimization

1. **Database Connection Pooling**
   - Configured in `app/database.py`
   - Default: 5 connections min, 20 max

2. **JWKS Caching**
   - Cached with @lru_cache
   - Only fetched once per deployment

3. **Metrics Collection**
   - Prometheus metrics for monitoring
   - Track request duration, error rates

## Security

### Headers Added Automatically:
- `X-Request-ID`: Request tracing
- `X-RateLimit-*`: Rate limit info

### Error Responses:
- Generic messages (no internal details)
- Stack traces only in logs (not responses)
- Request ID included for debugging

### CORS:
- Only specified origins allowed
- No wildcard support
- Credentials enabled for authenticated requests

## Rollback Plan

If deployment fails:

1. **Revert Code:**
   ```bash
   git revert HEAD
   git push
   ```

2. **Rollback Database:**
   ```bash
   alembic downgrade -1
   ```

3. **Check Logs:**
   - Review application logs
   - Check database connection
   - Verify environment variables

## Post-Deployment

1. **Smoke Test:**
   - Check /health endpoint
   - Test user onboarding flow
   - Verify RSVP functionality
   - Test authentication

2. **Monitor:**
   - Watch error rates in metrics
   - Check response times
   - Monitor rate limit hits

3. **Database Backup:**
   - Ensure automated backups enabled
   - Test restore procedure
