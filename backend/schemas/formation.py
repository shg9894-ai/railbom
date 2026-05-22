from pydantic import BaseModel
from typing import Optional


class FormationCreate(BaseModel):
    formation_no: int
    status: str = "active"
    notes: Optional[str] = None


class FormationBulkCreate(BaseModel):
    count: int


class FormationUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
