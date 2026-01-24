"""FastAPI dependency injection."""

import os
from typing import Optional

from protocols.dependencies import get_router, reload_router
from protocols.router import ProtocolRouter
from ontology.dependencies import get_bridge
from ontology.bridge import OntologyBridge

ENV = os.getenv("ENV", "development")


def get_protocol_router_dependency() -> ProtocolRouter:
    """
    FastAPI dependency for protocol router injection.
    
    In development mode, reloads config on each request.
    """
    if ENV == "development":
        reload_router()
    return get_router()


def get_ontology_bridge_dependency() -> Optional[OntologyBridge]:
    """
    FastAPI dependency for ontology bridge injection.
    
    Returns None if ontology module is not available (graceful degradation).
    """
    return get_bridge()
