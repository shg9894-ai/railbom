from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database.repositories import repair_kit_repo

router = APIRouter(prefix="/api/repair-kits", tags=["repair-kits"])


class KitCreate(BaseModel):
    parent_id: int
    name: str
    ref_node_ids: list[int]
    quantities: Optional[dict[int, float]] = None


class ItemAdd(BaseModel):
    ref_node_id: int
    quantity: float = 1.0


@router.post("", status_code=201)
def create_kit(body: KitCreate):
    try:
        return repair_kit_repo.create_kit(
            body.parent_id, body.name, body.ref_node_ids, body.quantities
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/by-parent/{parent_id}")
def get_kits_by_parent(parent_id: int):
    return repair_kit_repo.get_kits_by_parent(parent_id)


@router.get("/{kit_id}")
def get_kit(kit_id: int):
    kit = repair_kit_repo.get_kit(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="수리키트를 찾을 수 없습니다.")
    return kit


@router.post("/{kit_id}/items", status_code=201)
def add_item(kit_id: int, body: ItemAdd):
    try:
        return repair_kit_repo.add_item(kit_id, body.ref_node_id, body.quantity)
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="이미 포함된 부품입니다.")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{kit_id}/items/{item_id}", status_code=204)
def remove_item(kit_id: int, item_id: int):
    repair_kit_repo.remove_item(item_id)


@router.delete("/{kit_id}", status_code=204)
def delete_kit(kit_id: int):
    repair_kit_repo.delete_kit(kit_id)
