"""Axiom pack data model."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import FrozenSet, Optional


@dataclass(frozen=True)
class AxiomPack:
    """
    Represents an axiom pack that activates based on patient conditions.
    
    An axiom pack defines a set of guidelines or rules that become active
    when ALL required conditions are present in the patient context.
    
    Attributes:
        id: Unique identifier for the axiom pack
        name: Human-readable name
        conditions: Set of conditions required for activation (hyperedge nodes)
        version: Version string for tracking changes to this pack
        description: Optional detailed description
        last_reviewed: Date when pack was last reviewed (ISO format: YYYY-MM-DD)
        reviewer: Name/ID of person or entity who reviewed the pack
        country: Jurisdiction/country where pack is applicable (ISO 3166-1)
        regulatory_body: Regulatory authority that approved the pack
        approval_status: Current approval status (draft, approved, deprecated)
        created_at: Timestamp when pack was defined
        metadata: Additional key-value pairs for extensibility
    """
    
    id: str
    name: str
    conditions: FrozenSet[str]
    version: str = "1.0.0"
    description: str = ""
    last_reviewed: Optional[str] = None
    reviewer: Optional[str] = None
    country: Optional[str] = None
    regulatory_body: Optional[str] = None
    approval_status: Optional[str] = None
    created_at: Optional[datetime] = None
    metadata: tuple = field(default_factory=tuple)  # tuple of (key, value) pairs for immutability
    
    def __post_init__(self) -> None:
        """Validate axiom pack on creation."""
        if not self.id:
            raise ValueError("AxiomPack id cannot be empty")
        if not self.name:
            raise ValueError("AxiomPack name cannot be empty")
        if not self.conditions:
            raise ValueError("AxiomPack must have at least one condition")
    
    def matches(self, patient_conditions: set[str]) -> bool:
        """
        Check if this axiom pack should activate for given patient conditions.
        
        Exact matching: activates only if ALL conditions are present.
        
        Args:
            patient_conditions: Set of active patient conditions
            
        Returns:
            True if all required conditions are present
        """
        return self.conditions.issubset(patient_conditions)
    
    @property
    def condition_count(self) -> int:
        """Number of conditions required for activation."""
        return len(self.conditions)
    
    @property
    def is_interaction_pack(self) -> bool:
        """True if this pack requires multiple conditions (interaction pack)."""
        return self.condition_count > 1
    
    def to_dict(self) -> dict:
        """
        Serialize axiom pack to dictionary for JSON/YAML export.
        
        Returns:
            Dictionary representation suitable for serialization
        """
        result = {
            "id": self.id,
            "version": self.version,
            "name": self.name,
            "conditions": sorted(self.conditions),
        }
        
        # only include optional fields if they have values
        if self.description:
            result["description"] = self.description
        if self.last_reviewed:
            result["last_reviewed"] = self.last_reviewed
        if self.reviewer:
            result["reviewer"] = self.reviewer
        if self.country:
            result["country"] = self.country
        if self.regulatory_body:
            result["regulatory_body"] = self.regulatory_body
        if self.approval_status:
            result["approval_status"] = self.approval_status
        if self.created_at:
            result["created_at"] = self.created_at.isoformat()
        if self.metadata:
            result["metadata"] = dict(self.metadata)
        
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "AxiomPack":
        """
        Create an AxiomPack from a dictionary.
        
        Args:
            data: Dictionary with axiom pack fields
            
        Returns:
            New AxiomPack instance
            
        Raises:
            ValueError: If required fields are missing or invalid
        """
        if "id" not in data:
            raise ValueError("Missing required field: id")
        if "name" not in data:
            raise ValueError("Missing required field: name")
        if "conditions" not in data:
            raise ValueError("Missing required field: conditions")
        
        conditions = data["conditions"]
        if isinstance(conditions, list):
            conditions = frozenset(conditions)
        elif isinstance(conditions, set):
            conditions = frozenset(conditions)
        elif not isinstance(conditions, frozenset):
            raise ValueError("conditions must be a list, set, or frozenset")
        
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        metadata = data.get("metadata")
        if isinstance(metadata, dict):
            metadata = tuple(metadata.items())
        elif metadata is None:
            metadata = tuple()
        
        return cls(
            id=data["id"],
            name=data["name"],
            conditions=conditions,
            version=data.get("version", "1.0.0"),
            description=data.get("description", ""),
            last_reviewed=data.get("last_reviewed"),
            reviewer=data.get("reviewer"),
            country=data.get("country"),
            regulatory_body=data.get("regulatory_body"),
            approval_status=data.get("approval_status"),
            created_at=created_at,
            metadata=metadata,
        )
    
    def __repr__(self) -> str:
        conditions_str = ", ".join(sorted(self.conditions))
        return f"AxiomPack(id={self.id!r}, name={self.name!r}, conditions={{{conditions_str}}})"
