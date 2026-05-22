"""
명칭도감 index.json 분석 스크립트
- 이음(emu260), 청룡(emu320)의 페이지별 BOM 매칭 현황 분석
"""
import sqlite3
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# ── 설정 ──────────────────────────────────────────────────────────────
DB_PATH = r'C:\Dev\railway-bom\backend\data\bom.db'
INDEX_EMU320 = r'C:\Dev\railway-bom\frontend\public\diagrams\emu320\index.json'
INDEX_EMU260 = r'C:\Dev\railway-bom\frontend\public\diagrams\emu260\index.json'
OUTPUT_FILE = r'C:\Dev\railway-bom\backend\diagram_analysis.txt'

# vehicle_types: 1=청룡(emu320), 2=이음(emu260)
VEHICLE_CONFIGS = [
    {
        'label': '청룡(emu320)',
        'index_path': INDEX_EMU320,
        'vehicle_type_id': 1,
        'vehicle_code': 'emu320',
    },
    {
        'label': '이음(emu260)',
        'index_path': INDEX_EMU260,
        'vehicle_type_id': 2,
        'vehicle_code': 'emu260',
    },
]


# ── 정규화 함수 ────────────────────────────────────────────────────────
def normalize(text: str) -> str:
    """부품명 비교용 정규화: 공백·괄호·숫자·특수문자 제거 후 소문자"""
    if not text:
        return ''
    t = text.strip()
    # 앞에 붙은 숫자 번호 제거 (예: "8 자동하강장치" → "자동하강장치")
    t = re.sub(r'^\d+\s+', '', t)
    # 괄호 및 내부 제거
    t = re.sub(r'[\(\（\[\{][^\)\）\]\}]*[\)\）\]\}]', '', t)
    # 공백·특수문자 제거
    t = re.sub(r'[\s\-_·/\\.,·]', '', t)
    return t.lower()


# ── DB 연결 및 bom_nodes 로드 ──────────────────────────────────────────
def load_bom_names(conn, vehicle_type_id: int) -> set:
    """해당 차종의 bom_nodes name 집합을 정규화하여 반환"""
    conn.text_factory = bytes
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM bom_nodes WHERE vehicle_type_id = ?",
        (vehicle_type_id,)
    )
    names = set()
    for (raw,) in cur.fetchall():
        try:
            decoded = raw.decode('utf-8')
            names.add(normalize(decoded))
        except Exception:
            pass
    return names


# ── index.json 파싱 ────────────────────────────────────────────────────
def load_manifest(index_path: str) -> list:
    """
    manifest에서 parts가 1개 이상인 페이지만 반환.
    반환 형태: [{'file', 'page', 'cat', 'cat_label', 'assembly', 'parts': [...name...]}]
    """
    with open(index_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    manifest = data.get('manifest', {})
    pages = []
    for cat_key, cat_val in manifest.items():
        cat_label = cat_val.get('label', cat_key)
        for pg in cat_val.get('pages', []):
            raw_parts = pg.get('parts', [])
            if not raw_parts:
                continue  # 표지 등 parts 없는 페이지 제외
            part_names = [p['name'] for p in raw_parts if p.get('name')]
            if not part_names:
                continue
            assembly = pg.get('assembly') or pg.get('sub_assembly') or ''
            pages.append({
                'file': pg.get('file', ''),
                'page': pg.get('page'),
                'cat': cat_key,
                'cat_label': cat_label,
                'assembly': assembly,
                'parts': part_names,
            })
    return pages


# ── 분석 함수 ─────────────────────────────────────────────────────────
def analyze(config: dict, conn: sqlite3.Connection) -> dict:
    label = config['label']
    bom_names = load_bom_names(conn, config['vehicle_type_id'])
    pages = load_manifest(config['index_path'])

    unused = []       # 0개 매칭
    partial = []      # 1 이상이지만 전부는 아님
    full = []         # 모두 매칭

    for pg in pages:
        matched = []
        unmatched = []
        for part_name in pg['parts']:
            norm = normalize(part_name)
            if norm and norm in bom_names:
                matched.append(part_name)
            else:
                unmatched.append(part_name)

        total = len(pg['parts'])
        m_cnt = len(matched)

        if m_cnt == 0:
            unused.append(pg)
        elif m_cnt == total:
            full.append(pg)
        else:
            pg['matched'] = matched
            pg['unmatched'] = unmatched
            partial.append(pg)

    return {
        'label': label,
        'unused': unused,
        'partial': partial,
        'full': full,
        'bom_total': len(bom_names),
        'page_total': len(pages),
    }


# ── 보고서 출력 ───────────────────────────────────────────────────────
def format_report(result: dict) -> str:
    lines = []
    label = result['label']
    lines.append(f'=== {label} 분석 ===')
    lines.append(f'(BOM 부품명 총 {result["bom_total"]}개, 명칭도감 유효 페이지 {result["page_total"]}개)')
    lines.append('')

    # 미사용 페이지
    lines.append('[미사용 페이지]')
    if result['unused']:
        for pg in result['unused']:
            parts_str = ', '.join(pg['parts'])
            asm = f' {pg["assembly"]}' if pg['assembly'] else ''
            lines.append(
                f"  - {pg['file']} (p{pg['page']}){asm}: {parts_str} → BOM 없음"
            )
    else:
        lines.append('  (없음)')
    lines.append('')

    # 부분 사용 페이지
    lines.append('[부분 사용 페이지]')
    if result['partial']:
        for pg in result['partial']:
            asm = f' {pg["assembly"]}' if pg['assembly'] else ''
            matched_str = ', '.join(f'✓{n}' for n in pg['matched'])
            unmatched_str = ', '.join(f'✗{n}' for n in pg['unmatched'])
            lines.append(
                f"  - {pg['file']} (p{pg['page']}){asm}: {matched_str} / {unmatched_str}"
            )
    else:
        lines.append('  (없음)')
    lines.append('')

    # 요약
    lines.append(f'[완전 사용]: {len(result["full"])}페이지')
    lines.append(f'[미사용]:   {len(result["unused"])}페이지')
    lines.append(f'[부분 사용]: {len(result["partial"])}페이지')
    lines.append('')
    return '\n'.join(lines)


# ── 메인 ──────────────────────────────────────────────────────────────
def main():
    conn = sqlite3.connect(DB_PATH)

    all_reports = []
    for config in VEHICLE_CONFIGS:
        result = analyze(config, conn)
        report = format_report(result)
        all_reports.append(report)
        print(report)

    conn.close()

    # 미사용/부분사용 목록만 파일에 저장
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write('명칭도감 BOM 매칭 분석 결과\n')
        f.write('=' * 60 + '\n\n')
        for report in all_reports:
            f.write(report)
            f.write('\n')

    print(f'[저장 완료] {OUTPUT_FILE}')


if __name__ == '__main__':
    main()
