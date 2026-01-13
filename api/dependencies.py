"""Dependency injection for FastAPI."""

import os
from functools import lru_cache
from pathlib import Path

from axiom_router import AxiomRouter

# default config path
CONFIG_PATH = os.getenv("CONFIG_PATH", "config/axiom_packs.yaml")
ENV = os.getenv("ENV", "development")

# store router instance
_router_instance = None


def get_router() -> AxiomRouter:
    """
    Get router instance.
    
    In development, reloads config each time.
    In production, caches the instance.
    """
    global _router_instance
    
    # always reload in development
    if ENV == "development":
        config_path = Path(CONFIG_PATH)
        if not config_path.exists():
            return AxiomRouter()
        return AxiomRouter.from_config(config_path)
    
    # cache in production
    if _router_instance is None:
        config_path = Path(CONFIG_PATH)
        if not config_path.exists():
            _router_instance = AxiomRouter()
        else:
            _router_instance = AxiomRouter.from_config(config_path)
    
    return _router_instance


def get_router_dependency() -> AxiomRouter:
    """FastAPI dependency for router injection."""
    return get_router()


def reload_router() -> AxiomRouter:
    """
    Force reload of router configuration.
    
    Clears the cache and loads fresh config.
    """
    get_router.cache_clear()
    return get_router()
