from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response, HTMLResponse
from fastapi.exceptions import RequestValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
import logging
import uuid
from contextlib import asynccontextmanager

from app.config import settings
from app.api.v1 import api_router
from app.api import webhooks as webhooks_router
from app.database import SessionLocal
from app.logging_config import setup_logging, log_request_metrics, get_logger_with_request_id
from app.sentry_config import setup_sentry

# Setup enhanced structured logging with PII scrubbing
setup_logging()

# Setup Sentry error tracking
setup_sentry()

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for startup and shutdown"""
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode")
    
    # Validate critical configuration at startup
    try:
        # Validate JWKS URL configuration early to fail fast
        jwks_url = settings.get_clerk_jwks_url()
        logger.info(f"Clerk JWKS URL configured: {jwks_url}")
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        raise RuntimeError(f"Invalid configuration: {str(e)}") from e

    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from app.tasks.scheduler import run_incomplete_profile_reminders, run_event_reminders

    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_incomplete_profile_reminders, CronTrigger(day_of_week="mon", hour=9))
    scheduler.add_job(run_event_reminders, CronTrigger(hour=8))
    scheduler.start()
    logger.info("APScheduler started")

    yield

    scheduler.shutdown()
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


API_DESCRIPTION = """
## Co-Founder Matching Platform API

Connect entrepreneurs and build founding teams. This API powers the CoFounder Match platform —
a curated network for early-stage founders to discover co-founders, join communities,
attend events, and access startup resources.

### Authentication

All protected endpoints require a **Clerk JWT** passed as a Bearer token:

```
Authorization: Bearer <clerk_session_token>
```

Tokens are obtained via the [Clerk](https://clerk.com) frontend SDK after the user signs in.
The API verifies token signatures using Clerk's JWKS endpoint derived from `CLERK_FRONTEND_API`.

### Rate Limits

| Resource | Limit |
|----------|-------|
| Global (per IP) | 100 requests / minute |
| Intro requests | 20 / week |
| Direct invites | 20 / week |
| Messages | 50 / day |

### Response Format

All endpoints return JSON. Errors follow this structure:

```json
{
  "detail": "Human-readable error message",
  "request_id": "uuid-for-tracing"
}
```

### Versioning

The current stable version is **v1**. All endpoints are prefixed with `/api/v1`.

### Support

- **Issues**: [GitHub Issues](https://github.com/thabhelo/cofounder-matching/issues)
- **API Reference**: `/developer`
"""

# Initialize FastAPI app
app = FastAPI(
    title="CoFounder Match API",
    description=API_DESCRIPTION,
    version="1.0.0",
    contact={
        "name": "CoFounder Match Team",
        "url": "https://cofounder-matching-git-main-thabhelos-projects.vercel.app/",
        "email": "slings.roofs_1y@icloud.com",
    },
    license_info={
        "name": "Proprietary",
    },
    openapi_tags=[
        {
            "name": "users",
            "description": "User accounts, profiles, settings, and GDPR data operations (export / delete).",
        },
        {
            "name": "profiles",
            "description": "Discover, save, skip, and manage co-founder profiles.",
        },
        {
            "name": "matches",
            "description": "Send invitations, manage match status, request introductions, and view recommendations.",
        },
        {
            "name": "messages",
            "description": "Send and receive messages between matched co-founders.",
        },
        {
            "name": "events",
            "description": "Networking events: create, search, RSVP, and manage.",
        },
        {
            "name": "organizations",
            "description": "Organizations (accelerators, incubators, communities): create, search, and manage.",
        },
        {
            "name": "resources",
            "description": "Curated startup resources: articles, tools, templates, funding guides.",
        },
        {
            "name": "reports",
            "description": "Report inappropriate users for moderation review.",
        },
        {
            "name": "admin",
            "description": "Platform administration: user moderation, analytics, broadcast emails, feature flags.",
        },
        {
            "name": "webhooks",
            "description": "Inbound webhooks from Clerk (user lifecycle events). Payloads are signature-verified.",
        },
    ],
    # Disable interactive docs UI in production; JSON schema is always available at /openapi.json
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# Add request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request for tracing"""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# Add enhanced logging middleware with performance metrics
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with structured data and performance metrics"""
    import time

    request_id = getattr(request.state, "request_id", "unknown")
    start_time = time.time()

    # Get user ID from request if available (after auth)
    user_id = None
    try:
        # This would be set by auth middleware if present
        user_id = getattr(request.state, "user_id", None)
    except AttributeError:
        pass

    # Create logger with request context
    request_logger = get_logger_with_request_id("app.requests", request_id)

    try:
        # Log request start
        request_logger.info("Request started", extra={
            "event_type": "request_start",
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params) if request.query_params else None,
            "user_agent": request.headers.get("user-agent"),
            "client_ip": request.client.host if request.client else None,
            "user_id": user_id
        })

        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        # Log structured request metrics
        log_request_metrics(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            request_id=request_id,
            user_id=user_id
        )

        return response

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000

        # Log error with context
        request_logger.error("Request failed", extra={
            "event_type": "request_error",
            "method": request.method,
            "path": request.url.path,
            "duration_ms": duration_ms,
            "error": str(e),
            "error_type": type(e).__name__,
            "user_id": user_id
        }, exc_info=True)

        # Also log to metrics
        log_request_metrics(
            method=request.method,
            path=request.url.path,
            status_code=500,
            duration_ms=duration_ms,
            request_id=request_id,
            user_id=user_id,
            error=str(e)
        )

        raise

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response

MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": "Request body too large"},
        )
    return await call_next(request)

# Global exception handler - prevents information leakage and captures to Sentry
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with Sentry integration"""
    import sentry_sdk
    from app.sentry_config import capture_custom_error

    request_id = getattr(request.state, "request_id", "unknown")
    user_id = getattr(request.state, "user_id", None)

    # Capture to Sentry with context
    try:
        capture_custom_error(
            error=exc,
            context={
                "request": {
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": str(request.query_params),
                    "headers": dict(request.headers),
                    "request_id": request_id,
                }
            },
            user_id=user_id,
            extra={
                "request_id": request_id,
                "environment": settings.ENVIRONMENT,
            }
        )
    except Exception as sentry_error:
        # If Sentry capture fails, log it but don't crash
        logger.error(f"Failed to capture exception to Sentry: {sentry_error}")

    # Log locally
    logger.error(f"[{request_id}] Unhandled exception: {str(exc)}", extra={
        "request_id": request_id,
        "user_id": user_id,
        "method": request.method,
        "path": request.url.path,
        "error_type": type(exc).__name__,
    }, exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred",
            "request_id": request_id
        }
    )

# Validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(f"[{request_id}] Validation error: {exc.errors()}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "request_id": request_id
        }
    )

# Rate limit exceeded handler (wrapped for FastAPI/mypy exception handler signature)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
    return _rate_limit_exceeded_handler(request, exc)

# Parse CORS origins from comma-separated string
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

# Add Prometheus metrics
if settings.ENVIRONMENT == "production":
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
# Clerk webhooks (no auth; Clerk signs payloads)
app.include_router(webhooks_router.router, prefix="/webhooks", tags=["webhooks"])


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Co-Founder Matching Platform API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "disabled"
    }


@app.get("/health")
async def health_check():
    """Comprehensive health check including database connectivity and pool status"""
    from app.database import check_database_connection, get_database_stats

    health_status = {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "database": "unknown"
    }

    # Check database connectivity with enhanced pool information
    try:
        is_healthy, pool_info = await check_database_connection()

        if is_healthy:
            health_status["database"] = "connected"
            health_status["database_pool"] = pool_info
        else:
            health_status["status"] = "unhealthy"
            health_status["database"] = "disconnected"
            health_status["database_pool"] = pool_info
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=health_status
            )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        health_status["status"] = "unhealthy"
        health_status["database"] = "error"
        health_status["error"] = str(e)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )

    return health_status


@app.get("/developer", response_class=HTMLResponse, include_in_schema=False)
async def developer_portal():
    """Serve the interactive API developer portal (Redoc)."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CoFounder Match — Developer Portal</title>
  <meta name="description" content="CoFounder Match API Reference — explore all endpoints, authentication, and schemas." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --brand: #6366f1;
      --brand-dark: #4f46e5;
      --bg: #0f0f10;
      --surface: #18181b;
      --border: #27272a;
      --text: #fafafa;
      --muted: #a1a1aa;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); }

    /* ── Top nav ── */
    .topnav {
      position: sticky; top: 0; z-index: 1000;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem; height: 60px;
    }
    .topnav-brand {
      display: flex; align-items: center; gap: 10px;
      font-weight: 700; font-size: 1rem; color: var(--text); text-decoration: none;
    }
    .topnav-brand .badge {
      background: var(--brand); color: #fff;
      font-size: 0.65rem; font-weight: 600; letter-spacing: .04em;
      padding: 2px 7px; border-radius: 99px;
    }
    .topnav-links { display: flex; gap: 1.5rem; }
    .topnav-links a {
      color: var(--muted); text-decoration: none; font-size: 0.875rem;
      transition: color .15s;
    }
    .topnav-links a:hover { color: var(--text); }

    /* ── Hero ── */
    .hero {
      max-width: 860px; margin: 0 auto;
      padding: 3.5rem 2rem 2rem;
    }
    .hero h1 { font-size: 2rem; font-weight: 700; line-height: 1.2; }
    .hero h1 span { color: var(--brand); }
    .hero p { margin-top: .75rem; color: var(--muted); font-size: 1rem; line-height: 1.6; max-width: 600px; }
    .hero-chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1.5rem; }
    .chip {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 99px; padding: 4px 14px; font-size: .78rem;
      color: var(--muted);
    }
    .chip strong { color: var(--text); }

    /* ── Quick-start cards ── */
    .cards-section { max-width: 860px; margin: 0 auto; padding: 0 2rem 2.5rem; }
    .cards-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem; }
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 1.1rem 1.25rem;
    }
    .card-icon { font-size: 1.5rem; margin-bottom: .5rem; }
    .card h3 { font-size: .9rem; font-weight: 600; }
    .card p { margin-top: .3rem; font-size: .8rem; color: var(--muted); line-height: 1.5; }

    /* ── Auth box ── */
    .auth-section { max-width: 860px; margin: 0 auto; padding: 0 2rem 2.5rem; }
    .auth-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
    .code-block {
      background: #09090b; border: 1px solid var(--border); border-radius: 8px;
      padding: 1rem 1.25rem; font-family: 'Menlo', 'Monaco', monospace; font-size: .82rem;
      color: #d4d4d8; overflow-x: auto; white-space: pre;
    }
    .code-block .comment { color: #71717a; }
    .code-block .key { color: #818cf8; }
    .code-block .val { color: #6ee7b7; }

    /* ── Redoc container ── */
    .spec-section { max-width: 860px; margin: 0 auto; padding: 0 2rem 1rem; }
    .spec-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
    #redoc-container { border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }

    /* ── Footer ── */
    .footer {
      max-width: 860px; margin: 0 auto;
      padding: 2rem; border-top: 1px solid var(--border);
      font-size: .8rem; color: var(--muted);
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: .5rem;
    }
  </style>
</head>
<body>

<!-- Nav -->
<nav class="topnav">
  <a class="topnav-brand" href="/">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="7" r="4" fill="#6366f1"/>
      <circle cx="17" cy="10" r="3" fill="#818cf8"/>
      <path d="M2 21c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
      <path d="M16 14c2.21 0 4 1.79 4 4v1" stroke="#818cf8" stroke-width="2" stroke-linecap="round"/>
    </svg>
    CoFounder Match
    <span class="badge">API v1</span>
  </a>
  <div class="topnav-links">
    <a href="/health">Health</a>
    <a href="/openapi.json">OpenAPI JSON</a>
    <a href="#reference">Reference</a>
  </div>
</nav>

<!-- Hero -->
<section class="hero">
  <h1>CoFounder Match <span>Developer Portal</span></h1>
  <p>Everything you need to integrate with the CoFounder Match platform — authentication, endpoints, schemas, and live examples.</p>
  <div class="hero-chips">
    <span class="chip"><strong>Base URL</strong> /api/v1</span>
    <span class="chip"><strong>Auth</strong> Clerk JWT (Bearer)</span>
    <span class="chip"><strong>Format</strong> JSON</span>
    <span class="chip"><strong>Version</strong> 1.0.0</span>
    <span class="chip"><strong>Endpoints</strong> 96</span>
  </div>
</section>

<!-- Quick-start cards -->
<section class="cards-section">
  <h2>Quick Start</h2>
  <div class="cards">
    <div class="card">
      <div class="card-icon">🔐</div>
      <h3>Authentication</h3>
      <p>Sign in with Clerk, grab the session token, and pass it as <code>Authorization: Bearer &lt;token&gt;</code>.</p>
    </div>
    <div class="card">
      <div class="card-icon">👤</div>
      <h3>User Onboarding</h3>
      <p>Accept the behaviour agreement, then POST to <code>/users/onboarding</code> to create your profile.</p>
    </div>
    <div class="card">
      <div class="card-icon">🔍</div>
      <h3>Discover Profiles</h3>
      <p>Call <code>GET /profiles/discover</code> to get ranked co-founder candidates.</p>
    </div>
    <div class="card">
      <div class="card-icon">🤝</div>
      <h3>Send an Invite</h3>
      <p>POST to <code>/matches/invite/{"{profile_id}"}</code> with an intro message to connect.</p>
    </div>
    <div class="card">
      <div class="card-icon">💬</div>
      <h3>Messaging</h3>
      <p>Once matched, POST to <code>/messages</code> to start the conversation.</p>
    </div>
    <div class="card">
      <div class="card-icon">📊</div>
      <h3>Admin Analytics</h3>
      <p>Admins can call <code>GET /admin/analytics?days=30</code> for platform-wide insights.</p>
    </div>
  </div>
</section>

<!-- Auth example -->
<section class="auth-section">
  <h2>Authentication</h2>
  <div class="code-block"><span class="comment"># 1. Obtain a Clerk session token from the frontend SDK
# 2. Pass it in every request as a Bearer token</span>

curl https://api.cofoundermatch.com/api/v1/users/me \\
  -H <span class="val">"Authorization: Bearer &lt;your_clerk_session_token&gt;"</span>

<span class="comment"># Example response</span>
{
  <span class="key">"id"</span>: <span class="val">"3fa85f64-5717-4562-b3fc-2c963f66afa6"</span>,
  <span class="key">"name"</span>: <span class="val">"Jane Doe"</span>,
  <span class="key">"email"</span>: <span class="val">"jane@example.com"</span>,
  <span class="key">"profile_status"</span>: <span class="val">"approved"</span>
}</div>
</section>

<!-- Redoc interactive reference -->
<section class="spec-section" id="reference">
  <h2>Full API Reference</h2>
  <div id="redoc-container"></div>
</section>

<footer class="footer">
  <span>CoFounder Match Platform &copy; 2025</span>
  <span>API v1.0.0 — <a href="/openapi.json" style="color:var(--brand)">openapi.json</a></span>
</footer>

<script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
<script>
  Redoc.init('/openapi.json', {
    theme: {
      colors: {
        primary: { main: '#6366f1' },
        text: { primary: '#fafafa', secondary: '#a1a1aa' },
        border: { dark: '#27272a', light: '#27272a' },
        background: '#18181b',
        tonalOffset: 0.3,
      },
      typography: {
        fontFamily: "'Inter', sans-serif",
        fontSize: '14px',
        lineHeight: '1.6',
        headings: { fontFamily: "'Inter', sans-serif", fontWeight: '600' },
        code: { fontFamily: "'Menlo', 'Monaco', monospace", fontSize: '13px' },
      },
      sidebar: {
        backgroundColor: '#0f0f10',
        textColor: '#a1a1aa',
        groupItems: { textTransform: 'uppercase' },
      },
      rightPanel: { backgroundColor: '#09090b' },
      codeBlock: { backgroundColor: '#09090b' },
    },
    scrollYOffset: 60,
    hideDownloadButton: false,
    disableSearch: false,
    expandResponses: '200,201',
    pathInMiddlePanel: false,
    requiredPropsFirst: true,
    sortPropsAlphabetically: false,
    showExtensions: false,
    hideHostname: false,
  }, document.getElementById('redoc-container'));
</script>
</body>
</html>"""
    return HTMLResponse(content=html)
