"""Axiom pack CRUD endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from axiom_router import AxiomRouter
from api.dependencies import get_router_dependency, reload_router, CONFIG_PATH
from api.models import AxiomPackCreate, AxiomPackResponse, AxiomPackUpdate

router = APIRouter()


@router.get("/", response_model=List[AxiomPackResponse])
def list_packs(
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """Get all axiom packs."""
    return [pack.to_dict() for pack in axiom_router.packs]


@router.get("/{pack_id}", response_model=AxiomPackResponse)
def get_pack(
    pack_id: str,
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """Get specific axiom pack by ID."""
    pack = axiom_router.get_pack(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    return pack.to_dict()


@router.post("/", response_model=AxiomPackResponse, status_code=201)
def create_pack(
    pack: AxiomPackCreate,
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """Create a new axiom pack."""
    if axiom_router.get_pack(pack.id):
        raise HTTPException(
            status_code=409, 
            detail=f"Pack '{pack.id}' already exists"
        )
    
    pack_data = pack.model_dump()
    pack_data["conditions"] = list(pack_data["conditions"])
    
    created = axiom_router.add_pack_from_dict(pack_data)
    axiom_router.save_config(CONFIG_PATH)
    
    return created.to_dict()


@router.put("/{pack_id}", response_model=AxiomPackResponse)
def update_pack(
    pack_id: str,
    updates: AxiomPackUpdate,
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """Update an existing axiom pack."""
    update_data = updates.model_dump(exclude_unset=True)
    
    # convert set to list for conditions
    if "conditions" in update_data and update_data["conditions"]:
        update_data["conditions"] = list(update_data["conditions"])
    
    updated = axiom_router.update_pack(pack_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    
    axiom_router.save_config(CONFIG_PATH)
    return updated.to_dict()


@router.delete("/{pack_id}", status_code=204)
def delete_pack(
    pack_id: str,
    axiom_router: AxiomRouter = Depends(get_router_dependency),
):
    """Delete an axiom pack."""
    success = axiom_router.delete_pack(pack_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    
    axiom_router.save_config(CONFIG_PATH)


@router.post("/reload", response_model=dict)
def reload_config():
    """Reload configuration from disk."""
    router = reload_router()
    return {
        "status": "reloaded",
        "pack_count": router.pack_count,
        "config_version": router.config_version,
    }
