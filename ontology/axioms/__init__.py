"""
Axioms module for formal domain knowledge.

Axioms express fundamental truths about entities and relations
that can be used in formal verification.
"""

from ontology.axioms.base import Axiom, AxiomType
from ontology.axioms.core import CoreAxioms

__all__ = [
    "Axiom",
    "AxiomType",
    "CoreAxioms",
]
