"""KORAIL 전자조달시스템(ecat) 자재정보 프록시.
   외부 ecat API는 JSON으로 호출 가능 (Accept 헤더만 필요).
"""
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
import httpx
import asyncio
from database.connection import get_connection
from routers.deps import require_admin

router = APIRouter(prefix="/api/ecat", tags=["ecat"])

ECAT_BASE = "http://ecat.korail.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
}


async def _fetch(client, path, mtart):
    try:
        r = await client.post(f"{ECAT_BASE}{path}", data={"mtart": mtart}, headers=HEADERS, timeout=8.0)
        return r.json() if r.status_code == 200 else None
    except Exception:
        return None


def _infer_material_type(material_no: str) -> tuple[str, str]:
    """자재번호 prefix로 자재유형 추정 (코레일 규칙)."""
    if not material_no: return (None, None)
    p = material_no[0]
    if p == '1': return ('ERSA', '보수품')
    if p == '6': return ('ERSB', '대표자재품')
    if p == '7': return ('HIBE', '비재고품')
    return (None, None)


def _ecat_base_to_db_columns(data: dict) -> dict:
    """ecat 응답을 material_master 컬럼에 맞게 변환."""
    mat_no = data.get('matnr')
    mt, mt_desc = _infer_material_type(mat_no)
    return {
        'material_no':      mat_no,
        'material_desc':    data.get('zzmaktx'),
        'product_group':    data.get('prdha'),
        'product_group_desc': data.get('grp_text'),
        'manufacturer_pn':  (data.get('mfrpn') or '').strip(),
        'unit':             data.get('meins'),
        'material_group':   data.get('matkl'),
        'material_group_desc': data.get('g2b_text'),
        'procurement':      data.get('gubun'),
        'procurement_desc': data.get('gubun_nm'),
        'safety_cert':      data.get('safecd'),
        'safety_cert_desc': data.get('safecd_nm'),
        'is_unused':        data.get('lvorm') == 'X',
        'created_date':     _parse_ecat_date(data.get('ersda')),
        'material_type':    mt,
        'material_type_desc': mt_desc,
    }


def _parse_ecat_date(s):
    """'2011.03.17.' → '2011-03-17'."""
    if not s: return None
    s = s.strip().rstrip('.').replace('.', '-')
    return s if len(s) == 10 else None


def _upsert_from_ecat(conn, ecat_data: dict):
    """ecat 응답으로 material_master UPSERT.
       각 자재마다 commit/rollback으로 트랜잭션 격리."""
    cols = _ecat_base_to_db_columns(ecat_data)
    if not cols.get('material_no'): return
    try:
        conn.execute("""
            INSERT INTO material_master
                (material_no, material_desc, product_group, product_group_desc,
                 manufacturer_pn, unit, material_group, material_group_desc,
                 procurement, procurement_desc, safety_cert, safety_cert_desc,
                 is_unused, created_date, material_type, material_type_desc, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON CONFLICT (material_no) DO UPDATE SET
                material_desc       = EXCLUDED.material_desc,
                product_group       = EXCLUDED.product_group,
                product_group_desc  = EXCLUDED.product_group_desc,
                manufacturer_pn     = EXCLUDED.manufacturer_pn,
                unit                = EXCLUDED.unit,
                material_group      = EXCLUDED.material_group,
                material_group_desc = EXCLUDED.material_group_desc,
                procurement         = EXCLUDED.procurement,
                procurement_desc    = EXCLUDED.procurement_desc,
                safety_cert         = EXCLUDED.safety_cert,
                safety_cert_desc    = EXCLUDED.safety_cert_desc,
                is_unused           = EXCLUDED.is_unused,
                created_date        = EXCLUDED.created_date,
                material_type       = COALESCE(material_master.material_type, EXCLUDED.material_type),
                material_type_desc  = COALESCE(material_master.material_type_desc, EXCLUDED.material_type_desc),
                updated_at          = NOW()
            RETURNING material_no
        """, (
            cols['material_no'], cols['material_desc'], cols['product_group'], cols['product_group_desc'],
            cols['manufacturer_pn'], cols['unit'], cols['material_group'], cols['material_group_desc'],
            cols['procurement'], cols['procurement_desc'], cols['safety_cert'], cols['safety_cert_desc'],
            cols['is_unused'], cols['created_date'], cols['material_type'], cols['material_type_desc'],
        ))
        conn.commit()
    except Exception:
        try:
            conn.rollback() if hasattr(conn, 'rollback') else conn._conn.rollback()
        except Exception:
            pass
        raise


@router.get("/material/{material_no}")
async def material(material_no: str):
    """ecat에서 자재정보 가져오기 — 기본정보 + 속성 + 이미지 일괄 조회.
       조회 결과는 자동으로 우리 DB(material_master)에 캐시됨."""
    async with httpx.AsyncClient() as client:
        base, attr, imgs = await asyncio.gather(
            _fetch(client, "/nsl/selectNomalSearchBeseView.json", material_no),
            _fetch(client, "/nsl/selectNomalSearchAttView.json", material_no),
            _fetch(client, "/nsl/selectNomalSearchBigImege.json", material_no),
        )
    if not base or not base.get('matnr'):
        raise HTTPException(404, "ecat에서 자재정보를 찾을 수 없습니다")

    # 백그라운드 캐시 (실패해도 응답엔 영향 없음)
    try:
        conn = get_connection()
        try:
            _upsert_from_ecat(conn, base)
        finally:
            conn.close()
    except Exception:
        pass

    # 속성 리스트에서 의미 있는 행만 (atbez=속성명, atwrt=속성값)
    attributes = []
    if isinstance(attr, list):
        for a in attr:
            if a.get('atbez') and a.get('atwrt'):
                attributes.append({
                    'name':  a.get('atbez'),
                    'value': a.get('atwrt'),
                    'unit':  (a.get('meinsyn_y') or '').strip(),
                    'desc':  a.get('expla', ''),
                })

    # 이미지 URL 구성 (a = matnr 앞 3자리)
    images = []
    if isinstance(imgs, list):
        for im in imgs:
            mn = im.get('matnr') or material_no
            dokar = im.get('dokar')
            doknr = im.get('doknr')
            filename = im.get('filename')
            if dokar and doknr and filename:
                a3 = str(mn)[:3]
                images.append({
                    'filename': filename,
                    'url': f"/api/ecat/image?dokar={dokar}&a3={a3}&doknr={doknr}&filename={filename}",
                })

    return {
        'material_no':         base.get('matnr'),
        'material_desc_full':  base.get('zzmaktx'),       # 자재내역 전체
        'material_desc_40':    base.get('maktx'),         # 40자 요약
        'group_classification_no':   base.get('matkl'),   # 자재그룹 분류번호
        'group_classification_name': base.get('g2b_text'),
        'group_classification_en':   base.get('g2b_eng_text'),
        'group_classification_desc': base.get('g2b_textexp', '').strip(),
        'product_group':       base.get('prdha'),
        'product_group_desc':  base.get('grp_text'),
        'unit':                base.get('meins'),
        'manufacturer_pn':     (base.get('mfrpn') or '').strip(),
        'created_date':        base.get('ersda'),
        'procurement_name':    base.get('gubun_nm'),
        'safety_code':         base.get('safecd_nm'),
        'safety_type':         (base.get('zsaf_nm') or '').strip(),
        'is_unused':           base.get('lvorm') == 'X',
        'use_plant':           (base.get('use_werks') or '').strip(),
        'stock_count':         base.get('stck_cnt'),
        'optimal_stock':       base.get('optm_stck'),
        'lead_time':           base.get('read_time'),
        'yearly_plan_amount':  base.get('yr_bypln_amt'),
        'registered_company_count': base.get('reg_comp_cnt'),
        'contract_in_progress':     base.get('ctt_ing_cnt'),
        'contract_completed':       base.get('ctt_comp_cnt'),
        'avg_contract_amount':      base.get('ctt_avg'),
        'category_2':          base.get('grp_text_02'),   # 기계기구및비품 등 대분류
        'purchase_group':      base.get('ekgrp'),
        'purchase_group_name': base.get('ekgrp_nm'),
        'last_update_date':    base.get('lst_dt'),
        'last_update_time':    base.get('lst_tm'),
        'attributes':          attributes,
        'images':              images,
        'source_url':          f"{ECAT_BASE}/nsl/nomalSearchMatnrView.do?matnr={material_no}",
    }


@router.get("/image")
async def ecat_image(dokar: str, a3: str, doknr: str, filename: str):
    """ecat 이미지 프록시. 인증 없이 외부에서 ecat 이미지 접근."""
    url = f"{ECAT_BASE}/DMS_IMAGE/{dokar}/{a3}/{doknr}/{filename}"
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0)
        if r.status_code != 200:
            raise HTTPException(404, "이미지를 찾을 수 없습니다")
        return Response(
            content=r.content,
            media_type=r.headers.get('content-type', 'image/jpeg'),
            headers={'Cache-Control': 'public, max-age=86400'},  # 24시간 캐시
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"ecat 이미지 가져오기 실패: {e}")


class SyncParams(BaseModel):
    start: int = 0          # 시작 자재번호 (0 = DB 최대값 다음부터)
    count: int = 1000       # 스캔 개수
    concurrency: int = 20   # 동시 요청 수


@router.post("/sync-new")
async def sync_new_materials(params: SyncParams, _=Depends(require_admin)):
    """신규 자재 일괄 동기화 (관리자 전용).
       DB 최대값부터 ecat에 순차 조회해서 발견된 것만 DB에 추가.
    """
    conn = get_connection()
    try:
        if params.start <= 0:
            row = conn.execute(
                "SELECT MAX(material_no::bigint)::bigint AS mx FROM material_master WHERE material_no ~ '^[0-9]+$'"
            ).fetchone()
            start = int(row['mx']) + 1
        else:
            start = params.start
    finally:
        conn.close()

    end = start + params.count
    targets = [str(n) for n in range(start, end)]

    sem = asyncio.Semaphore(params.concurrency)
    found_data = []

    async def scan_one(client, mat):
        async with sem:
            r = await _fetch(client, "/nsl/selectNomalSearchBeseView.json", mat)
            if r and r.get('matnr'):
                found_data.append(r)

    async with httpx.AsyncClient() as client:
        await asyncio.gather(*[scan_one(client, m) for m in targets])

    # 일괄 UPSERT (자재마다 connection 분리하여 트랜잭션 격리)
    saved = 0
    errors = []
    for d in found_data:
        conn = get_connection()
        try:
            _upsert_from_ecat(conn, d)
            saved += 1
        except Exception as e:
            errors.append((d.get('matnr'), str(e)[:100]))
        finally:
            conn.close()

    return {
        'scanned_range': f'{start}~{end-1}',
        'scanned_count': len(targets),
        'found_count': len(found_data),
        'saved_count': saved,
        'errors': errors[:5],
        'next_start': end,
    }


@router.get("/sync-status")
def sync_status(_=Depends(require_admin)):
    """현재 동기화 상태."""
    conn = get_connection()
    try:
        row = conn.execute("""
            SELECT
                COUNT(*) AS total,
                MAX(material_no::bigint) AS max_no,
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') AS recent_updated
            FROM material_master WHERE material_no ~ '^[0-9]+$'
        """).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.get("/last-sync")
def last_sync():
    """마지막 자동 동기화 시각 (모든 사용자 조회 가능).
       로그 테이블이 비어있으면 material_master.updated_at 최신값으로 추정."""
    conn = get_connection()
    try:
        # 1) 정식 로그 우선
        try:
            row = conn.execute("""
                SELECT started_at, finished_at, duration_seconds
                FROM ecat_sync_logs
                ORDER BY started_at DESC LIMIT 1
            """).fetchone()
            if row:
                return {
                    'source': 'log',
                    'started_at': row['started_at'].isoformat() if row['started_at'] else None,
                    'finished_at': row['finished_at'].isoformat() if row['finished_at'] else None,
                    'duration_seconds': row['duration_seconds'],
                }
        except Exception:
            pass
        # 2) fallback: material_master 최신 updated_at
        row = conn.execute("""
            SELECT MAX(updated_at) AS last_updated FROM material_master
        """).fetchone()
        return {
            'source': 'fallback',
            'started_at': None,
            'finished_at': row['last_updated'].isoformat() if row and row['last_updated'] else None,
            'duration_seconds': None,
        }
    finally:
        conn.close()


@router.get("/activity")
def activity(days: int = 7, _=Depends(require_admin)):
    """자재마스터 변경 활동 일별 집계 (관리자 전용).
       지난 N일간 (신규 추가 / 갱신 / 미사용 전환) 건수."""
    # days는 신뢰 가능한 정수만 (외부 입력 sanitize)
    n_days = max(1, min(365, int(days)))
    interval = f"INTERVAL '{n_days} days'"
    conn = get_connection()
    try:
        # 일별 created_date 기준 신규
        new_rows = conn.execute(f"""
            SELECT created_date::date AS day, COUNT(*) AS n
            FROM material_master
            WHERE created_date >= CURRENT_DATE - {interval} AND created_date IS NOT NULL
            GROUP BY day ORDER BY day DESC
        """).fetchall()

        # 일별 updated_at(KST) 기준 갱신
        upd_rows = conn.execute(f"""
            SELECT (updated_at AT TIME ZONE 'Asia/Seoul')::date AS day, COUNT(*) AS n
            FROM material_master
            WHERE updated_at >= NOW() - {interval}
            GROUP BY day ORDER BY day DESC
        """).fetchall()

        # 일별 is_unused=true 갱신 (정확한 '전환'은 추적 안 되니 unused 갱신 건수로 근사)
        unused_rows = conn.execute(f"""
            SELECT (updated_at AT TIME ZONE 'Asia/Seoul')::date AS day, COUNT(*) AS n
            FROM material_master
            WHERE updated_at >= NOW() - {interval} AND is_unused = true
            GROUP BY day ORDER BY day DESC
        """).fetchall()

        def to_map(rows):
            m = {}
            for r in rows:
                d = r['day']
                m[d.isoformat() if d else None] = r['n']
            return m

        new_m = to_map(new_rows)
        upd_m = to_map(upd_rows)
        unused_m = to_map(unused_rows)
        all_days = sorted(set(new_m) | set(upd_m) | set(unused_m), reverse=True)

        result = []
        for d in all_days:
            if d is None: continue
            result.append({
                'day': d,
                'new_count': new_m.get(d, 0),
                'updated_count': upd_m.get(d, 0),
                'unused_updated_count': unused_m.get(d, 0),
            })
        return result
    finally:
        conn.close()


@router.get("/sync-logs")
def sync_logs(limit: int = 20, _=Depends(require_admin)):
    """ecat 자동 동기화 실행 이력."""
    conn = get_connection()
    try:
        try:
            rows = conn.execute("""
                SELECT id, started_at, finished_at, duration_seconds, detail
                FROM ecat_sync_logs
                ORDER BY started_at DESC LIMIT ?
            """, (limit,)).fetchall()
            return [dict(r) for r in rows]
        except Exception:
            return []
    finally:
        conn.close()


@router.post("/sync-now")
async def sync_now(_=Depends(require_admin)):
    """전수 동기화 즉시 실행 (테스트/긴급용)."""
    from jobs.ecat_sync import run_daily_sync
    results = await run_daily_sync()
    return {'status': 'completed', 'results': results}
