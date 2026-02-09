"""Pydantic request/response models for API."""

from datetime import datetime
from typing import List, Optional, Set

from pydantic import BaseModel, Field


class ProtocolResponse(BaseModel):
    """Response model for protocol."""
    
    id: str
    version: str
    name: str
    conditions: List[str]
    alias: Optional[str] = None
    guideline: Optional[str] = None
    description: Optional[str] = None
    last_reviewed: Optional[str] = None
    reviewer: Optional[str] = None
    country: Optional[str] = None
    regulatory_body: Optional[str] = None
    approval_status: Optional[str] = None
    
    # Proof metadata
    proof_type: Optional[str] = None
    proof_file: Optional[str] = None
    proof_status: Optional[str] = None
    proof_verified_at: Optional[str] = None
    proof_encapsulates: Optional[List[str]] = None
    proof_conflicts_with: Optional[List[str]] = None
    
    # Composition metadata
    composition_draws_from: Optional[List[str]] = None
    composition_coordination: Optional[List[str]] = None
    composition_replaces: Optional[List[str]] = None
    composition_reason: Optional[str] = None


class ProtocolCreate(BaseModel):
    """Request model for creating an protocol."""
    
    id: str = Field(..., description="Unique protocol identifier")
    version: str = Field(default="1.0.0")
    name: str = Field(..., description="Human-readable name")
    conditions: Set[str] = Field(..., min_length=1, description="Required conditions")
    guideline: Optional[str] = None
    description: Optional[str] = None
    last_reviewed: Optional[str] = None


class ProtocolUpdate(BaseModel):
    """Request model for updating an protocol."""
    
    version: Optional[str] = None
    name: Optional[str] = None
    conditions: Optional[Set[str]] = None
    guideline: Optional[str] = None
    description: Optional[str] = None
    last_reviewed: Optional[str] = None


class RoutingRequest(BaseModel):
    """Request model for patient routing."""
    
    conditions: Set[str] = Field(..., description="Active patient conditions")


class RoutingResponse(BaseModel):
    """Response model for routing results."""
    
    activated_protocols: List[ProtocolResponse]
    matched_conditions: List[str]
    timestamp: datetime


class GraphNode(BaseModel):
    """Node in the graph visualization."""
    
    id: str
    type: str
    active: bool
    protocol_count: int
    protocols: List[str]


class GraphHull(BaseModel):
    """Hull (protocol) in the graph visualization."""
    
    id: str
    name: str
    conditions: List[str]
    condition_count: int
    is_interaction: bool
    active: bool
    color: str
    version: str


class GraphMetadata(BaseModel):
    """Metadata for graph export."""
    
    config_version: str
    total_conditions: int
    total_protocols: int
    active_conditions: Optional[List[str]] = None
    activated_protocol_ids: Optional[List[str]] = None


class GraphExport(BaseModel):
    """Complete graph export for D3 visualization."""
    
    nodes: List[GraphNode]
    hulls: List[GraphHull]
    metadata: GraphMetadata


class GraphStructure(BaseModel):
    """Basic graph statistics."""
    
    total_protocols: int
    total_conditions: int
    config_version: str


class HealthResponse(BaseModel):
    """Health check response."""
    
    status: str
    version: str


class ProposedAction(BaseModel):
    """Proposed clinical action to verify."""
    type: str = Field(..., description="Action type: 'substance' or 'action'")
    id: str = Field(..., description="Entity ID (e.g., 'labetalol', 'immediate_delivery')")
    dose: Optional[str] = Field(None, description="Dosing information (for substances)")


class PatientContext(BaseModel):
    """Known patient conditions and context (NOT uncertain)."""
    comorbidities: Optional[List[str]] = Field(default_factory=list, description="Known comorbidities (e.g., ['asthma', 'diabetes'])")
    ga_weeks: Optional[int] = Field(None, description="Gestational age in weeks")
    physiologic_states: Optional[List[str]] = Field(default_factory=list, description="Pregnancy states (e.g., 'postpartum', 'breastfeeding')")


class SafetyCheckRequest(BaseModel):
    """
    Request model for safety checks.
    
    Accepts conformal prediction sets and verifies proposed actions.
    """
    conformal_set: List[str] = Field(..., description="Uncertain diagnoses from conformal prediction (e.g., ['hellp_syndrome', 'aflp'])")
    proposed_action: ProposedAction = Field(..., description="Action to verify (substance or clinical action)")
    patient_context: Optional[PatientContext] = Field(default_factory=PatientContext, description="Known patient conditions")


class SafetyCheckResponse(BaseModel):
    """
    Verification certificate response.
    
    Contains 7 components as documented in AGENTS.md.
    """
    available: bool
    verification_status: Optional[str] = Field(None, description="VERIFIED | BLOCKED | REPAIR_NEEDED")
    contraindications: List[dict] = Field(default_factory=list, description="Violated contraindications with rationale")
    alternatives: List[dict] = Field(default_factory=list, description="Safe alternatives with dosing")
    dose_limits: List[dict] = Field(default_factory=list, description="Dose warnings (informational)")
    consistency_violations: List[dict] = Field(default_factory=list, description="Mutual exclusions and requirement violations")
    required_actions: List[dict] = Field(default_factory=list, description="Required actions and satisfaction status")
    process_trace: List[str] = Field(default_factory=list, description="Audit trail of verification steps")
    lean_proof_id: Optional[str] = Field(None, description="Lean 4 proof identifier")
    
    # Legacy fields for backward compatibility
    conformal_set: Optional[List[str]] = Field(None, description="Diagnoses checked")
    proposed_action: Optional[dict] = Field(None, description="Action that was verified")


class OntologyStatusResponse(BaseModel):
    """Response model for ontology module status."""
    available: bool
    entity_count: Optional[int] = None
    relation_count: Optional[int] = None
    axiom_count: Optional[int] = None
    error: Optional[str] = None


class EntityResponse(BaseModel):
    """Response model for an ontology entity."""
    id: str
    name: str
    entity_type: str
    description: Optional[str] = None
    has_protocols: bool = False


class EntityCategory(BaseModel):
    """A category of entities."""
    category: str
    display_name: str
    entities: List[EntityResponse]


class AllEntitiesResponse(BaseModel):
    """Response model for all ontology entities grouped by category."""
    available: bool
    categories: List[EntityCategory]
    total_entities: int
    conditions_with_protocols: List[str]
