from pydantic import BaseModel
from typing import Optional


class CompatibilityUpsert(BaseModel):
    bom_node_id: int
    vehicle_type_id: int
    compat_type: str = "compatible"
    notes: Optional[str] = None
