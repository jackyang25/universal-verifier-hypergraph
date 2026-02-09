"""Verification certificate data structures."""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class VerificationStatus(Enum):
    """Result of verification process."""
    VERIFIED = "VERIFIED"
    BLOCKED = "BLOCKED"
    REPAIR_NEEDED = "REPAIR_NEEDED"


@dataclass
class Contraindication:
    """A contraindication violation."""
    substance: str
    condition: str
    strength: str
    rationale: str
    guideline: str


@dataclass
class Alternative:
    """An alternative action when blocked."""
    substance: Optional[str] = None
    action: Optional[str] = None
    dose: Optional[str] = None
    rationale: Optional[str] = None
    guideline: Optional[str] = None


@dataclass
class DoseLimit:
    """Dose restriction (informational, not blocking)."""
    substance: str
    condition: str
    dose_category: str
    strength: str
    rationale: str
    guideline: str


@dataclass
class ConsistencyViolation:
    """A consistency violation in patient state."""
    type: str
    condition: Optional[str] = None
    required_action: Optional[str] = None
    proposed_action: Optional[str] = None
    explanation: Optional[str] = None


@dataclass
class RequiredAction:
    """A required action for a condition."""
    action: str
    condition: str
    satisfied: bool
    rationale: str
    guideline: str


@dataclass
class VerificationCertificate:
    """
    Verification certificate with 7 required components.
    
    Generated from proof execution results.
    """
    # 1. Verification Status
    verification_status: VerificationStatus
    
    # 2. Contraindications (blocking)
    contraindications: List[Contraindication] = field(default_factory=list)
    
    # 3. Alternatives (repair guidance)
    alternatives: List[Alternative] = field(default_factory=list)
    
    # 4. Dose Limits (informational, not blocking)
    dose_limits: List[DoseLimit] = field(default_factory=list)
    
    # 5. Consistency Violations (blocking)
    consistency_violations: List[ConsistencyViolation] = field(default_factory=list)
    
    # 6. Required Actions (blocking if unsatisfied)
    required_actions: List[RequiredAction] = field(default_factory=list)
    
    # 7. Process Trace (audit trail)
    process_trace: List[str] = field(default_factory=list)
    
    # Lean 4 proof reference
    lean_proof_id: Optional[str] = None
    
    def to_dict(self) -> dict:
        """Export certificate to dictionary."""
        return {
            "verification_status": self.verification_status.value,
            "contraindications": [
                {
                    "substance": c.substance,
                    "condition": c.condition,
                    "strength": c.strength,
                    "rationale": c.rationale,
                    "guideline": c.guideline,
                }
                for c in self.contraindications
            ],
            "alternatives": [
                {
                    k: v for k, v in {
                        "substance": a.substance,
                        "action": a.action,
                        "dose": a.dose,
                        "rationale": a.rationale,
                        "guideline": a.guideline,
                    }.items() if v is not None
                }
                for a in self.alternatives
            ],
            "dose_limits": [
                {
                    "substance": d.substance,
                    "condition": d.condition,
                    "dose_category": d.dose_category,
                    "strength": d.strength,
                    "rationale": d.rationale,
                    "guideline": d.guideline,
                }
                for d in self.dose_limits
            ],
            "consistency_violations": [
                {
                    k: v for k, v in {
                        "type": v.type,
                        "condition": v.condition,
                        "required_action": v.required_action,
                        "proposed_action": v.proposed_action,
                        "explanation": v.explanation,
                    }.items() if v is not None
                }
                for v in self.consistency_violations
            ],
            "required_actions": [
                {
                    "action": r.action,
                    "condition": r.condition,
                    "satisfied": r.satisfied,
                    "rationale": r.rationale,
                    "guideline": r.guideline,
                }
                for r in self.required_actions
            ],
            "process_trace": self.process_trace,
            "lean_proof_id": self.lean_proof_id,
        }
