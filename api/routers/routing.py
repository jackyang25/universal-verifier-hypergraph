"""Patient routing endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from protocols import ProtocolRouter
from api.dependencies import get_protocol_router_dependency
from api.models import RoutingRequest, RoutingResponse

router = APIRouter()


@router.post("/match", response_model=RoutingResponse)
def route_patient(
    request: RoutingRequest,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """
    Route patient conditions to appropriate protocols.
    
    Returns all activated protocols ordered by specificity.
    """
    activated = protocol_router.match(request.conditions)
    
    return RoutingResponse(
        activated_protocols=[protocol.to_dict() for protocol in activated],
        matched_conditions=sorted(request.conditions),
        timestamp=datetime.now(timezone.utc),
    )
