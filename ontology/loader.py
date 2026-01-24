"""Convenience loader for ontology data."""

from pathlib import Path
from typing import Optional

from ontology.bridge import OntologyBridge


def get_default_data_path() -> Path:
    """Get path to default ontology data directory."""
    return Path(__file__).parent / "data"


def create_bridge(data_path: Optional[Path] = None) -> OntologyBridge:
    """
    Create an OntologyBridge with loaded data.
    
    Args:
        data_path: Optional path to data directory (uses default if None)
        
    Returns:
        Configured OntologyBridge
    """
    if data_path is None:
        data_path = get_default_data_path()
    return OntologyBridge.from_directory(data_path)
