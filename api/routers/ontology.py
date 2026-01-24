"""Ontology API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_ontology_bridge_dependency
from api.models import SafetyCheckRequest, SafetyCheckResponse, OntologyStatusResponse

router = APIRouter()


@router.post("/check", response_model=SafetyCheckResponse)
def check_safety(
    request: SafetyCheckRequest,
    ontology_bridge: Optional["OntologyBridge"] = Depends(get_ontology_bridge_dependency),
):
    """
    Check safety for given patient conditions.
    
    Returns:
    - Contraindicated substances
    - Safe treatment options
    - Consistency violations (invalid condition combinations)
    """
    if not ontology_bridge:
        return SafetyCheckResponse(
            available=False,
            contraindicated_substances=[],
            safe_treatments=[],
            consistency_violations=[],
            conditions_checked=request.conditions,
        )
    
    conditions = set(request.conditions)
    
    # Validate conditions exist
    valid, invalid = ontology_bridge.validate_conditions(conditions)
    if not valid:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown conditions: {invalid}"
        )
    
    # Check consistency
    violations = ontology_bridge.check_consistency(conditions)
    
    # Get contraindicated substances
    contraindicated = ontology_bridge.get_contraindicated_substances(conditions)
    contraindicated_data = [
        {
            "id": entity.id,
            "name": entity.name,
            "reason": ontology_bridge.get_contraindication_reason(entity.id, conditions),
        }
        for entity in contraindicated
    ]
    
    # Get safe treatments
    safe = ontology_bridge.get_safe_treatments(conditions)
    safe_data = [
        {
            "id": entity.id,
            "name": entity.name,
            "indication": ontology_bridge.get_treatment_indication(entity.id, conditions),
        }
        for entity in safe
    ]
    
    return SafetyCheckResponse(
        available=True,
        contraindicated_substances=contraindicated_data,
        safe_treatments=safe_data,
        consistency_violations=violations,
        conditions_checked=sorted(conditions),
    )


@router.get("/status", response_model=OntologyStatusResponse)
def get_ontology_status(
    ontology_bridge: Optional["OntologyBridge"] = Depends(get_ontology_bridge_dependency),
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
