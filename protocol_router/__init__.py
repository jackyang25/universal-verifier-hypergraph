"""
Protocol Router - Hypergraph-based clinical protocol routing for medical decision support.

This package provides a clean, extensible system for matching patient conditions
to clinical protocols using hypergraph semantics.
"""

from protocol_router.protocol import Protocol
from protocol_router.router import ProtocolRouter
from protocol_router.loader import load_from_yaml, load_from_json
from protocol_router.exporter import D3Exporter

__version__ = "1.0.0"
__all__ = [
    "Protocol",
    "ProtocolRouter",
    "load_from_yaml",
    "load_from_json",
    "D3Exporter",
]
