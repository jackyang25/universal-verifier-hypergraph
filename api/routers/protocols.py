"""Protocol CRUD endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from protocols import ProtocolRouter
from protocols.dependencies import reload_router, CONFIG_PATH
from api.dependencies import get_protocol_router_dependency
from api.models import ProtocolCreate, ProtocolResponse, ProtocolUpdate

router = APIRouter()


@router.get("/", response_model=List[ProtocolResponse])
def list_protocols(
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """Get all protocols."""
    return [protocol.to_dict() for protocol in protocol_router.protocols]


@router.get("/{protocol_id}", response_model=ProtocolResponse)
def get_protocol(
    protocol_id: str,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """Get specific protocol by ID."""
    protocol = protocol_router.get_protocol(protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail=f"Protocol '{protocol_id}' not found")
    return protocol.to_dict()


@router.post("/", response_model=ProtocolResponse, status_code=201)
def create_protocol(
    protocol: ProtocolCreate,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """Create a new protocol."""
    if protocol_router.get_protocol(protocol.id):
        raise HTTPException(
            status_code=409, 
            detail=f"Protocol '{protocol.id}' already exists"
        )
    
    protocol_data = protocol.model_dump()
    protocol_data["conditions"] = list(protocol_data["conditions"])
    
    created = protocol_router.add_protocol_from_dict(protocol_data)
    protocol_router.save_config(CONFIG_PATH)
    
    return created.to_dict()


@router.put("/{protocol_id}", response_model=ProtocolResponse)
def update_protocol(
    protocol_id: str,
    updates: ProtocolUpdate,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """Update an existing protocol."""
    update_data = updates.model_dump(exclude_unset=True)
    
    # convert set to list for conditions
    if "conditions" in update_data and update_data["conditions"]:
        update_data["conditions"] = list(update_data["conditions"])
    
    updated = protocol_router.update_protocol(protocol_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Protocol '{protocol_id}' not found")
    
    protocol_router.save_config(CONFIG_PATH)
    return updated.to_dict()


@router.delete("/{protocol_id}", status_code=204)
def delete_protocol(
    protocol_id: str,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """Delete a protocol."""
    success = protocol_router.delete_protocol(protocol_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Protocol '{protocol_id}' not found")
    
    protocol_router.save_config(CONFIG_PATH)


@router.post("/reload", response_model=dict)
def reload_config():
    """Reload configuration from disk."""
    router = reload_router()
    return {
        "status": "reloaded",
        "protocol_count": router.protocol_count,
        "config_version": router.config_version,
    }
