"""Dependency injection for FastAPI."""

import os
from functools import lru_cache
from pathlib import Path

from protocol_router import ProtocolRouter

# default config path
CONFIG_PATH = os.getenv("CONFIG_PATH", "config/clinical_protocols.yaml")
ENV = os.getenv("ENV", "development")

@lru_cache()
def get_protocol_router() -> ProtocolRouter:
    """
    Get router instance.
    
    In development, reloads config each time.
    In production, caches the instance.
    """
    config_path = Path(CONFIG_PATH)
    if not config_path.exists():
        return ProtocolRouter()
    return ProtocolRouter.from_config(config_path)


def get_protocol_router_dependency() -> ProtocolRouter:
    """FastAPI dependency for router injection."""
    # in development, always reload to reflect config/UI changes
    if ENV == "development":
        reload_protocol_router()
    return get_protocol_router()


def reload_protocol_router() -> ProtocolRouter:
    """
    Force reload of router configuration.
    
    Clears the cache and loads fresh config.
    """
    get_protocol_router.cache_clear()
    return get_protocol_router()
