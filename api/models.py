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
    guideline: Optional[str] = None
    description: Optional[str] = None
    last_reviewed: Optional[str] = None
    reviewer: Optional[str] = None
    country: Optional[str] = None
    regulatory_body: Optional[str] = None
    approval_status: Optional[str] = None


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


class VerifyRequest(BaseModel):
    """Request model for verifying activated protocols."""
    
    conditions: Set[str] = Field(..., description="Active patient conditions")


class VerifyProtocolResult(BaseModel):
    """Verification result for a single protocol."""

    protocol_id: str
    protocol_name: str
    version: str
    status: str  # "proved" | "failed" | "warning" | "missing_interaction" | "not_implemented"
    message: Optional[str] = None

    # LEAN verification outputs
    lean_code: Optional[str] = Field(None, description="Generated LEAN 4 code")
    proof_output: Optional[str] = Field(None, description="LEAN proof execution output")
    errors: List[str] = Field(default_factory=list, description="Verification errors")
    warnings: List[str] = Field(default_factory=list, description="Verification warnings")

    # Verification details
    verifications_passed: List[str] = Field(default_factory=list, description="List of passed verifications")
    verifications_failed: List[str] = Field(default_factory=list, description="List of failed verifications")


class VerifyResponse(BaseModel):
    """Response model for protocol verification."""
    
    matched_conditions: List[str]
    results: List[VerifyProtocolResult]
    timestamp: datetime
