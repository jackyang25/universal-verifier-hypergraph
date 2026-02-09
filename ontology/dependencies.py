"""Ontology bridge factory and dependencies."""

import traceback
from functools import lru_cache
from typing import Optional

from ontology.bridge import OntologyBridge
from ontology.loader import create_bridge


@lru_cache()
def get_bridge() -> Optional[OntologyBridge]:
    """
    Get ontology bridge instance.
    
    Returns None if ontology module is not available.
    Caches the instance for performance.
    """
    try:
        bridge = create_bridge()
        bridge.generate_axioms_from_relations()
        return bridge
    except ImportError as e:
        print(f"Ontology ImportError: {e}")
        return None
    except Exception as e:
        print(f"Ontology initialization error: {e}")
        traceback.print_exc()
        return None


def reload_bridge() -> Optional[OntologyBridge]:
    """
    Force reload of ontology bridge.
    
    Clears the cache and reloads data.
    """
    get_bridge.cache_clear()
    return get_bridge()
