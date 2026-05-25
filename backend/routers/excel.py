import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import Response
from database.repositories import vehicle_repo
from services import excel_service
from routers.deps import require_user, require_admin

router = APIRouter(prefix="/api/excel", tags=["excel"])


@router.get("/template")
def download_template(_=Depends(require_user)):
    data = excel_service.get_template()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=bom_template.xlsx"},
    )


@router.get("/export/{vehicle_type_id}")
def export_bom(vehicle_type_id: int, _=Depends(require_user)):
    vehicle = vehicle_repo.get_vehicle_by_id(vehicle_type_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    data = excel_service.export_bom(vehicle_type_id)
    filename = f"bom_{vehicle['code']}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/import/{vehicle_type_id}")
async def import_bom(vehicle_type_id: int, file: UploadFile = File(...), _=Depends(require_admin)):
    vehicle = vehicle_repo.get_vehicle_by_id(vehicle_type_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    file_bytes = await file.read()
    result = excel_service.import_bom(vehicle_type_id, file_bytes)
    return result


# ── 네이티브 포맷 (BOM 그려본 자료.xlsx 형식) ──────────────────────────────────

@router.post("/preview-native")
async def preview_native(file: UploadFile = File(...), _=Depends(require_admin)):
    """파일 내 시트 목록과 예상 데이터 행 수 반환"""
    file_bytes = await file.read()
    return excel_service.preview_native(file_bytes)


@router.post("/import-native/{vehicle_type_id}")
async def import_native(
    vehicle_type_id: int,
    file: UploadFile = File(...),
    sheet_name: str = Form(...),
    other_vehicle_map: str = Form(default="{}"),  # JSON: {"이음": 2, "원강": 3}
    _=Depends(require_admin),
):
    """
    네이티브 BOM 포맷 import.
    other_vehicle_map: JSON 문자열로 타차종 열명 → vehicle_type_id 매핑 전달
    """
    vehicle = vehicle_repo.get_vehicle_by_id(vehicle_type_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="차종을 찾을 수 없습니다.")
    try:
        ov_map = json.loads(other_vehicle_map)
        ov_map = {k: int(v) for k, v in ov_map.items()}
    except Exception:
        ov_map = {}

    file_bytes = await file.read()
    result = excel_service.import_native_bom(vehicle_type_id, file_bytes, sheet_name, ov_map)
    return result
