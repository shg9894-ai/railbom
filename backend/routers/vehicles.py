from fastapi import APIRouter, HTTPException
from schemas.vehicle import VehicleCreate, VehicleUpdate
from database.repositories import vehicle_repo

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


@router.get("")
def list_vehicles():
    return vehicle_repo.get_all_vehicles()


@router.post("", status_code=201)
def create_vehicle(body: VehicleCreate):
    return vehicle_repo.create_vehicle(body.code, body.name, body.description)


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: int):
    vehicle = vehicle_repo.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    return vehicle


@router.put("/{vehicle_id}")
def update_vehicle(vehicle_id: int, body: VehicleUpdate):
    vehicle = vehicle_repo.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    return vehicle_repo.update_vehicle(vehicle_id, body.code, body.name, body.description)


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int):
    vehicle = vehicle_repo.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    vehicle_repo.delete_vehicle(vehicle_id)
