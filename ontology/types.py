"""Core type definitions for the clinical universe."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, FrozenSet


class EntityType(Enum):
    """Classification of clinical entities."""
    
    DISORDER = "disorder"
    FINDING = "finding"
    SUBSTANCE = "substance"
    PROCEDURE = "procedure"
    PHYSIOLOGIC_STATE = "physiologic_state"
    ORGANISM = "organism"
    QUALIFIER = "qualifier"


class RelationType(Enum):
    """Classification of relations between entities."""
    
    CONTRAINDICATED_IN = "contraindicated_in"
    TREATS = "treats"
    INDICATES = "indicates"
    CAUSES = "causes"
    INTERACTS_WITH = "interacts_with"
    REQUIRES = "requires"
    EXCLUDES = "excludes"
    MODIFIES = "modifies"
    REQUIRES_DOSE_ADJUSTMENT = "requires_dose_adjustment"


class Severity(Enum):
    """Severity qualifiers for clinical entities."""
    
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class Temporality(Enum):
    """Temporal qualifiers for clinical states."""
    
    ACUTE = "acute"
    CHRONIC = "chronic"
    INTERMITTENT = "intermittent"
    RESOLVED = "resolved"


class DoseCategory(Enum):
    """
    Categorical dose safety levels for formal verification.
    
    Used instead of numeric values to enable rigorous Lean proofs
    and avoid false precision in safety bounds.
    """
    
    STANDARD = "standard"                        # no adjustment needed
    USE_WITH_CAUTION = "use_with_caution"        # monitor closely, may need adjustment
    REDUCED = "reduced"                          # reduce from standard dose
    SEVERELY_RESTRICTED = "severely_restricted"  # significant reduction required
    AVOID_IF_POSSIBLE = "avoid_if_possible"      # use only if no alternatives


@dataclass(frozen=True)
class Entity:
    """
    Base class for typed clinical entities.
    
    An entity represents a concept in the clinical domain with formal semantics.
    Entities are immutable and hashable for use in sets and as dict keys.
    
    Attributes:
        id: Unique identifier (e.g., "diabetes_mellitus_type_2")
        name: Human-readable name
        entity_type: Classification of this entity
        description: Optional detailed description
        codes: External coding system references (SNOMED, ICD-10, etc.)
        parent_id: Optional parent entity for hierarchical relationships
    """
    
    id: str
    name: str
    entity_type: EntityType
    description: str = ""
    codes: FrozenSet[tuple] = field(default_factory=frozenset)  # (system, code) pairs
    parent_id: Optional[str] = None
    
    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Entity id cannot be empty")
        if not self.name:
            raise ValueError("Entity name cannot be empty")
    
    @property
    def lean_id(self) -> str:
        """Return a Lean-safe identifier."""
        return self.id.replace("-", "_").replace(" ", "_")
    
    def to_dict(self) -> dict:
        """Serialize entity to dictionary."""
        result = {
            "id": self.id,
            "name": self.name,
            "entity_type": self.entity_type.value,
        }
        if self.description:
            result["description"] = self.description
        if self.codes:
            result["codes"] = [{"system": s, "code": c} for s, c in self.codes]
        if self.parent_id:
            result["parent_id"] = self.parent_id
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "Entity":
        """Create entity from dictionary."""
        codes = frozenset()
        if "codes" in data:
            codes = frozenset((c["system"], c["code"]) for c in data["codes"])
        
        return cls(
            id=data["id"],
            name=data["name"],
            entity_type=EntityType(data["entity_type"]),
            description=data.get("description", ""),
            codes=codes,
            parent_id=data.get("parent_id"),
        )


@dataclass(frozen=True)
class Relation:
    """
    A typed relation between two entities.
    
    Relations express formal semantic connections that can be used
    in verification and reasoning.
    
    Attributes:
        id: Unique identifier for this relation instance
        relation_type: Classification of this relation
        source_id: Entity id of the source (subject)
        target_id: Entity id of the target (object)
        strength: Optional confidence or strength indicator
        conditions: Optional qualifying conditions for this relation
        evidence: Optional reference to supporting evidence
        dose_category: Categorical safety level (for REQUIRES_DOSE_ADJUSTMENT relations)
    """
    
    id: str
    relation_type: RelationType
    source_id: str
    target_id: str
    strength: Optional[str] = None  # "absolute", "strong", "moderate", "weak"
    conditions: FrozenSet[str] = field(default_factory=frozenset)
    evidence: Optional[str] = None
    dose_category: Optional[DoseCategory] = None  # categorical safety level
    
    def __post_init__(self) -> None:
        if not self.source_id:
            raise ValueError("Relation source_id cannot be empty")
        if not self.target_id:
            raise ValueError("Relation target_id cannot be empty")
    
    @property
    def lean_id(self) -> str:
        """Return a Lean-safe identifier."""
        return f"{self.relation_type.value}_{self.source_id}_{self.target_id}".replace("-", "_")
    
    def to_dict(self) -> dict:
        """Serialize relation to dictionary."""
        result = {
            "id": self.id,
            "relation_type": self.relation_type.value,
            "source_id": self.source_id,
            "target_id": self.target_id,
        }
        if self.strength:
            result["strength"] = self.strength
        if self.conditions:
            result["conditions"] = sorted(self.conditions)
        if self.evidence:
            result["evidence"] = self.evidence
        if self.dose_category is not None:
            result["dose_category"] = self.dose_category.value
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "Relation":
        """Create relation from dictionary."""
        conditions = frozenset()
        if "conditions" in data:
            conditions = frozenset(data["conditions"])
        
        dose_category = None
        if "dose_category" in data:
            dose_category = DoseCategory(data["dose_category"])
        
        return cls(
            id=data["id"],
            relation_type=RelationType(data["relation_type"]),
            source_id=data["source_id"],
            target_id=data["target_id"],
            strength=data.get("strength"),
            conditions=conditions,
            evidence=data.get("evidence"),
            dose_category=dose_category,
        )


@dataclass(frozen=True)
class QualifiedEntity:
    """
    An entity with qualifiers applied (compositional representation).
    
    Enables expressions like "severe acute bacterial pneumonia" by
    combining a base entity with qualifying modifiers.
    
    Attributes:
        base_entity_id: The primary entity being qualified
        severity: Optional severity qualifier
        temporality: Optional temporal qualifier
        laterality: Optional laterality (left, right, bilateral)
        modifiers: Additional modifier entity ids
    """
    
    base_entity_id: str
    severity: Optional[Severity] = None
    temporality: Optional[Temporality] = None
    laterality: Optional[str] = None
    modifiers: FrozenSet[str] = field(default_factory=frozenset)
    
    @property
    def composite_id(self) -> str:
        """Generate a composite identifier from all components."""
        parts = []
        if self.severity:
            parts.append(self.severity.value)
        if self.temporality:
            parts.append(self.temporality.value)
        if self.laterality:
            parts.append(self.laterality)
        parts.append(self.base_entity_id)
        parts.extend(sorted(self.modifiers))
        return "_".join(parts)
    
    def to_dict(self) -> dict:
        """Serialize qualified entity to dictionary."""
        result = {"base_entity_id": self.base_entity_id}
        if self.severity:
            result["severity"] = self.severity.value
        if self.temporality:
            result["temporality"] = self.temporality.value
        if self.laterality:
            result["laterality"] = self.laterality
        if self.modifiers:
            result["modifiers"] = sorted(self.modifiers)
        return result
