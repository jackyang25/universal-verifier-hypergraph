"""Graph visualization endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends

from protocols import ProtocolRouter
from protocols.exporter import D3Exporter
from api.dependencies import get_protocol_router_dependency
from api.models import GraphExport, GraphStructure

router = APIRouter()


@router.get("/export", response_model=GraphExport)
def export_graph(
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
    highlight_conditions: Optional[str] = None,
):
    """
    Export graph structure for D3 visualization.
    
    Args:
        highlight_conditions: Comma-separated conditions to highlight
    """
    exporter = D3Exporter(protocol_router)
    
    if highlight_conditions:
        conditions = set(highlight_conditions.split(","))
        return exporter.export_with_context(conditions)
    
    return exporter.export_graph()


@router.get("/structure", response_model=GraphStructure)
def get_graph_structure(
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """Get basic graph statistics."""
    return GraphStructure(
        total_protocols=protocol_router.protocol_count,
        total_conditions=len(protocol_router.conditions),
        config_version=protocol_router.config_version,
    )
