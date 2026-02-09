"""
Axioms module for formal domain knowledge.

Axioms express fundamental truths about entities and relations
that can be used in formal verification.
"""

from ontology.axioms.base import Axiom, AxiomType, AxiomRegistry
from ontology.axioms.core import CoreAxioms

# AxiomRetriever not exported here to avoid circular import
# (it imports from ontology_bridge which imports from axioms.core)
# Import directly from ontology.axioms.retrieval where needed

__all__ = [
    "Axiom",
    "AxiomType",
    "AxiomRegistry",
    "CoreAxioms",
]
