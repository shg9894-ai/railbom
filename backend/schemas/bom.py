from pydantic import BaseModel
from typing import Optional, List


class BomNodeCreate(BaseModel):
    parent_id: Optional[int] = None
    vehicle_type_id: int
    node_type: str = "assembly"
    category_code: Optional[str] = None
    material_no: Optional[str] = None
    name: str
    name_en: Optional[str] = None
    specification: Optional[str] = None
    unit: str = "EA"
    quantity: float = 1
    manufacturer: Optional[str] = None
    manufacturer_pn: Optional[str] = None
    drawing_no: Optional[str] = None
    weight_kg: Optional[float] = None
    material: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class BomNodeUpdate(BaseModel):
    node_type: str = "assembly"
    category_code: Optional[str] = None
    material_no: Optional[str] = None
    name: str
    name_en: Optional[str] = None
    specification: Optional[str] = None
    unit: str = "EA"
    quantity: float = 1
    manufacturer: Optional[str] = None
    manufacturer_pn: Optional[str] = None
    drawing_no: Optional[str] = None
    weight_kg: Optional[float] = None
    material: Optional[str] = None
    notes: Optional[str] = None


class BomNodeMove(BaseModel):
    new_parent_id: Optional[int] = None
    new_vehicle_type_id: Optional[int] = None


class BomReorder(BaseModel):
    ordered_ids: List[int]
