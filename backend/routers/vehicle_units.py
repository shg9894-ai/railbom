"""차량 단위(차호) 조회 - IH06 데이터 기반."""
from fastapi import APIRouter
from typing import Optional
from database.connection import get_connection

router = APIRouter(prefix="/api/vehicle-units", tags=["vehicle-units"])


@router.get("/counts-by-structure")
def counts_by_structure():
    """구조유형(차종)별 활성/비활성 차량 수.
    Returns: [{structure_code, structure_desc, object_type, active, inactive, total}]
    """
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT structure_code, structure_desc,
                   STRING_AGG(DISTINCT object_type, ', ') AS object_types,
                   COUNT(*) FILTER (WHERE is_active) AS active,
                   COUNT(*) FILTER (WHERE NOT is_active) AS inactive,
                   COUNT(*) AS total
            FROM vehicle_units
            WHERE structure_code IS NOT NULL
            GROUP BY structure_code, structure_desc
            ORDER BY active DESC, total DESC
        """).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/counts-summary")
def counts_summary():
    """전체 요약 + 차종 매핑(우리 시스템 차종과 연계)."""
    # 차종 코드 → ObjectType prefix 매핑 (Python 측에서 처리)
    VT_OBJTYPE = {
        'KTX-1':     'RKTX700',
        'KTX-산천1': 'RKTX721',
        'KTX-산천2': 'RKTX731',
        'KTX-산천3': 'RKTX741',
        'KTX-산천4': 'RKTX751',
        'EMU-260':   'RKTX761',
        'EMU-320':   'RKTX771',
        'ITX-마음':  'RETL861',
    }
    conn = get_connection()
    try:
        # 1) 차종 마스터
        vt_rows = conn.execute("SELECT id, code, name FROM vehicle_types ORDER BY id").fetchall()

        # 2) ObjectType별 활성/비활성 카운트 (LIKE 대신 정확매칭 + Python 집계)
        ot_rows = conn.execute("""
            SELECT object_type,
                   COUNT(*) FILTER (WHERE is_active) AS active,
                   COUNT(*) FILTER (WHERE NOT is_active) AS inactive,
                   COUNT(*) AS total
            FROM vehicle_units
            WHERE object_type IS NOT NULL
            GROUP BY object_type
        """).fetchall()

        # 3) prefix 매칭으로 차종별 합산
        results = []
        for vt in vt_rows:
            prefix = VT_OBJTYPE.get(vt['code'])
            active = inactive = total = 0
            if prefix:
                for ot in ot_rows:
                    if ot['object_type'] and ot['object_type'].startswith(prefix):
                        active += ot['active']
                        inactive += ot['inactive']
                        total += ot['total']
            results.append({
                'vehicle_type_id': vt['id'],
                'vehicle_type_code': vt['code'],
                'vehicle_type_name': vt['name'],
                'active_units': active,
                'inactive_units': inactive,
                'total_units': total,
            })

        totals_row = conn.execute("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE is_active) AS active,
                   COUNT(*) FILTER (WHERE NOT is_active) AS inactive
            FROM vehicle_units
        """).fetchone()

        return {
            "by_vehicle_type": results,
            "total_units": totals_row["total"],
            "active_units": totals_row["active"],
            "inactive_units": totals_row["inactive"],
        }
    finally:
        conn.close()


@router.get("/by-formation/{formation_code}")
def by_formation(formation_code: str):
    """편성번호별 차호 목록 (편성 = SupFLoc.). 예: KTX0001."""
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT functional_loc, location_desc, structure_code, structure_desc,
                   object_type, status, is_active, acquisition_date, manufacturer,
                   weight_ton, dimensions, construction_year
            FROM vehicle_units
            WHERE formation_code = ?
            ORDER BY functional_loc
        """, (formation_code,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/formations-by-structure/{structure_code}")
def formations_by_structure(structure_code: str):
    """구조유형(예: KTX0001)에 속한 편성 목록 + 편성별 활성/총량 수."""
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT formation_code,
                   COUNT(*) FILTER (WHERE is_active) AS active,
                   COUNT(*) AS total,
                   MIN(acquisition_date) AS first_acq,
                   MAX(acquisition_date) AS last_acq
            FROM vehicle_units
            WHERE structure_code = ?
            GROUP BY formation_code
            ORDER BY formation_code
        """, (structure_code,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
