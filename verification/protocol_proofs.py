"""
Protocol proof executables.

Each protocol has a linked proof that:
- Takes retrieved axioms + patient_state + proposed_action
- Returns verification result
"""

from typing import List, Set
from ontology.axioms.base import Axiom


def proof_drug_comorbidity_safety(
    axioms: List[Axiom],
    patient_state: Set[str],
    proposed_action: dict,
) -> dict:
    """
    Protocol proof: Drug-comorbidity contraindication check.
    
    Input:
    - axioms: Retrieved contraindication axioms
    - patient_state: All patient conditions (conformal + comorbidities)
    - proposed_action: Proposed drug
    
    Output:
    - violations: List of violated axioms
    - result: "VERIFIED" or "BLOCKED"
    
    Lean 4 equivalent (pre-built):
    theorem drug_comorbidity_safety :
      ∀ (p : Patient) (drug : Substance),
        (∃ (condition : Condition), 
          p.has_condition condition ∧ 
          contraindicated drug condition) →
        ¬ safe_action p (administer drug)
    """
    violations = []
    substance_id = proposed_action.get("id", "")
    
    # Check each contraindication axiom
    for axiom in axioms:
        # Check if antecedent (condition) is in patient state
        if not axiom.antecedent.issubset(patient_state):
            continue
        
        # Check if proposed drug is in consequent
        if substance_id in axiom.consequent:
            violations.append(axiom)
    
    return {
        "violations": violations,
        "result": "BLOCKED" if violations else "VERIFIED"
    }


def proof_delivery_timing_conformal(
    axioms: List[Axiom],
    patient_state: Set[str],
    proposed_action: dict,
) -> dict:
    """
    Protocol proof: Delivery timing verification across conformal set.
    
    Input:
    - axioms: Retrieved requirement axioms
    - patient_state: All conditions in conformal set
    - proposed_action: Proposed delivery action
    
    Output:
    - satisfied_requirements: List of satisfied requirement axioms
    - unsatisfied_requirements: List of unsatisfied requirement axioms
    - result: "VERIFIED" or "REPAIR_NEEDED"
    
    Lean 4 equivalent (disjunction proof, pre-built):
    theorem delivery_timing_conformal :
      ∀ (p : Patient) (conditions : Set Condition) (action : Action),
        (∀ c ∈ conditions, requires c action) →
        safe_action p action
    """
    satisfied = []
    unsatisfied = []
    action_id = proposed_action.get("id", "")
    
    # Check each requirement axiom
    for axiom in axioms:
        # Check if antecedent (condition) is in patient state
        if not axiom.antecedent.issubset(patient_state):
            continue
        
        # Check if proposed action satisfies requirement
        if action_id in axiom.consequent:
            satisfied.append(axiom)
        else:
            unsatisfied.append(axiom)
    
    return {
        "satisfied_requirements": satisfied,
        "unsatisfied_requirements": unsatisfied,
        "result": "REPAIR_NEEDED" if unsatisfied else "VERIFIED"
    }


# Protocol proof registry
PROTOCOL_PROOF_REGISTRY = {
    "proof_drug_comorbidity_safety": proof_drug_comorbidity_safety,
    "proof_delivery_timing_conformal": proof_delivery_timing_conformal,
}


def get_protocol_proof(proof_link: str):
    """Get protocol proof function."""
    return PROTOCOL_PROOF_REGISTRY.get(proof_link)
