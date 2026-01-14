"""Protocol execution endpoints (placeholder until verifiers exist)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from protocol_router import ProtocolRouter
from api.dependencies import get_protocol_router_dependency
from api.models import ExecuteRequest, ExecuteResponse, ExecuteProtocolResult

router = APIRouter()


@router.post("/run", response_model=ExecuteResponse)
def execute_protocols(
    request: ExecuteRequest,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """
    Execute activated protocols.

    This is a placeholder endpoint: it computes which protocols would be executed,
    but returns a "not_implemented" status because verifier implementations
    will be added later (e.g., in a /verifiers folder).
    """
    activated = protocol_router.match(request.conditions)

    results = [
        ExecuteProtocolResult(
            protocol_id=p.id,
            protocol_name=p.name,
            version=p.version,
            status="not_implemented",
            message=f"No verifier registered for protocol_id={p.id}",
        )
        for p in activated
    ]

    return ExecuteResponse(
        matched_conditions=sorted(request.conditions),
        results=results,
        timestamp=datetime.now(timezone.utc),
    )

