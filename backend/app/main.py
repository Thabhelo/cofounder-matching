from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from app.database import SessionLocal

# Configure structured logging
logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
    
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    # Conditionally disable docs in production
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

# Add logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with request ID"""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info(f"[{request_id}] {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        logger.info(f"[{request_id}] Response: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"[{request_id}] Error: {str(e)}", exc_info=True)
        raise

# Global exception handler - prevents information leakage
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled exception: {str(exc)}", exc_info=True)

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

# Rate limit exceeded handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Parse CORS origins from comma-separated string
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Prometheus metrics
if settings.ENVIRONMENT == "production":
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


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
    """Comprehensive health check including database connectivity"""
    health_status = {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "database": "unknown"
    }

    # Check database connectivity
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["database"] = "connected"
    except SQLAlchemyError as e:
        logger.error(f"Database health check failed: {str(e)}")
        health_status["status"] = "unhealthy"
        health_status["database"] = "disconnected"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        health_status["status"] = "unhealthy"
        health_status["database"] = "error"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )

    return health_status
