"""
Formal Verification Module

Provides formal verification of clinical protocols using LEAN 4.
Ensures logical consistency and safety through theorem proving.
"""

__version__ = "1.0.0"

from verification.base_verifier import BaseVerifier, VerificationResult
from verification.lean_executor import LeanExecutor
from verification.lean_translator import LeanTranslator

__all__ = [
    "BaseVerifier",
    "VerificationResult",
    "LeanExecutor",
    "LeanTranslator",
]
