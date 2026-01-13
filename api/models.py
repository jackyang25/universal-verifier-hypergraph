"""Pydantic request/response models for API."""

from datetime import datetime
from typing import List, Optional, Set

from pydantic import BaseModel, Field


class AxiomPackResponse(BaseModel):
    """Response model for axiom pack."""
    
    id: str
    version: str
    name: str
    conditions: List[str]
    description: Optional[str] = None
    last_reviewed: Optional[str] = None
    reviewer: Optional[str] = None
    country: Optional[str] = None
    regulatory_body: Optional[str] = None
    approval_status: Optional[str] = None


class AxiomPackCreate(BaseModel):
    """Request model for creating an axiom pack."""
    
    id: str = Field(..., description="Unique pack identifier")
    version: str = Field(default="1.0.0")
    name: str = Field(..., description="Human-readable name")
    conditions: Set[str] = Field(..., min_length=1, description="Required conditions")
    description: Optional[str] = None
    last_reviewed: Optional[str] = None


class AxiomPackUpdate(BaseModel):
    """Request model for updating an axiom pack."""
    
    version: Optional[str] = None
    name: Optional[str] = None
    conditions: Optional[Set[str]] = None
    description: Optional[str] = None
    last_reviewed: Optional[str] = None


class RoutingRequest(BaseModel):
    """Request model for patient routing."""
    
    conditions: Set[str] = Field(..., description="Active patient conditions")


class RoutingResponse(BaseModel):
    """Response model for routing results."""
    
    activated_packs: List[AxiomPackResponse]
    matched_conditions: List[str]
    timestamp: datetime


class GraphNode(BaseModel):
    """Node in the graph visualization."""
    
    id: str
    type: str
    active: bool
    pack_count: int
    packs: List[str]


class GraphHull(BaseModel):
    """Hull (axiom pack) in the graph visualization."""
    
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
    total_packs: int
    active_conditions: Optional[List[str]] = None
    activated_pack_ids: Optional[List[str]] = None


class GraphExport(BaseModel):
    """Complete graph export for D3 visualization."""
    
    nodes: List[GraphNode]
    hulls: List[GraphHull]
    metadata: GraphMetadata


class GraphStructure(BaseModel):
    """Basic graph statistics."""
    
    total_packs: int
    total_conditions: int
    config_version: str


class HealthResponse(BaseModel):
    """Health check response."""
    
    status: str
    version: str
