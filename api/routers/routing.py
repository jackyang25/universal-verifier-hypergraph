"""Patient routing endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from axiom_router import AxiomRouter
from api.dependencies import get_router_dependency
from api.models import RoutingRequest, RoutingResponse

router = APIRouter()


@router.post("/match", response_model=RoutingResponse)
def route_patient(
    request: RoutingRequest,
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """
    Route patient conditions to appropriate axiom packs.
    
    Returns all activated packs ordered by specificity.
    """
    activated = axiom_router.match(request.conditions)
    
    return RoutingResponse(
        activated_packs=[pack.to_dict() for pack in activated],
        matched_conditions=sorted(request.conditions),
        timestamp=datetime.now(timezone.utc),
    )
