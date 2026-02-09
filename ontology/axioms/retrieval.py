"""Axiom retrieval from ontology.

Queries the ontology for relevant axioms based on patient state and proposed action.
This is part of the ontology layer, NOT verification.
"""

from typing import Set, List
from ontology.bridge import OntologyBridge
from ontology.axioms.base import Axiom, AxiomType


class AxiomRetriever:
    """
    Retrieves relevant pre-built axioms for verification.
    
    Step 1 of 3-step verification process:
    - Query hypergraph for relevant axioms based on input
    - Axioms reference pre-built Lean 4 proofs
    """
    
    def __init__(self, bridge: OntologyBridge):
        self.bridge = bridge
        self.axioms = bridge.axioms
    
    def retrieve_for_verification(
        self,
        conformal_set: List[str],
        proposed_action: dict,
        patient_context: dict,
    ) -> dict:
        """
        Retrieve relevant axioms for verification.
        
        Args:
            conformal_set: List of possible diagnoses
            proposed_action: Proposed clinical action
            patient_context: Patient comorbidities and state
            
        Returns:
            Dictionary of retrieved axioms by category
        """
        trace = []
        
        # Expand conformal set with parent hierarchy
        expanded_conformal = set()
        for condition in conformal_set:
            expanded = self.bridge._get_condition_with_ancestors(condition)
            expanded_conformal.update(expanded)
            if expanded != {condition}:
                trace.append(f"Expanded {condition} → {sorted(expanded)}")
        
        # Get patient comorbidities
        comorbidities = set(patient_context.get("comorbidities", []))
        
        # Expand comorbidities with ancestors
        expanded_comorbidities = set()
        for condition in comorbidities:
            expanded = self.bridge._get_condition_with_ancestors(condition)
            expanded_comorbidities.update(expanded)
        
        # Retrieve axioms
        retrieved = {
            "contraindications": [],
            "requirements": [],
            "dose_constraints": [],
            "exclusions": [],
        }
        
        # Get contraindication axioms for comorbidities
        if proposed_action.get("type") == "substance":
            substance_id = proposed_action.get("id")
            for condition in expanded_comorbidities:
                axioms = self.axioms.get_contraindications_for_state(condition)
                for axiom in axioms:
                    if substance_id in axiom.consequent:
                        retrieved["contraindications"].append(axiom)
                        trace.append(
                            f"Retrieved contraindication axiom: {axiom.id}"
                        )
        
        # Get requirement axioms for conformal set
        if proposed_action.get("type") == "action":
            action_id = proposed_action.get("id")
            for condition in expanded_conformal:
                axioms = self.axioms.axiom_registry.get_by_type(AxiomType.REQUIREMENT)
                for axiom in axioms:
                    if condition in axiom.antecedent:
                        retrieved["requirements"].append(axiom)
                        trace.append(
                            f"Retrieved requirement axiom: {axiom.id}"
                        )
        
        # Get dose constraint axioms
        if proposed_action.get("type") == "substance":
            substance_id = proposed_action.get("id")
            for condition in expanded_comorbidities:
                axioms = self.axioms.get_dose_constraints_for_state(condition)
                for axiom in axioms:
                    if substance_id in axiom.consequent:
                        retrieved["dose_constraints"].append(axiom)
                        trace.append(
                            f"Retrieved dose constraint axiom: {axiom.id}"
                        )
        
        # Get exclusion axioms
        all_conditions = expanded_conformal | expanded_comorbidities
        for condition in all_conditions:
            axioms = self.axioms.get_exclusions_for_entity(condition)
            for axiom in axioms:
                if axiom not in retrieved["exclusions"]:
                    retrieved["exclusions"].append(axiom)
                    trace.append(f"Retrieved exclusion axiom: {axiom.id}")
        
        return {
            "axioms": retrieved,
            "trace": trace,
            "expanded_conformal": expanded_conformal,
            "expanded_comorbidities": expanded_comorbidities,
        }
