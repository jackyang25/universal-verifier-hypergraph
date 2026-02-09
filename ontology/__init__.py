"""
Ontology Module

Provides entity ontology and safety checking capabilities.
Defines typed entities (disorders, substances, states), their relations,
and domain axioms for formal verification.
"""

from ontology.types import EntityType, RelationType
from ontology.registry import OntologyRegistry
from ontology.schema import OntologySchema

# import bridge first (it imports from axioms.core)
from ontology.bridge import OntologyBridge

# then import axiom types (safe after bridge is loaded)
from ontology.axioms.base import Axiom, AxiomType, AxiomRegistry
from ontology.axioms.core import CoreAxioms

__all__ = [
    "EntityType",
    "RelationType",
    "OntologyRegistry",
    "OntologySchema",
    "OntologyBridge",
    "Axiom",
    "AxiomType",
    "AxiomRegistry",
    "CoreAxioms",
]
