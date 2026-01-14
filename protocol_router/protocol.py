"""Clinical protocol data model."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import FrozenSet, Optional


@dataclass(frozen=True)
class Protocol:
    """
    Represents a clinical protocol that activates based on patient conditions.
    
    A clinical protocol defines verifiers, guidelines, and rules that activate
    when ALL required conditions are present in the patient context.
    
    Attributes:
        id: Unique identifier for the protocol
        name: Human-readable name
        conditions: Set of conditions required for activation (hyperedge nodes)
        version: Version string for tracking changes to this protocol
        verifier: Verifier executable/module associated with this protocol
        guideline: Guideline reference/name this protocol was derived from
        description: Optional detailed description
        last_reviewed: Date when protocol was last reviewed (ISO format: YYYY-MM-DD)
        reviewer: Name/ID of person or entity who reviewed the protocol
        country: Jurisdiction/country where protocol is applicable (ISO 3166-1)
        regulatory_body: Regulatory authority that approved the protocol
        approval_status: Current approval status (draft, approved, deprecated)
        created_at: Timestamp when protocol was defined
        metadata: Additional key-value pairs for extensibility
    """
    
    id: str
    name: str
    conditions: FrozenSet[str]
    version: str = "1.0.0"
    verifier: Optional[str] = None
    guideline: Optional[str] = None
    description: str = ""
    last_reviewed: Optional[str] = None
    reviewer: Optional[str] = None
    country: Optional[str] = None
    regulatory_body: Optional[str] = None
    approval_status: Optional[str] = None
    created_at: Optional[datetime] = None
    metadata: tuple = field(default_factory=tuple)  # tuple of (key, value) pairs for immutability
    
    def __post_init__(self) -> None:
        """Validate protocol on creation."""
        if not self.id:
            raise ValueError("Protocol id cannot be empty")
        if not self.name:
            raise ValueError("Protocol name cannot be empty")
        if not self.conditions:
            raise ValueError("Protocol must have at least one condition")
    
    def matches(self, patient_conditions: set[str]) -> bool:
        """
        Check if this protocol should activate for given patient conditions.
        
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
    def is_interaction_protocol(self) -> bool:
        """True if this protocol requires multiple conditions (interaction protocol)."""
        return self.condition_count > 1
    
    def to_dict(self) -> dict:
        """
        Serialize protocol to dictionary for JSON/YAML export.
        
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
        if self.verifier:
            result["verifier"] = self.verifier
        if self.guideline:
            result["guideline"] = self.guideline
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
    def from_dict(cls, data: dict) -> "Protocol":
        """
        Create a Protocol from a dictionary.
        
        Args:
            data: Dictionary with protocol fields
            
        Returns:
            New Protocol instance
            
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
            verifier=data.get("verifier"),
            guideline=data.get("guideline"),
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
        return f"Protocol(id={self.id!r}, name={self.name!r}, conditions={{{conditions_str}}})"
