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
from protocols import ProtocolRouter

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
            dose_limits=[],
            drug_interactions=[],
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
    
    # Get dose limits
    dose_limits_dict = ontology_bridge.get_dose_limits(conditions)
    dose_limits_data = []
    
    # Category severity order (most restrictive first)
    category_severity = {
        "avoid_if_possible": 0,
        "severely_restricted": 1,
        "reduced": 2,
        "use_with_caution": 3,
        "standard": 4,
    }
    
    for substance_id, limits in dose_limits_dict.items():
        substance = ontology_bridge.registry.get_entity(substance_id)
        substance_name = substance.name if substance else substance_id
        
        # Find most restrictive category (exclude 'standard' as it means no restriction)
        categories = [l.get("dose_category") for l in limits if l.get("dose_category") and l.get("dose_category") != "standard"]
        if categories:
            most_restrictive = min(categories, key=lambda c: category_severity.get(c, 99))
            dose_limits_data.append({
                "id": substance_id,
                "name": substance_name,
                "category": most_restrictive,
                "limits": [l for l in limits if l.get("dose_category") != "standard"]
            })
    
    # Get drug-drug interactions between safe treatments
    safe_treatment_ids = set(entity.id for entity in safe)
    interactions = ontology_bridge.get_drug_interactions(safe_treatment_ids)
    
    return SafetyCheckResponse(
        available=True,
        contraindicated_substances=contraindicated_data,
        safe_treatments=safe_data,
        dose_limits=dose_limits_data,
        drug_interactions=interactions,
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


@router.get("/entities", response_model=AllEntitiesResponse)
def get_all_entities(
    ontology_bridge: Optional["OntologyBridge"] = Depends(get_ontology_bridge_dependency),
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
    }
    
    # group entities by type (exclude substances for condition selection)
    categories_data = {}
    for entity in ontology_bridge.registry.iter_entities():
        entity_type = entity.entity_type.value
        
        # skip substances - they're medications, not patient conditions
        if entity_type == "substance":
            continue
            
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
    category_order = ["disorder", "physiologic_state", "finding"]
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
