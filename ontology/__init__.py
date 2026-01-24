"""
Ontology Module

Provides entity ontology and safety checking capabilities.
Defines typed entities (disorders, substances, states), their relations,
and domain axioms for formal verification.
"""

from ontology.types import EntityType, RelationType
from ontology.registry import OntologyRegistry
from ontology.schema import OntologySchema
from ontology.bridge import OntologyBridge

__all__ = [
    "EntityType",
    "RelationType",
    "OntologyRegistry",
    "OntologySchema",
    "OntologyBridge",
]
