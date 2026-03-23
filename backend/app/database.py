from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Production-grade connection pool configuration
def get_engine_config():
    """Get database engine configuration based on environment"""
    base_config = {
        "pool_pre_ping": True,  # Verify connections before use
        "pool_recycle": 3600,   # Recycle connections every hour
        "pool_timeout": 30,     # Wait up to 30 seconds for a connection
        "echo": settings.ENVIRONMENT == "development",  # SQL logging in development
        # Disable insertmanyvalues optimization as fallback if UUID sentinel matching still fails
        # This can be removed once GUID type fix is verified to work correctly
        # "use_insertmanyvalues": False
    }

    if settings.ENVIRONMENT == "production":
        # Production: larger pool, shorter timeouts, SSL security
        config = {
            **base_config,
            "pool_size": 20,        # Base pool size
            "max_overflow": 40,     # Additional connections beyond pool_size
            "pool_timeout": 10,     # Shorter timeout in production
            "poolclass": QueuePool, # Explicit pool class for production
            "connect_args": {
                "connect_timeout": 10,
                "sslmode": "require",  # Require SSL in production
                "sslcert": None,       # Client certificate (if needed)
                "sslkey": None,        # Client private key (if needed)
                "sslrootcert": None,   # CA certificate (if needed)
                "application_name": f"cofounder_matching_{settings.ENVIRONMENT}",
            }
        }
    elif settings.ENVIRONMENT == "test":
        # Testing: smaller pool, faster recycling
        config = {
            **base_config,
            "pool_size": 2,
            "max_overflow": 5,
            "pool_recycle": 300,    # Recycle connections every 5 minutes
        }
    else:
        # Development: moderate pool size
        config = {
            **base_config,
            "pool_size": 5,
            "max_overflow": 10,
        }

    return config

# Create engine with environment-specific configuration
engine_config = get_engine_config()
logger.info(f"Configuring database engine for {settings.ENVIRONMENT} environment")
logger.info(f"Pool size: {engine_config.get('pool_size')}, Max overflow: {engine_config.get('max_overflow')}")

engine = create_engine(settings.DATABASE_URL, **engine_config)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Database session dependency with proper cleanup"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def check_database_connection():
    """
    Check database connectivity and pool health.
    Returns tuple (is_healthy: bool, pool_info: dict)
    """
    try:
        from sqlalchemy import text

        # Test basic connectivity
        with engine.begin() as conn:
            conn.execute(text("SELECT 1"))

        # Get pool information
        pool = engine.pool
        pool_info = {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid(),
        }

        logger.info(f"Database health check passed. Pool status: {pool_info}")
        return True, pool_info

    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False, {"error": str(e)}


def get_database_stats():
    """Get detailed database connection pool statistics"""
    pool = engine.pool
    return {
        "pool_size": getattr(pool, '_pool_size', 'unknown'),
        "max_overflow": getattr(pool, '_max_overflow', 'unknown'),
        "timeout": getattr(pool, '_timeout', 'unknown'),
        "recycle": getattr(pool, '_recycle', 'unknown'),
        "pre_ping": getattr(pool, '_pre_ping', 'unknown'),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "invalid": pool.invalid(),
    }
