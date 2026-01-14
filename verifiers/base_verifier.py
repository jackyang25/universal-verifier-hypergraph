"""Base verifier class for protocol verification."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Set, Optional, List


@dataclass
class VerificationResult:
    """Result of protocol verification."""

    protocol_id: str
    protocol_name: str
    version: str
    status: str  # "proved" | "failed" | "warning" | "missing_interaction"
    message: Optional[str] = None

    # LEAN-specific outputs
    lean_code: Optional[str] = None
    proof_output: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Verification details
    verifications_passed: List[str] = field(default_factory=list)
    verifications_failed: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "protocol_id": self.protocol_id,
            "protocol_name": self.protocol_name,
            "version": self.version,
            "status": self.status,
            "message": self.message,
            "lean_code": self.lean_code,
            "proof_output": self.proof_output,
            "errors": self.errors,
            "warnings": self.warnings,
            "verifications_passed": self.verifications_passed,
            "verifications_failed": self.verifications_failed,
        }


@dataclass
class MissingInteractionWarning:
    """Warning for missing interaction protocol."""

    conditions: Set[str]
    message: str
    activated_protocols: List[str]
    missing_interaction_for: List[str]

    def to_verification_result(self) -> VerificationResult:
        """Convert to a VerificationResult."""
        return VerificationResult(
            protocol_id="missing_interaction",
            protocol_name="Missing Interaction Protocol",
            version="N/A",
            status="warning",
            message=self.message,
            warnings=[
                f"No interaction protocol found for conditions: {sorted(self.missing_interaction_for)}",
                f"Only activated: {', '.join(self.activated_protocols)}"
            ]
        )


class BaseVerifier(ABC):
    """Abstract base class for protocol verifiers."""

    def __init__(self, protocol_id: str, guideline_path: Optional[str] = None):
        """
        Initialize verifier.

        Args:
            protocol_id: ID of protocol to verify
            guideline_path: Optional path to guideline YAML file
        """
        self.protocol_id = protocol_id
        self.guideline_path = guideline_path

    @abstractmethod
    def verify(self, patient_conditions: Set[str], **kwargs) -> VerificationResult:
        """
        Execute verification for this protocol.

        Args:
            patient_conditions: Set of patient conditions
            **kwargs: Additional verification parameters

        Returns:
            VerificationResult with verification status and details
        """
        pass

    @abstractmethod
    def translate_to_lean(self) -> str:
        """
        Translate guideline to LEAN code.

        Returns:
            LEAN 4 code as string
        """
        pass


def check_missing_interactions(
    patient_conditions: Set[str],
    activated_protocols: List[dict]
) -> Optional[MissingInteractionWarning]:
    """
    Check if there should be an interaction protocol for multiple conditions.

    This detects when a patient has multiple conditions (2+) but no specific
    interaction protocol exists to handle the combination.

    Args:
        patient_conditions: Set of patient conditions
        activated_protocols: List of activated protocol dictionaries

    Returns:
        MissingInteractionWarning if interaction is missing, None otherwise
    """
    # Only check if patient has 2+ conditions
    if len(patient_conditions) < 2:
        return None

    # Get all activated protocol conditions
    activated_condition_sets = []
    for protocol in activated_protocols:
        protocol_conditions = set(protocol.get("conditions", []))
        activated_condition_sets.append(protocol_conditions)

    # Check if there's an interaction protocol for the full condition set
    has_full_interaction = any(
        cond_set == patient_conditions
        for cond_set in activated_condition_sets
    )

    if has_full_interaction:
        return None  # Full interaction protocol exists

    # Find largest interaction protocol (most conditions)
    max_interaction_size = max(
        (len(cond_set) for cond_set in activated_condition_sets if len(cond_set) > 1),
        default=1
    )

    # If no multi-condition protocols activated, flag warning
    if max_interaction_size == 1:
        return MissingInteractionWarning(
            conditions=patient_conditions,
            message=f"No interaction protocol found for {len(patient_conditions)} conditions: {sorted(patient_conditions)}",
            activated_protocols=[p["id"] for p in activated_protocols],
            missing_interaction_for=sorted(patient_conditions)
        )

    # If largest interaction is smaller than patient conditions, flag partial coverage
    if max_interaction_size < len(patient_conditions):
        return MissingInteractionWarning(
            conditions=patient_conditions,
            message=f"Partial interaction coverage: largest protocol handles {max_interaction_size}/{len(patient_conditions)} conditions",
            activated_protocols=[p["id"] for p in activated_protocols],
            missing_interaction_for=sorted(patient_conditions)
        )

    return None
