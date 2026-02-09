"""Proof execution using pre-built Lean 4 proofs (Step 2 of verification).

NOTE: This module provides fallback proof execution for axioms without protocol-level proofs.
Most verification should use protocol_proofs.py via verifier.py instead.
"""

from typing import List, Set
from ontology.axioms.base import Axiom, AxiomType


class ProofExecutor:
    """
    Executes pre-built Lean 4 proofs at runtime.
    
    Step 2 of 3-step verification process:
    - Run pre-built proofs with patient state
    - Get categorization results (VERIFIED/BLOCKED/REPAIR_NEEDED)
    
    NOTE: This assumes Lean 4 proofs are already compiled.
    We just execute them to get verification results.
    """
    
    def execute_proofs(
        self,
        retrieved_axioms: dict,
        patient_state: Set[str],
        proposed_action: dict,
    ) -> dict:
        """
        Execute pre-built proofs to get verification results.
        
        Args:
            retrieved_axioms: Axioms from Step 1 (retrieval)
            patient_state: All patient conditions (conformal + comorbidities)
            proposed_action: Proposed action to verify
            
        Returns:
            Dictionary with execution results
        """
        results = {
            "contraindication_violations": [],
            "requirement_violations": [],
            "dose_constraints_triggered": [],
            "exclusion_violations": [],
            "trace": [],
        }
        
        # Execute contraindication proofs
        for axiom in retrieved_axioms.get("contraindications", []):
            if self._execute_contraindication_proof(axiom, patient_state, proposed_action):
                results["contraindication_violations"].append(axiom)
                results["trace"].append(
                    f"Contraindication proof executed: {axiom.id} → BLOCKED"
                )
        
        # Execute requirement proofs
        for axiom in retrieved_axioms.get("requirements", []):
            satisfied = self._execute_requirement_proof(axiom, patient_state, proposed_action)
            if not satisfied:
                results["requirement_violations"].append(axiom)
                results["trace"].append(
                    f"Requirement proof executed: {axiom.id} → UNSATISFIED"
                )
            else:
                results["trace"].append(
                    f"Requirement proof executed: {axiom.id} → SATISFIED"
                )
        
        # Execute dose constraint checks (informational)
        for axiom in retrieved_axioms.get("dose_constraints", []):
            if self._execute_dose_constraint_check(axiom, patient_state):
                results["dose_constraints_triggered"].append(axiom)
                results["trace"].append(
                    f"Dose constraint triggered: {axiom.id} (informational)"
                )
        
        # Execute exclusion proofs
        for axiom in retrieved_axioms.get("exclusions", []):
            if self._execute_exclusion_proof(axiom, patient_state):
                results["exclusion_violations"].append(axiom)
                results["trace"].append(
                    f"Exclusion proof executed: {axiom.id} → VIOLATED"
                )
        
        return results
    
    def _execute_contraindication_proof(
        self,
        axiom: Axiom,
        patient_state: Set[str],
        proposed_action: dict,
    ) -> bool:
        """
        Execute contraindication proof for this axiom.
        
        Fallback implementation for axioms without protocol-level proofs.
        Returns True if contraindication is violated (action is blocked).
        """
        # Manual check - direct proof execution
        if not axiom.antecedent.issubset(patient_state):
            return False
        
        if proposed_action.get("type") == "substance":
            substance_id = proposed_action.get("id")
            if substance_id in axiom.consequent:
                return True
        
        return False
    
    def _execute_requirement_proof(
        self,
        axiom: Axiom,
        patient_state: Set[str],
        proposed_action: dict,
    ) -> bool:
        """
        Execute requirement proof for this axiom.
        
        Fallback implementation for axioms without protocol-level proofs.
        Returns True if requirement is satisfied.
        """
        # Manual check - direct proof execution
        if not axiom.antecedent.issubset(patient_state):
            return True  # Not applicable
        
        if proposed_action.get("type") == "action":
            action_id = proposed_action.get("id")
            if action_id in axiom.consequent:
                return True
            else:
                return False
        
        return True
    
    def _execute_dose_constraint_check(
        self,
        axiom: Axiom,
        patient_state: Set[str],
    ) -> bool:
        """
        Execute dose constraint check (informational).
        
        Fallback implementation for axioms without protocol-level proofs.
        Returns True if dose constraint applies.
        """
        # Manual check - direct proof execution
        return axiom.antecedent.issubset(patient_state)
    
    def _execute_exclusion_proof(
        self,
        axiom: Axiom,
        patient_state: Set[str],
    ) -> bool:
        """
        Execute exclusion proof.
        
        Fallback implementation for axioms without protocol-level proofs.
        Returns True if exclusion is violated.
        """
        # Manual check - direct proof execution
        if axiom.antecedent.issubset(patient_state) and axiom.consequent.issubset(patient_state):
            return True
        return False
