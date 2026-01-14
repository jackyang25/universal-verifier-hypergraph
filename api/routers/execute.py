"""Protocol verification endpoints (placeholder until verifiers exist)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from protocol_router import ProtocolRouter
from api.dependencies import get_protocol_router_dependency
from api.models import VerifyRequest, VerifyResponse, VerifyProtocolResult

router = APIRouter()


@router.post("/run", response_model=VerifyResponse)
def verify_protocols(
    request: VerifyRequest,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """
    Execute verifiers for activated protocols.

    This is a placeholder endpoint: it computes which protocols would be verified,
    but returns a "not_implemented" status because verifier implementations
    will be added later (e.g., in a /verifiers folder).
    """
    activated = protocol_router.match(request.conditions)

    results = []
    for p in activated:
        # check if protocol has a verifier field defined
        if p.verifier:
            message = f"Verifier '{p.verifier}' not yet implemented for protocol_id={p.id}"
        else:
            message = f"No verifier registered for protocol_id={p.id}"
        
        results.append(
            VerifyProtocolResult(
                protocol_id=p.id,
                protocol_name=p.name,
                version=p.version,
                status="not_implemented",
                message=message,
            )
        )

    return VerifyResponse(
        matched_conditions=sorted(request.conditions),
        results=results,
        timestamp=datetime.now(timezone.utc),
    )

