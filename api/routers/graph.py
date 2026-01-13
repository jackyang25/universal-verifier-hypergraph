"""Graph visualization endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends

from axiom_router import AxiomRouter
from axiom_router.exporter import D3Exporter
from api.dependencies import get_router_dependency
from api.models import GraphExport, GraphStructure

router = APIRouter()


@router.get("/export", response_model=GraphExport)
def export_graph(
    axiom_router: AxiomRouter = Depends(get_router_dependency),
    highlight_conditions: Optional[str] = None,
):
    """
    Export graph structure for D3 visualization.
    
    Args:
        highlight_conditions: Comma-separated conditions to highlight
    """
    exporter = D3Exporter(axiom_router)
    
    if highlight_conditions:
        conditions = set(highlight_conditions.split(","))
        return exporter.export_with_context(conditions)
    
    return exporter.export_graph()


@router.get("/structure", response_model=GraphStructure)
def get_graph_structure(
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """Get basic graph statistics."""
    return GraphStructure(
        total_packs=axiom_router.pack_count,
        total_conditions=len(axiom_router.conditions),
        config_version=axiom_router.config_version,
    )
