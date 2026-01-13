"""
Axiom Router - Hypergraph-based axiom pack routing for medical decision support.

This package provides a clean, extensible system for matching patient conditions
to axiom packs using hypergraph semantics.
"""

from axiom_router.axiom_pack import AxiomPack
from axiom_router.hypergraph import AxiomRouter
from axiom_router.loader import load_from_yaml, load_from_json
from axiom_router.exporter import D3Exporter

__version__ = "1.0.0"
__all__ = [
    "AxiomPack",
    "AxiomRouter",
    "load_from_yaml",
    "load_from_json",
    "D3Exporter",
]
