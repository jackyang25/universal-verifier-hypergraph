"""Certificate generation from proof execution results (Step 3 of verification)."""

from typing import List, Dict, Set
from ontology.bridge import OntologyBridge
from ontology.axioms.base import Axiom
from ontology.types import RelationType
from verification.certificate import (
    VerificationCertificate,
    VerificationStatus,
    Contraindication,
    Alternative,
    DoseLimit,
    ConsistencyViolation,
    RequiredAction,
)


class CertificateGenerator:
    """
    Generates verification certificates from proof execution results.
    
    Step 3 of 3-step verification process:
    - Generate certificate with 7 required components
    - Add physiology-based rationale + guideline citations
    - Query guideline graph for alternatives if blocked
    """
    
    def __init__(self, bridge: OntologyBridge):
        self.bridge = bridge
    
    def generate_certificate(
        self,
        proof_results: dict,
        conformal_set: List[str],
        proposed_action: dict,
        patient_context: dict,
        retrieval_trace: List[str],
        execution_trace: List[str],
    ) -> VerificationCertificate:
        """Generate verification certificate from proof execution results."""
        
        process_trace = []
        process_trace.extend(retrieval_trace)
        process_trace.extend(execution_trace)
        
        # Determine verification status
        has_contraindications = len(proof_results["contraindication_violations"]) > 0
        has_requirement_violations = len(proof_results["requirement_violations"]) > 0
        has_exclusions = len(proof_results["exclusion_violations"]) > 0
        
        if has_contraindications or has_exclusions:
            status = VerificationStatus.BLOCKED
        elif has_requirement_violations:
            status = VerificationStatus.REPAIR_NEEDED
        else:
            status = VerificationStatus.VERIFIED
        
        # Build certificate
        certificate = VerificationCertificate(verification_status=status)
        
        # 1. Add contraindications
        for axiom in proof_results["contraindication_violations"]:
            contraindication = self._build_contraindication(
                axiom, proposed_action, patient_context
            )
            certificate.contraindications.append(contraindication)
        
        # 2. Add alternatives (if blocked)
        if status == VerificationStatus.BLOCKED and proposed_action.get("type") == "substance":
            alternatives = self._query_alternatives(
                conformal_set, proposed_action, patient_context
            )
            certificate.alternatives.extend(alternatives)
            if alternatives:
                process_trace.append(
                    f"Queried alternatives: found {len(alternatives)} options"
                )
        
        # 3. Add dose limits (informational)
        for axiom in proof_results["dose_constraints_triggered"]:
            dose_limit = self._build_dose_limit(axiom, patient_context)
            certificate.dose_limits.append(dose_limit)
        
        # 4. Add consistency violations
        for axiom in proof_results["exclusion_violations"]:
            violation = ConsistencyViolation(
                type="mutual_exclusion",
                explanation=f"Mutually exclusive conditions: {sorted(axiom.antecedent)} and {sorted(axiom.consequent)}"
            )
            certificate.consistency_violations.append(violation)
        
        # 5. Add required actions
        if proposed_action.get("type") == "action":
            for condition in conformal_set:
                required = self._build_required_actions(
                    condition, proposed_action, proof_results
                )
                certificate.required_actions.extend(required)
        
        # 6. Add requirement violations to consistency
        for axiom in proof_results["requirement_violations"]:
            violation = ConsistencyViolation(
                type="requirement_not_satisfied",
                condition=list(axiom.antecedent)[0] if axiom.antecedent else None,
                required_action=list(axiom.consequent)[0] if axiom.consequent else None,
                proposed_action=proposed_action.get("id"),
                explanation="Disjunction proof failed: action must be safe for ALL members of conformal set"
            )
            certificate.consistency_violations.append(violation)
        
        # 7. Add process trace
        certificate.process_trace = process_trace
        
        # Add lean proof reference
        if certificate.contraindications:
            certificate.lean_proof_id = f"axiom_{certificate.contraindications[0].substance}_{certificate.contraindications[0].condition}"
        elif certificate.required_actions:
            conditions = "_".join([r.condition for r in certificate.required_actions[:2]])
            certificate.lean_proof_id = f"disjunction_proof_{conditions}_{proposed_action.get('id')}"
        
        return certificate
    
    def _build_contraindication(
        self,
        axiom: Axiom,
        proposed_action: dict,
        patient_context: dict,
    ) -> Contraindication:
        """Build contraindication component with physiology-based rationale."""
        substance_id = proposed_action.get("id", "")
        condition_id = list(axiom.antecedent)[0] if axiom.antecedent else ""
        
        substance = self.bridge.registry.get_entity(substance_id)
        condition = self.bridge.registry.get_entity(condition_id)
        
        # Get relation for detailed evidence
        relations = self.bridge.registry.get_outgoing_relations(substance_id)
        evidence = axiom.evidence or "Clinical contraindication"
        strength = "absolute"
        
        for rel in relations:
            if rel.target_id == condition_id:
                evidence = rel.evidence or evidence
                strength = rel.strength or strength
                break
        
        return Contraindication(
            substance=substance.name if substance else substance_id,
            condition=condition.name if condition else condition_id,
            strength=strength,
            rationale=evidence,
            guideline="ACOG Practice Bulletin 222 (2020), Section 4.2"  # TODO: Make dynamic
        )
    
    def _build_dose_limit(
        self,
        axiom: Axiom,
        patient_context: dict,
    ) -> DoseLimit:
        """Build dose limit component (informational)."""
        substance_id = list(axiom.consequent)[0] if axiom.consequent else ""
        condition_id = list(axiom.antecedent)[0] if axiom.antecedent else ""
        
        substance = self.bridge.registry.get_entity(substance_id)
        condition = self.bridge.registry.get_entity(condition_id)
        
        return DoseLimit(
            substance=substance.name if substance else substance_id,
            condition=condition.name if condition else condition_id,
            dose_category=axiom.dose_category or "restricted",
            strength="strong",
            rationale=axiom.evidence or "Dose adjustment required for safety",
            guideline="ACOG Practice Bulletin 222 (2020)"
        )
    
    def _query_alternatives(
        self,
        conformal_set: List[str],
        proposed_action: dict,
        patient_context: dict,
    ) -> List[Alternative]:
        """Query guideline graph for alternative substances."""
        alternatives = []
        
        # Get safe treatments for conformal set
        conditions = set(conformal_set)
        safe_treatments = self.bridge.get_safe_treatments(conditions)
        
        # Get comorbidities
        comorbidities = set(patient_context.get("comorbidities", []))
        contraindicated = set(e.id for e in self.bridge.get_contraindicated_substances(comorbidities))
        
        # Filter to non-contraindicated alternatives
        for treatment in safe_treatments:
            if treatment.id not in contraindicated:
                alternatives.append(
                    Alternative(
                        substance=treatment.name,
                        dose="Per ACOG guidelines",  # TODO: Add specific dosing
                        rationale=f"Treats {', '.join(conformal_set)} without contraindications",
                        guideline="ACOG Practice Bulletin 222 (2020), Section 4.2.1"
                    )
                )
        
        # Add hardcoded alternatives for common cases (TODO: Make dynamic)
        if proposed_action.get("id") == "labetalol":
            alternatives.extend([
                Alternative(
                    substance="Hydralazine",
                    dose="5-10mg IV bolus, repeat q20min PRN (max 30mg)",
                    rationale="Direct vasodilator, no bronchial effects",
                    guideline="ACOG Practice Bulletin 222 (2020), Section 4.2.1"
                ),
                Alternative(
                    substance="Nifedipine",
                    dose="10mg PO immediate release, repeat q20min PRN (max 50mg)",
                    rationale="Calcium channel blocker, safe in asthma",
                    guideline="ACOG Practice Bulletin 222 (2020), Section 4.2.1"
                ),
            ])
        
        return alternatives
    
    def _build_required_actions(
        self,
        condition: str,
        proposed_action: dict,
        proof_results: dict,
    ) -> List[RequiredAction]:
        """Build required action components."""
        required = []
        
        # Check if condition requires the proposed action
        relations = self.bridge.registry.get_outgoing_relations(condition)
        
        for rel in relations:
            if rel.relation_type == RelationType.REQUIRES:
                action_id = proposed_action.get("id")
                satisfied = action_id == rel.target_id
                
                condition_entity = self.bridge.registry.get_entity(condition)
                action_entity = self.bridge.registry.get_entity(rel.target_id)
                
                required.append(
                    RequiredAction(
                        action=action_entity.name if action_entity else rel.target_id,
                        condition=condition_entity.name if condition_entity else condition,
                        satisfied=satisfied,
                        rationale=rel.evidence or f"{condition} requires {rel.target_id}",
                        guideline="ACOG Practice Bulletin 222 (2020)"
                    )
                )
        
        return required
