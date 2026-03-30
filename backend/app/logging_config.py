"""
Enhanced logging configuration with PII scrubbing and structured JSON output.
"""

import logging
import re
import sys
from typing import Any, Dict, List, Pattern, Optional
from pythonjsonlogger import jsonlogger
from app.config import settings


class PIIFilter(logging.Filter):
    """
    Filter to scrub PII from log messages for GDPR compliance.
    """

    # Common PII patterns - compiled for performance
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    PHONE_PATTERN = re.compile(r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b')
    SSN_PATTERN = re.compile(r'\b\d{3}-?\d{2}-?\d{4}\b')
    CREDIT_CARD_PATTERN = re.compile(r'\b(?:\d{4}[-.\s]?){3}\d{4}\b')
    # JWT tokens, API keys, etc.
    TOKEN_PATTERN = re.compile(r'\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b')
    API_KEY_PATTERN = re.compile(r'\b[A-Za-z0-9_-]{32,}\b')

    # Sensitive field names in JSON/form data
    SENSITIVE_FIELDS = {
        'password', 'passwd', 'secret', 'token', 'key', 'authorization',
        'email', 'phone', 'ssn', 'social_security_number', 'credit_card',
        'card_number', 'cvv', 'cvc', 'pin', 'birth_date', 'dob'
    }

    def __init__(self):
        super().__init__()
        self.patterns: List[tuple[Pattern, str]] = [
            (self.EMAIL_PATTERN, '[EMAIL_REDACTED]'),
            (self.PHONE_PATTERN, '[PHONE_REDACTED]'),
            (self.SSN_PATTERN, '[SSN_REDACTED]'),
            (self.CREDIT_CARD_PATTERN, '[CARD_REDACTED]'),
            (self.TOKEN_PATTERN, '[TOKEN_REDACTED]'),
            (self.API_KEY_PATTERN, '[API_KEY_REDACTED]'),
        ]

    def filter(self, record: logging.LogRecord) -> bool:
        """
        Filter log record to remove PII.
        Returns True to keep the record, False to drop it.
        """
        try:
            # Scrub the main message
            if hasattr(record, 'msg') and record.msg:
                record.msg = self._scrub_text(str(record.msg))

            # Scrub arguments if present
            if hasattr(record, 'args') and record.args:
                record.args = tuple(self._scrub_text(str(arg)) if isinstance(arg, str) else arg
                                  for arg in record.args)

            # Scrub any additional attributes that might contain PII
            for attr_name in dir(record):
                if not attr_name.startswith('_') and attr_name not in {'name', 'levelno', 'levelname', 'pathname', 'filename', 'module', 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated', 'thread', 'threadName', 'processName', 'process'}:
                    try:
                        attr_value = getattr(record, attr_name)
                        if isinstance(attr_value, str):
                            setattr(record, attr_name, self._scrub_text(attr_value))
                        elif isinstance(attr_value, dict):
                            setattr(record, attr_name, self._scrub_dict(attr_value))
                    except (AttributeError, TypeError):
                        # Skip non-string attributes or those that can't be processed
                        continue

        except Exception as e:
            # If PII scrubbing fails, log the error but don't drop the record
            # This ensures logging continues to work even if scrubbing has bugs
            print(f"Error in PII filter: {e}", file=sys.stderr)

        return True

    def _scrub_text(self, text: str) -> str:
        """Scrub PII patterns from text."""
        if not isinstance(text, str):
            return text

        scrubbed = text
        for pattern, replacement in self.patterns:
            scrubbed = pattern.sub(replacement, scrubbed)

        return scrubbed

    def _scrub_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Scrub PII from dictionary data (like JSON logs)."""
        if not isinstance(data, dict):
            return data

        scrubbed = {}
        for key, value in data.items():
            key_lower = key.lower()

            # Check if key indicates sensitive data
            if any(sensitive in key_lower for sensitive in self.SENSITIVE_FIELDS):
                scrubbed[key] = '[REDACTED]'
            elif isinstance(value, str):
                scrubbed[key] = self._scrub_text(value)
            elif isinstance(value, dict):
                scrubbed[key] = self._scrub_dict(value)
            elif isinstance(value, list):
                scrubbed[key] = [self._scrub_dict(item) if isinstance(item, dict)
                               else self._scrub_text(item) if isinstance(item, str)
                               else item for item in value]
            else:
                scrubbed[key] = value

        return scrubbed


class StructuredFormatter(jsonlogger.JsonFormatter):
    """
    JSON formatter with consistent structure for log aggregation.
    """

    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        """Add standard fields to every log record."""
        super().add_fields(log_record, record, message_dict)

        # Add standard fields
        log_record['timestamp'] = self.formatTime(record, self.datefmt)
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        log_record['environment'] = settings.ENVIRONMENT
        log_record['service'] = 'cofounder-matching-api'

        # Add request ID if available (from FastAPI middleware)
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id

        # Add user ID if available (for user-specific logs)
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id

        # Add performance metrics if available
        if hasattr(record, 'duration_ms'):
            log_record['duration_ms'] = record.duration_ms


def setup_logging():
    """
    Configure logging for the application.
    """

    # Determine log level
    if settings.ENVIRONMENT == "production":
        log_level = logging.WARNING
    elif settings.ENVIRONMENT == "test":
        log_level = logging.ERROR
    else:
        log_level = logging.DEBUG

    # Create PII filter
    pii_filter = PIIFilter()

    # Create JSON formatter
    formatter = StructuredFormatter(
        fmt='%(timestamp)s %(level)s %(logger)s %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S.%fZ'
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler with JSON formatting
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(pii_filter)
    root_logger.addHandler(console_handler)

    # Configure specific loggers

    # Application logger
    app_logger = logging.getLogger('app')
    app_logger.setLevel(log_level)

    # Database logger (SQLAlchemy)
    db_logger = logging.getLogger('sqlalchemy.engine')
    if settings.ENVIRONMENT == "development":
        db_logger.setLevel(logging.INFO)  # Show SQL in development
    else:
        db_logger.setLevel(logging.WARNING)  # Hide SQL in production

    # HTTP client logger
    http_logger = logging.getLogger('httpx')
    http_logger.setLevel(logging.WARNING)

    # Uvicorn logger
    uvicorn_logger = logging.getLogger('uvicorn')
    uvicorn_logger.setLevel(logging.INFO)

    # Reduce noise from some third-party libraries
    logging.getLogger('asyncio').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)

    # Log the configuration
    app_logger.info("Logging configured", extra={
        "environment": settings.ENVIRONMENT,
        "log_level": logging.getLevelName(log_level),
        "pii_scrubbing": True,
        "structured_logging": True
    })


def get_logger_with_request_id(name: str, request_id: Optional[str] = None) -> logging.Logger:
    """
    Get a logger with request ID context.

    Args:
        name: Logger name
        request_id: Request ID to include in all log messages

    Returns:
        Logger with request ID context
    """
    logger = logging.getLogger(name)

    if request_id:
        # Create a custom filter to add request ID to all records
        class RequestIDFilter(logging.Filter):
            def filter(self, record):
                record.request_id = request_id
                return True

        # Add filter to logger (if not already present)
        if not any(isinstance(f, RequestIDFilter) for f in logger.filters):
            logger.addFilter(RequestIDFilter())

    return logger


def log_request_metrics(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    request_id: Optional[str] = None,
    user_id: str | None = None,
    error: Optional[str] = None
):
    """
    Log request metrics in a structured format.

    Args:
        method: HTTP method
        path: Request path
        status_code: HTTP status code
        duration_ms: Request duration in milliseconds
        request_id: Request ID
        user_id: User ID (if authenticated)
        error: Error message (if any)
    """
    logger = logging.getLogger('app.metrics')

    extra = {
        'event_type': 'http_request',
        'method': method,
        'path': path,
        'status_code': status_code,
        'duration_ms': duration_ms,
    }

    if request_id:
        extra['request_id'] = request_id
    if user_id:
        extra['user_id'] = user_id
    if error:
        extra['error'] = error

    if status_code >= 500:
        logger.error(f"{method} {path} - {status_code} ({duration_ms:.2f}ms)", extra=extra)
    elif status_code >= 400:
        logger.warning(f"{method} {path} - {status_code} ({duration_ms:.2f}ms)", extra=extra)
    else:
        logger.info(f"{method} {path} - {status_code} ({duration_ms:.2f}ms)", extra=extra)


# Log retention configuration (for external log aggregation services)
LOG_RETENTION_CONFIG = {
    "development": {
        "days": 7,
        "max_size_mb": 100
    },
    "test": {
        "days": 1,
        "max_size_mb": 10
    },
    "production": {
        "days": 90,  # Comply with data retention policies
        "max_size_mb": 1000
    }
}