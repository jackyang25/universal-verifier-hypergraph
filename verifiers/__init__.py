"""
Clinical Protocol Verification System using LEAN 4.

This package provides formal verification of clinical protocols using
the LEAN theorem prover to ensure logical consistency and safety.
"""

__version__ = "1.0.0"

from verifiers.base_verifier import BaseVerifier, VerificationResult
from verifiers.lean_executor import LeanExecutor
from verifiers.lean_translator import LeanTranslator

__all__ = [
    "BaseVerifier",
    "VerificationResult",
    "LeanExecutor",
    "LeanTranslator",
]
