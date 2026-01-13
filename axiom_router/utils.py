"""Utility functions for axiom router."""

from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from axiom_router.axiom_pack import AxiomPack
    from axiom_router.hypergraph import AxiomRouter


def normalize_conditions(conditions: Iterable[str]) -> frozenset[str]:
    """
    Normalize a collection of conditions to a frozenset.
    
    Handles various input types and ensures consistent format.
    
    Args:
        conditions: Iterable of condition strings
        
    Returns:
        Normalized frozenset of conditions
        
    Raises:
        ValueError: If conditions is empty or contains empty strings
    """
    result = frozenset(c.strip() for c in conditions if c and c.strip())
    
    if not result:
        raise ValueError("Conditions cannot be empty")
    
    return result


def find_interaction_packs(router: "AxiomRouter") -> list["AxiomPack"]:
    """
    Find all interaction packs (packs requiring multiple conditions).
    
    Args:
        router: AxiomRouter to search
        
    Returns:
        List of axiom packs that are interaction packs
    """
    return [pack for pack in router.iter_packs() if pack.is_interaction_pack]


def find_packs_for_condition(router: "AxiomRouter", condition: str) -> list["AxiomPack"]:
    """
    Find all packs that include a specific condition.
    
    Args:
        router: AxiomRouter to search
        condition: Condition to search for
        
    Returns:
        List of axiom packs containing the condition
    """
    return [
        pack for pack in router.iter_packs() 
        if condition in pack.conditions
    ]


def validate_patient_conditions(conditions: set[str]) -> list[str]:
    """
    Validate a set of patient conditions.
    
    Returns a list of validation errors (empty if valid).
    
    Args:
        conditions: Set of patient conditions to validate
        
    Returns:
        List of validation error messages
    """
    errors: list[str] = []
    
    if not conditions:
        errors.append("Patient conditions cannot be empty")
        return errors
    
    for condition in conditions:
        if not condition:
            errors.append("Empty condition found")
        elif not isinstance(condition, str):
            errors.append(f"Condition must be string, got {type(condition).__name__}")
        elif condition != condition.strip():
            errors.append(f"Condition '{condition}' has leading/trailing whitespace")
    
    return errors


def compute_coverage(
    router: "AxiomRouter", 
    patient_conditions: set[str]
) -> dict:
    """
    Compute coverage statistics for a patient's conditions.
    
    Args:
        router: AxiomRouter to analyze
        patient_conditions: Set of patient conditions
        
    Returns:
        Dictionary with coverage statistics
    """
    activated = router.match(patient_conditions)
    
    # find conditions that don't match any pack
    all_pack_conditions = router.conditions
    unrecognized = patient_conditions - all_pack_conditions
    recognized = patient_conditions & all_pack_conditions
    
    return {
        "total_patient_conditions": len(patient_conditions),
        "recognized_conditions": len(recognized),
        "unrecognized_conditions": sorted(unrecognized),
        "activated_packs": len(activated),
        "activated_pack_ids": [p.id for p in activated],
        "interaction_packs_activated": sum(1 for p in activated if p.is_interaction_pack),
    }


def diff_routers(router_a: "AxiomRouter", router_b: "AxiomRouter") -> dict:
    """
    Compare two router configurations.
    
    Args:
        router_a: First router
        router_b: Second router
        
    Returns:
        Dictionary describing differences
    """
    packs_a = {p.id: p for p in router_a.iter_packs()}
    packs_b = {p.id: p for p in router_b.iter_packs()}
    
    ids_a = set(packs_a.keys())
    ids_b = set(packs_b.keys())
    
    added = ids_b - ids_a
    removed = ids_a - ids_b
    common = ids_a & ids_b
    
    modified = []
    for pack_id in common:
        if packs_a[pack_id].to_dict() != packs_b[pack_id].to_dict():
            modified.append(pack_id)
    
    return {
        "added": sorted(added),
        "removed": sorted(removed),
        "modified": sorted(modified),
        "unchanged": sorted(common - set(modified)),
    }
