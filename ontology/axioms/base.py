"""Base axiom definitions for formal verification."""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, FrozenSet


class AxiomType(Enum):
    """Classification of domain axioms."""
    
    MUTUAL_EXCLUSION = "mutual_exclusion"      # two things cannot coexist
    IMPLICATION = "implication"                 # if A then B
    CONTRAINDICATION = "contraindication"       # substance X contraindicated in state Y
    REQUIREMENT = "requirement"                 # A requires B
    EQUIVALENCE = "equivalence"                 # A iff B
    HIERARCHY = "hierarchy"                     # A is_a B (subsumption)
    DOSE_CONSTRAINT = "dose_constraint"         # dosage adjustment required for substance in state


@dataclass(frozen=True)
class Axiom:
    """
    A formal axiom (protocol) expressing domain knowledge.
    
    Each axiom has a linked proof that can be executed at runtime.
    Axioms are the foundation for formal proofs.
    
    Attributes:
        id: Unique identifier
        axiom_type: Classification of this axiom
        name: Human-readable name
        description: Explanation of what this axiom expresses
        antecedent: Entity ids that form the "if" part
        consequent: Entity ids that form the "then" part
        negated: If true, the consequent is negated (for exclusions)
        evidence: Optional reference to supporting evidence
        dose_category: Categorical safety level for dose constraints
        proof_link: Link to pre-built proof executable
        lean_code: Optional Lean 4 proof code
    """
    
    id: str
    axiom_type: AxiomType
    name: str
    description: str
    antecedent: FrozenSet[str]  # if these conditions hold
    consequent: FrozenSet[str]  # then these must/must not hold
    negated: bool = False       # if true, consequent must NOT hold
    evidence: Optional[str] = None
    dose_category: Optional[str] = None  # categorical safety level for Lean formalization
    proof_link: Optional[str] = None  # link to pre-built proof (proof function name or executable path)
    lean_code: Optional[str] = None  # Lean 4 proof code
    
    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Axiom id cannot be empty")
        if not self.antecedent and not self.consequent:
            raise ValueError("Axiom must have antecedent or consequent")
    
    @property
    def lean_id(self) -> str:
        """Return a Lean-safe identifier."""
        return f"axiom_{self.id}".replace("-", "_").replace(" ", "_")
    
    def to_dict(self) -> dict:
        """Serialize axiom to dictionary."""
        result = {
            "id": self.id,
            "axiom_type": self.axiom_type.value,
            "name": self.name,
            "description": self.description,
            "antecedent": sorted(self.antecedent),
            "consequent": sorted(self.consequent),
            "negated": self.negated,
        }
        if self.evidence:
            result["evidence"] = self.evidence
        if self.dose_category is not None:
            result["dose_category"] = self.dose_category
        if self.proof_link:
            result["proof_link"] = self.proof_link
        if self.lean_code:
            result["lean_code"] = self.lean_code
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "Axiom":
        """Create axiom from dictionary."""
        return cls(
            id=data["id"],
            axiom_type=AxiomType(data["axiom_type"]),
            name=data["name"],
            description=data["description"],
            antecedent=frozenset(data.get("antecedent", [])),
            consequent=frozenset(data.get("consequent", [])),
            negated=data.get("negated", False),
            evidence=data.get("evidence"),
            dose_category=data.get("dose_category"),
            proof_link=data.get("proof_link"),
            lean_code=data.get("lean_code"),
        )


@dataclass
class AxiomRegistry:
    """Registry for domain axioms."""
    
    _axioms: dict = field(default_factory=dict)
    _axioms_by_type: dict = field(default_factory=dict)
    
    def __post_init__(self) -> None:
        for axiom_type in AxiomType:
            self._axioms_by_type[axiom_type] = set()
    
    def register(self, axiom: Axiom) -> None:
        """Register an axiom."""
        if axiom.id in self._axioms:
            raise ValueError(f"Axiom '{axiom.id}' already registered")
        self._axioms[axiom.id] = axiom
        self._axioms_by_type[axiom.axiom_type].add(axiom.id)
    
    def get(self, axiom_id: str) -> Optional[Axiom]:
        """Get axiom by id."""
        return self._axioms.get(axiom_id)
    
    def get_by_type(self, axiom_type: AxiomType) -> List[Axiom]:
        """Get all axioms of a type."""
        return [self._axioms[aid] for aid in self._axioms_by_type[axiom_type]]
    
    def get_applicable_axioms(self, entity_ids: FrozenSet[str]) -> List[Axiom]:
        """Get axioms whose antecedent is satisfied by the given entities."""
        applicable = []
        for axiom in self._axioms.values():
            if axiom.antecedent.issubset(entity_ids):
                applicable.append(axiom)
        return applicable
    
    @property
    def count(self) -> int:
        return len(self._axioms)
    
    def iter_axioms(self):
        """Iterate over all axioms."""
        yield from self._axioms.values()
    
    def to_dict(self) -> dict:
        """Export to dictionary."""
        return {
            "axioms": [a.to_dict() for a in self._axioms.values()]
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "AxiomRegistry":
        """Create registry from dictionary."""
        registry = cls()
        for axiom_data in data.get("axioms", []):
            axiom = Axiom.from_dict(axiom_data)
            registry.register(axiom)
        return registry
