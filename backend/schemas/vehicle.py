from pydantic import BaseModel
from typing import Optional


class VehicleCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class VehicleUpdate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
