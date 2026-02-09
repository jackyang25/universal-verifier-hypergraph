"""Ontology API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_ontology_bridge_dependency, get_protocol_router_dependency
from api.models import (
    SafetyCheckRequest, 
    SafetyCheckResponse, 
    OntologyStatusResponse,
    AllEntitiesResponse,
    EntityCategory,
    EntityResponse,
)
from ontology.bridge import OntologyBridge
from protocols import ProtocolRouter
from verification import SafetyVerifier

router = APIRouter()


@router.post("/check", response_model=SafetyCheckResponse)
def check_safety(
    request: SafetyCheckRequest,
    ontology_bridge: Optional[OntologyBridge] = Depends(get_ontology_bridge_dependency),
):
    """
    Verify proposed action against conformal set and patient context.
    
    **Input:**
    - `conformal_set`: List of uncertain diagnoses from conformal prediction
      (e.g., ["hellp_syndrome", "aflp"])
    - `proposed_action`: Action to verify (type: "substance" or "action", id, dose)
      (e.g., {"type": "substance", "id": "labetalol", "dose": "20mg IV"})
    - `patient_context`: Known patient conditions (comorbidities, ga_weeks, physiologic_states)
      (e.g., {"comorbidities": ["asthma"], "ga_weeks": 32})
    
    **Three-step verification process:**
    1. Protocol Matching & Axiom Retrieval - Query hypergraph for relevant axioms
    2. Protocol Proof Execution - Run protocol-linked proofs
    3. Certificate Generation - Return verification certificate with 7 components
    
    **Returns verification certificate with:**
    - verification_status (VERIFIED/BLOCKED/REPAIR_NEEDED)
    - contraindications (blocking violations with physiology-based rationale)
    - alternatives (repair guidance with dosing)
    - dose_limits (informational warnings)
    - consistency_violations (mutual exclusions)
    - required_actions (requirement satisfaction status)
    - process_trace (audit trail)
    """
    if not ontology_bridge:
        return SafetyCheckResponse(
            available=False,
            verification_status=None,
            conformal_set=request.conformal_set,
            proposed_action=request.proposed_action.dict(),
        )
    
    # Use SafetyVerifier for the 3-step safety check
    verifier = SafetyVerifier(ontology_bridge)
    
    try:
        # Run verification
        certificate = verifier.verify(
            conformal_set=request.conformal_set,
            proposed_action=request.proposed_action.dict(),
            patient_context=request.patient_context.dict() if request.patient_context else {},
        )
        
        # Convert certificate to dict (it has a to_dict() method)
        cert_dict = certificate.to_dict()
        
        # Return as API response
        return SafetyCheckResponse(
            available=True,
            verification_status=cert_dict["verification_status"],
            contraindications=cert_dict["contraindications"],
            alternatives=cert_dict["alternatives"],
            dose_limits=cert_dict["dose_limits"],
            consistency_violations=cert_dict["consistency_violations"],
            required_actions=cert_dict["required_actions"],
            process_trace=cert_dict["process_trace"],
            lean_proof_id=cert_dict["lean_proof_id"],
            conformal_set=request.conformal_set,
            proposed_action=request.proposed_action.dict(),
        )
    
    except Exception as e:
        # Handle verification errors gracefully
        return SafetyCheckResponse(
            available=True,
            verification_status="ERROR",
            process_trace=[f"Verification error: {str(e)}"],
            conformal_set=request.conformal_set,
            proposed_action=request.proposed_action.dict(),
        )


@router.get("/status", response_model=OntologyStatusResponse)
def get_ontology_status(
    ontology_bridge: Optional[OntologyBridge] = Depends(get_ontology_bridge_dependency),
):
    """Get ontology module availability status."""
    if not ontology_bridge:
        return OntologyStatusResponse(
            available=False,
            error="Ontology module not available or initialization failed",
        )
    
    summary = ontology_bridge.export_summary()
    return OntologyStatusResponse(
        available=True,
        entity_count=summary["schema"]["total_entities"],
        relation_count=summary["schema"]["total_relations"],
        axiom_count=summary["axiom_count"],
    )


@router.get("/entities", response_model=AllEntitiesResponse)
def get_all_entities(
    ontology_bridge: Optional[OntologyBridge] = Depends(get_ontology_bridge_dependency),
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """
    Get all ontology entities grouped by category.
    
    Returns all conditions a clinician can select, organized by type:
    - Disorders (diseases, conditions)
    - Physiologic States (pregnancy, age groups)
    - Findings (lab results, symptoms)
    
    Also indicates which conditions have associated protocols.
    """
    if not ontology_bridge:
        return AllEntitiesResponse(
            available=False,
            categories=[],
            total_entities=0,
            conditions_with_protocols=[],
        )
    
    # get conditions that have protocols
    conditions_with_protocols = set(protocol_router.conditions)
    
    # category display names
    category_names = {
        "disorder": "Disorders & Diseases",
        "physiologic_state": "Physiologic States",
        "finding": "Clinical Findings",
        "substance": "Substances & Medications",
        "action": "Clinical Actions",
    }
    
    # group entities by type (include all types)
    categories_data = {}
    for entity in ontology_bridge.registry.iter_entities():
        entity_type = entity.entity_type.value
            
        if entity_type not in categories_data:
            categories_data[entity_type] = []
        
        categories_data[entity_type].append(EntityResponse(
            id=entity.id,
            name=entity.name,
            entity_type=entity_type,
            description=entity.description or None,
            has_protocols=entity.id in conditions_with_protocols,
        ))
    
    # sort entities within each category
    for entities in categories_data.values():
        entities.sort(key=lambda e: e.name)
    
    # build response categories in preferred order
    category_order = ["disorder", "physiologic_state", "finding", "substance", "action"]
    categories = []
    for cat_type in category_order:
        if cat_type in categories_data:
            categories.append(EntityCategory(
                category=cat_type,
                display_name=category_names.get(cat_type, cat_type.replace("_", " ").title()),
                entities=categories_data[cat_type],
            ))
    
    # add any remaining categories
    for cat_type, entities in categories_data.items():
        if cat_type not in category_order:
            categories.append(EntityCategory(
                category=cat_type,
                display_name=category_names.get(cat_type, cat_type.replace("_", " ").title()),
                entities=entities,
            ))
    
    total = sum(len(cat.entities) for cat in categories)
    
    return AllEntitiesResponse(
        available=True,
        categories=categories,
        total_entities=total,
        conditions_with_protocols=sorted(conditions_with_protocols),
    )
