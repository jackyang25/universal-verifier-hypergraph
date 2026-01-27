"""Utility functions for protocol router."""

from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from protocols.protocol import Protocol
    from protocols.router import ProtocolRouter


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


def find_interaction_protocols(router: "ProtocolRouter") -> list["Protocol"]:
    """
    Find all interaction protocols (protocols requiring multiple conditions).
    
    Args:
        router: ProtocolRouter to search
        
    Returns:
        List of protocols that are interaction protocols
    """
    return [protocol for protocol in router.iter_protocols() if protocol.is_interaction_protocol]


def find_protocols_for_condition(router: "ProtocolRouter", condition: str) -> list["Protocol"]:
    """
    Find all protocols that include a specific condition.
    
    Args:
        router: ProtocolRouter to search
        condition: Condition to search for
        
    Returns:
        List of protocols containing the condition
    """
    return [
        protocol for protocol in router.iter_protocols() 
        if condition in protocol.conditions
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
    router: "ProtocolRouter", 
    patient_conditions: set[str]
) -> dict:
    """
    Compute coverage statistics for a patient's conditions.
    
    Args:
        router: ProtocolRouter to analyze
        patient_conditions: Set of patient conditions
        
    Returns:
        Dictionary with coverage statistics
    """
    activated = router.match(patient_conditions)
    
    # find conditions that don't match any protocol
    all_protocol_conditions = router.conditions
    unrecognized = patient_conditions - all_protocol_conditions
    recognized = patient_conditions & all_protocol_conditions
    
    return {
        "total_patient_conditions": len(patient_conditions),
        "recognized_conditions": len(recognized),
        "unrecognized_conditions": sorted(unrecognized),
        "activated_protocols": len(activated),
        "activated_protocol_ids": [p.id for p in activated],
        "interaction_protocols_activated": sum(1 for p in activated if p.is_interaction_protocol),
    }


def diff_routers(router_a: "ProtocolRouter", router_b: "ProtocolRouter") -> dict:
    """
    Compare two router configurations.
    
    Args:
        router_a: First router
        router_b: Second router
        
    Returns:
        Dictionary describing differences
    """
    protocols_a = {p.id: p for p in router_a.iter_protocols()}
    protocols_b = {p.id: p for p in router_b.iter_protocols()}
    
    ids_a = set(protocols_a.keys())
    ids_b = set(protocols_b.keys())
    
    added = ids_b - ids_a
    removed = ids_a - ids_b
    common = ids_a & ids_b
    
    modified = []
    for protocol_id in common:
        if protocols_a[protocol_id].to_dict() != protocols_b[protocol_id].to_dict():
            modified.append(protocol_id)
    
    return {
        "added": sorted(added),
        "removed": sorted(removed),
        "modified": sorted(modified),
        "unchanged": sorted(common - set(modified)),
    }
