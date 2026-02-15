import logging
import sys
from .config import get_settings

settings = get_settings()

def setup_logging():
    """
    Configure logging for the application.
    """
    logger = logging.getLogger("findxo")
    logger.setLevel(settings.LOG_LEVEL)

    # Create console handler with a higher log level
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(settings.LOG_LEVEL)

    # Create formatter and add it to the handlers
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    ch.setFormatter(formatter)

    # Add the handlers to the logger
    if not logger.handlers:
        logger.addHandler(ch)

    return logger

logger = setup_logging()
