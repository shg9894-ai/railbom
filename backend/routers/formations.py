from fastapi import APIRouter, HTTPException
from schemas.formation import FormationCreate, FormationBulkCreate, FormationUpdate
from database.repositories import vehicle_repo, formation_repo

router = APIRouter(prefix="/api/vehicles", tags=["formations"])


@router.get("/{vehicle_id}/formations")
def list_formations(vehicle_id: int):
    if not vehicle_repo.get_vehicle_by_id(vehicle_id):
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    return formation_repo.get_formations_by_vehicle(vehicle_id)


@router.post("/{vehicle_id}/formations", status_code=201)
def create_formation(vehicle_id: int, body: FormationCreate):
    if not vehicle_repo.get_vehicle_by_id(vehicle_id):
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    return formation_repo.create_formation(vehicle_id, body.formation_no, body.status, body.notes)


@router.post("/{vehicle_id}/formations/bulk", status_code=201)
def create_formations_bulk(vehicle_id: int, body: FormationBulkCreate):
    if not vehicle_repo.get_vehicle_by_id(vehicle_id):
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    return formation_repo.create_formations_bulk(vehicle_id, body.count)


@router.put("/formations/{formation_id}")
def update_formation(formation_id: int, body: FormationUpdate):
    if not formation_repo.get_formation_by_id(formation_id):
        raise HTTPException(status_code=404, detail="편성을 찾을 수 없습니다.")
    return formation_repo.update_formation(formation_id, body.status, body.notes)


@router.delete("/formations/{formation_id}", status_code=204)
def delete_formation(formation_id: int):
    if not formation_repo.get_formation_by_id(formation_id):
        raise HTTPException(status_code=404, detail="편성을 찾을 수 없습니다.")
    formation_repo.delete_formation(formation_id)
