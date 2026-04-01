"""
Logging utilities for the application.

Provides a consistent logging interface across all modules.
"""

import logging


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger instance for the given module name.

    Args:
        name: The module name (typically __name__).

    Returns:
        A logging.Logger instance.
    """
    return logging.getLogger(name)
