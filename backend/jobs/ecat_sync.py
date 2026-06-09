"""ecat 자재 전수 동기화 작업 (매일 새벽 실행).

전 자재 매일 1회 ecat 재조회:
- DB 전체 자재(13만+ 건) 약 1~2시간 소요 (동시성 30)
- 변경분은 UPSERT로 자동 반영
- 신규 자재: 패턴별(1xxxxxx, 6xxxxxx, 7xxxxxx) DB 최대값 + buffer로 발굴
"""
import asyncio, sys, json
import httpx
from datetime import datetime
from loguru import logger
from database.connection import get_connection
from routers.ecat import _fetch, _upsert_from_ecat


# 신규 자재 발굴용 패턴 (DB 최대값 + buffer 만큼 스캔)
# ERSA는 발급량이 많아 buffer 작으면 며칠치 신규를 놓침 (예: 1125406이 며칠간 미발견).
SCAN_PATTERNS = [
    {'name': 'ERSA 보수품', 'prefix': '1', 'buffer': 5000},
    {'name': 'ERSB 대표자재', 'prefix': '6', 'buffer': 1000},
    {'name': 'HIBE 비재고품', 'prefix': '7', 'buffer': 1000},
]
CONCURRENCY = 30   # 동시 요청 수


async def _refresh_batch(targets: list, concurrency: int = CONCURRENCY) -> int:
    """자재번호 리스트를 ecat에서 조회 후 DB UPSERT. 성공 건수 반환."""
    if not targets: return 0
    sem = asyncio.Semaphore(concurrency)
    found = []

    async def one(client, mat):
        async with sem:
            r = await _fetch(client, "/nsl/selectNomalSearchBeseView.json", mat)
            if r and r.get('matnr'):
                found.append(r)

    async with httpx.AsyncClient() as client:
        await asyncio.gather(*[one(client, m) for m in targets])

    if not found: return 0
    ok = 0
    for d in found:
        # 자재마다 connection 새로 열어 트랜잭션 격리
        conn = get_connection()
        try:
            _upsert_from_ecat(conn, d)
            ok += 1
        except Exception as e:
            logger.warning(f"UPSERT 실패 {d.get('matnr')}: {str(e)[:120]}")
        finally:
            conn.close()
    return ok


async def sync_new_pattern(pattern: dict) -> dict:
    """패턴별 신규 자재 스캔 (DB 최대값부터 buffer만큼)."""
    conn = get_connection()
    try:
        row = conn.execute("""
            SELECT MAX(material_no::bigint) AS mx FROM material_master
            WHERE material_no ~ '^[0-9]+$' AND material_no LIKE ?
        """, (pattern['prefix'] + '%',)).fetchone()
        max_no = int(row['mx']) if row['mx'] else int(pattern['prefix'] + '000000')
    finally:
        conn.close()

    start = max_no + 1
    targets = [str(n) for n in range(start, start + pattern['buffer'])]
    found = await _refresh_batch(targets)
    return {
        'phase': '신규',
        'pattern': pattern['name'],
        'range': f"{start}~{start + pattern['buffer'] - 1}",
        'found': found,
    }


async def refresh_all_existing(chunk_size: int = 2000) -> dict:
    """DB 전체 자재 ecat 재조회 → 변경분 반영."""
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT material_no FROM material_master
            WHERE material_no ~ '^[0-9]+$'
            ORDER BY material_no
        """).fetchall()
        all_targets = [r['material_no'] for r in rows]
    finally:
        conn.close()

    total = len(all_targets)
    if total == 0:
        return {'phase': '전수 갱신', 'checked': 0, 'updated': 0}

    logger.info(f"[ecat-sync] 전수 갱신: {total}건 대상, {chunk_size}개씩 진행")

    total_updated = 0
    for i in range(0, total, chunk_size):
        chunk = all_targets[i:i + chunk_size]
        updated = await _refresh_batch(chunk)
        total_updated += updated
        logger.info(f"  진행: {i + len(chunk)}/{total} ({(i + len(chunk)) * 100 // total}%) — 이번 chunk 발견 {updated}")

    return {'phase': '전수 갱신', 'checked': total, 'updated': total_updated}


async def run_daily_sync():
    """매일 새벽 실행: 신규 스캔 + 전수 갱신."""
    logger.info("[ecat-sync] 일일 자동 동기화 시작")
    started_at = datetime.now()
    results = []

    # 1) 패턴별 신규 자재 발굴
    for pattern in SCAN_PATTERNS:
        try:
            r = await sync_new_pattern(pattern)
            results.append(r)
            logger.info(f"[ecat-sync] [신규] {r['pattern']} {r['range']} → {r['found']}건")
        except Exception as e:
            logger.error(f"[ecat-sync] 신규 스캔 실패 ({pattern['name']}): {e}")
            results.append({'phase': '신규', 'pattern': pattern['name'], 'error': str(e)})

    # 2) 전수 갱신
    try:
        r = await refresh_all_existing()
        results.append(r)
        logger.info(f"[ecat-sync] [전수] {r['checked']}건 점검 → {r['updated']}건 반영")
    except Exception as e:
        logger.error(f"[ecat-sync] 전수 갱신 실패: {e}")
        results.append({'phase': '전수 갱신', 'error': str(e)})

    # 실행 로그 DB 기록
    conn = get_connection()
    try:
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ecat_sync_logs (
                    id SERIAL PRIMARY KEY,
                    started_at TIMESTAMPTZ NOT NULL,
                    finished_at TIMESTAMPTZ DEFAULT NOW(),
                    duration_seconds INTEGER,
                    detail TEXT
                )
            """)
            conn.commit()
        except Exception:
            pass
        duration = int((datetime.now() - started_at).total_seconds())
        conn.execute(
            "INSERT INTO ecat_sync_logs (started_at, duration_seconds, detail) VALUES (?, ?, ?)",
            (started_at, duration, json.dumps(results, ensure_ascii=False))
        )
        conn.commit()
    finally:
        conn.close()

    logger.info(f"[ecat-sync] 일일 동기화 완료 ({duration // 60}분 {duration % 60}초)")
    return results


def schedule_jobs(scheduler):
    """APScheduler에 작업 등록."""
    scheduler.add_job(
        lambda: asyncio.run(run_daily_sync()),
        'cron', hour=3, minute=0,
        id='ecat_daily_sync',
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("[ecat-sync] 매일 03:00 자동 동기화 스케줄 등록됨")
