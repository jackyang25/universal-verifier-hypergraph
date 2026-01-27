"""Protocol router factory and dependencies."""

import os
from functools import lru_cache
from pathlib import Path

from protocols.router import ProtocolRouter

# Config path (exported for API layer)
CONFIG_PATH = os.getenv("CONFIG_PATH", "protocols/config/clinical_protocols.yaml")

__all__ = ["get_router", "reload_router", "CONFIG_PATH"]


@lru_cache()
def get_router() -> ProtocolRouter:
    """
    Get protocol router instance.
    
    Caches the instance for performance.
    """
    config_path = Path(CONFIG_PATH)
    if not config_path.exists():
        return ProtocolRouter()
    return ProtocolRouter.from_config(config_path)


def reload_router() -> ProtocolRouter:
    """
    Force reload of router configuration.
    
    Clears the cache and loads fresh config.
    """
    get_router.cache_clear()
    return get_router()
