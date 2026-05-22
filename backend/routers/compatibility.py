from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from schemas.compatibility import CompatibilityUpsert
from database.repositories import compatibility_repo

router = APIRouter(prefix="/api/compatibility", tags=["compatibility"])


@router.get("")
def list_compatibility(
    node_id: Optional[int] = Query(None),
    vehicle_id: Optional[int] = Query(None),
):
    if node_id:
        return compatibility_repo.get_by_node(node_id)
    if vehicle_id:
        return compatibility_repo.get_by_vehicle(vehicle_id)
    raise HTTPException(status_code=400, detail="node_id 또는 vehicle_id 필요")


@router.post("", status_code=201)
def upsert_compatibility(body: CompatibilityUpsert):
    return compatibility_repo.upsert(
        body.bom_node_id, body.vehicle_type_id, body.compat_type, body.notes
    )


@router.delete("/{compat_id}", status_code=204)
def delete_compatibility(compat_id: int):
    compatibility_repo.delete(compat_id)
