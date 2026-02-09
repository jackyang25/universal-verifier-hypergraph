"""Main safety verifier - runs proofs to categorize action safety."""

from typing import List, Dict
from ontology.bridge import OntologyBridge
from ontology.axioms.retrieval import AxiomRetriever
from protocols import ProtocolRouter
from verification.proof_execution import ProofExecutor
from verification.certificate_generator import CertificateGenerator
from verification.certificate import VerificationCertificate
from verification.protocol_proofs import get_protocol_proof


class SafetyVerifier:
    """
    Safety verifier - categorizes action safety by running protocol proofs.
    
    Flow:
    1. Ontology retrieves axioms for patient state + action
    2. Verification runs protocol proof (proof uses axioms) → Categorize
    3. Certificate generated with result
    
    Verification ONLY does:
    - Run proof with axioms
    - Categorize: VERIFIED | BLOCKED | REPAIR_NEEDED
    - Generate certificate
    """
    
    def __init__(self, bridge: OntologyBridge, protocol_router: ProtocolRouter = None):
        self.bridge = bridge
        self.protocol_router = protocol_router or ProtocolRouter()
        self.axiom_retriever = AxiomRetriever(bridge)  # Gets axioms from ontology
        self.proof_executor = ProofExecutor()
        self.certificate_generator = CertificateGenerator(bridge)
    
    def verify(
        self,
        conformal_set: List[str],
        proposed_action: dict,
        patient_context: dict,
    ) -> VerificationCertificate:
        """
        Verify safety of a clinical action.
        
        Args:
            conformal_set: List of possible diagnoses (uncertainty)
            proposed_action: {"type": "substance"|"action", "id": "...", "dose": "..."}
            patient_context: {"comorbidities": [...], "ga_weeks": ..., ...}
            
        Returns:
            Safety certificate with verification status
        """
        
        trace = []
        
        # STEP 1: AXIOM RETRIEVAL (from ontology)
        # Ontology retrieves relevant axioms for this patient state + action
        retrieval_result = self.axiom_retriever.retrieve_for_verification(
            conformal_set, proposed_action, patient_context
        )
        
        all_conditions = set(conformal_set)
        if patient_context:
            all_conditions.update(patient_context.get("comorbidities", []))
            all_conditions.update(patient_context.get("physiologic_states", []))
        
        matched_protocols = self.protocol_router.match(all_conditions)
        trace.append(f"Matched {len(matched_protocols)} protocols for conditions: {sorted(all_conditions)}")
        
        retrieved_axioms = retrieval_result["axioms"]
        retrieval_trace = retrieval_result["trace"]
        expanded_conformal = retrieval_result["expanded_conformal"]
        expanded_comorbidities = retrieval_result["expanded_comorbidities"]
        patient_state = expanded_conformal | expanded_comorbidities
        
        trace.extend(retrieval_trace)
        
        # STEP 2: PROOF EXECUTION (Categorize safety)
        # Run protocol's linked proof with axioms → Get category (VERIFIED/BLOCKED/REPAIR_NEEDED)
        all_proof_results = {
            "contraindication_violations": [],
            "requirement_violations": [],
            "dose_constraints_triggered": [],
            "exclusion_violations": [],
            "trace": [],
        }
        
        for protocol in matched_protocols:
            trace.append(f"Checking protocol: {protocol.name}")
            
            # Get protocol's linked proof (if it has one)
            if protocol.proof_file:
                # Map proof_file to actual proof function
                # For now, we use action type to determine which proof
                if proposed_action.get("type") == "substance":
                    proof_func = get_protocol_proof("proof_drug_comorbidity_safety")
                    if proof_func:
                        result = proof_func(
                            retrieved_axioms.get("contraindications", []),
                            patient_state,
                            proposed_action
                        )
                        all_proof_results["contraindication_violations"].extend(
                            result.get("violations", [])
                        )
                        trace.append(f"  Safety check result: {result.get('result')}")
                
                elif proposed_action.get("type") == "action":
                    proof_func = get_protocol_proof("proof_delivery_timing_conformal")
                    if proof_func:
                        result = proof_func(
                            retrieved_axioms.get("requirements", []),
                            patient_state,
                            proposed_action
                        )
                        all_proof_results["requirement_violations"].extend(
                            result.get("unsatisfied_requirements", [])
                        )
                        trace.append(f"  Safety check result: {result.get('result')}")
        
        # Also check dose constraints and exclusions (always run)
        dose_result = self.proof_executor.execute_proofs(
            {"dose_constraints": retrieved_axioms.get("dose_constraints", [])},
            patient_state,
            proposed_action
        )
        all_proof_results["dose_constraints_triggered"] = dose_result.get("dose_constraints_triggered", [])
        
        exclusion_result = self.proof_executor.execute_proofs(
            {"exclusions": retrieved_axioms.get("exclusions", [])},
            patient_state,
            proposed_action
        )
        all_proof_results["exclusion_violations"] = exclusion_result.get("exclusion_violations", [])
        
        all_proof_results["trace"] = trace
        
        # STEP 3: CERTIFICATE GENERATION
        # Package categorization result into certificate
        certificate = self.certificate_generator.generate_certificate(
            all_proof_results,
            conformal_set,
            proposed_action,
            patient_context,
            [],  # retrieval trace already in all_proof_results["trace"]
            [],  # execution trace already in all_proof_results["trace"]
        )
        
        certificate.process_trace = trace
        
        return certificate
