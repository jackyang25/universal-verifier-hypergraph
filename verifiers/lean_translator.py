"""Translate clinical guidelines to LEAN 4 code."""

from pathlib import Path
from typing import Dict, List, Optional, Set
import yaml


class LeanTranslator:
    """Translates clinical guidelines (YAML) into LEAN 4 theorem code."""

    def __init__(self):
        """Initialize translator."""
        self.lean_header = """-- Auto-generated LEAN 4 verification code
-- Protocol Verification System

-- Basic types for protocol verification
structure Condition where
  name : String
  deriving Repr, DecidableEq

structure Protocol where
  id : String
  name : String
  conditions : List String
  deriving Repr

-- Patient state
structure PatientState where
  conditions : List String
  deriving Repr

-- Helper: Check if all elements of a list are in another list
def all_in (xs : List String) (ys : List String) : Bool :=
  xs.all (fun x => ys.contains x)

-- Protocol activation predicate
def protocol_activates (p : Protocol) (patient : PatientState) : Prop :=
  all_in p.conditions patient.conditions = true

"""

    def load_guideline(self, guideline_path: Path) -> dict:
        """
        Load guideline YAML file.

        Args:
            guideline_path: Path to guideline YAML

        Returns:
            Parsed guideline dictionary
        """
        with open(guideline_path, 'r') as f:
            return yaml.safe_load(f)

    def translate_guideline_to_lean(self, guideline: dict, protocol_id: str) -> str:
        """
        Translate a guideline to LEAN 4 code with 2 verification types.

        Args:
            guideline: Guideline dictionary
            protocol_id: Protocol identifier

        Returns:
            LEAN 4 code as string
        """
        lean_code = self.lean_header

        # Add protocol definition
        lean_code += self._generate_protocol_definition(guideline, protocol_id)

        # Verification Type 1: Protocol Activation Logic
        lean_code += self._generate_activation_verification(guideline, protocol_id)

        # Verification Type 2: Mutual Exclusion
        if "exclusions" in guideline:
            lean_code += self._generate_mutual_exclusion(guideline, protocol_id)

        return lean_code

    def _generate_protocol_definition(self, guideline: dict, protocol_id: str) -> str:
        """Generate LEAN protocol definition."""
        protocol_name = guideline.get("name", protocol_id)
        conditions = guideline.get("activation", {}).get("requires_all", [])

        conditions_str = ", ".join(f'"{c}"' for c in conditions)

        return f"""
-- Protocol definition for {protocol_name}
def {protocol_id}_protocol : Protocol := {{
  id := "{protocol_id}",
  name := "{protocol_name}",
  conditions := [{conditions_str}]
}}

"""

    def _generate_activation_verification(self, guideline: dict, protocol_id: str) -> str:
        """
        Generate LEAN theorem for activation logic verification.

        Verifies: Protocol activates IFF all required conditions are present.
        """
        conditions = guideline.get("activation", {}).get("requires_all", [])

        # Build condition conjunction using List.contains
        condition_checks = " ∧ ".join(f'patient.conditions.contains "{c}"' for c in conditions)

        return f"""
-- Verification Type 1: Protocol Activation Logic
-- Theorem: Protocol activates if and only if all conditions are present
theorem {protocol_id}_activation_correctness (patient : PatientState) :
  protocol_activates {protocol_id}_protocol patient ↔ ({condition_checks}) := by
  -- Proof admitted for demonstration purposes
  -- In production, this would contain formal proof tactics
  sorry

"""

    def _generate_mutual_exclusion(self, guideline: dict, protocol_id: str) -> str:
        """
        Generate LEAN theorem for mutual exclusion verification.

        Verifies: Incompatible conditions cannot coexist.
        """
        exclusions = guideline.get("exclusions", [])
        if not exclusions:
            return ""

        lean_code = "-- Verification Type 2: Mutual Exclusion\n"

        for idx, exclusion in enumerate(exclusions):
            excluded_conditions = exclusion.get("cannot_coexist_with", [])
            reason = exclusion.get("reason", "Logical incompatibility")

            if not excluded_conditions:
                continue

            protocol_conditions = guideline.get("activation", {}).get("requires_all", [])

            for excl_cond in excluded_conditions:
                lean_code += f"""
-- Mutual exclusion: {reason}
theorem {protocol_id}_exclusion_{idx}_{excl_cond.replace('_', '')} (patient : PatientState) :
  protocol_activates {protocol_id}_protocol patient →
  ¬(patient.conditions.contains "{excl_cond}") := by
  -- Proof admitted for demonstration purposes
  -- This would require domain-specific axioms about condition incompatibility
  sorry

"""

        return lean_code

    def translate_from_file(self, guideline_path: Path, protocol_id: str) -> str:
        """
        Load guideline from file and translate to LEAN.

        Args:
            guideline_path: Path to guideline YAML
            protocol_id: Protocol identifier

        Returns:
            LEAN 4 code as string
        """
        guideline = self.load_guideline(guideline_path)
        return self.translate_guideline_to_lean(guideline, protocol_id)

    def save_lean_file(self, lean_code: str, output_path: Path) -> None:
        """
        Save generated LEAN code to file.

        Args:
            lean_code: LEAN 4 code string
            output_path: Path to save .lean file
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(lean_code)
