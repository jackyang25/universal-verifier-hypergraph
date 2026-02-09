"""
Safety verification module.

Checks if proposed clinical actions are safe based on:
- Patient conditions (from conformal prediction set)
- Clinical protocols (from protocols/)
- Protocol-linked proofs (built from ontology axioms)

Main entry point: SafetyVerifier
"""

from verification.verifier import SafetyVerifier
from verification.certificate import VerificationCertificate, VerificationStatus

__all__ = [
    "SafetyVerifier",
    "VerificationCertificate",
    "VerificationStatus",
]
