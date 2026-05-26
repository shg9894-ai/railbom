"""
KTX-1 부품도해집 index.json 생성 + bom_node_diagrams 매칭.

index.json 구조는 ktx730/index.json과 동일한 포맷으로,
카테고리(cat1~cat8)별로 pages 리스트를 구성.

PART 매핑:
  PART100 차체계통      → cat8 (차체·설비)
  PART200 기계계통      → cat6 (주행)  ← 대차/윤축 포함
  PART300/400 제동계통  → cat5 (제동)
  PART500 견인제동계통  → cat1 (전력추진)
  PART600 전기계통      → cat3 (보조전원)
  PART700 보조공기초화  → cat4 (운전실·제어)
  PART800 제어안전계통  → cat4 (운전실·제어)
  차량일반              → cat8 (차체·설비)
  special_tools         → None (제외)
"""
import psycopg2, json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

DATABASE_URL = 'postgresql://postgres.aaulsiamrueeusppajbl:tjrgml0212%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'
INDEX_OUT = r'C:\Dev\railway-bom\frontend\public\diagrams\KTX-1\index.json'

CAT_LABEL = {
    'cat1': '전력추진장치',
    'cat2': '연결장치',
    'cat3': '보조전원장치',
    'cat4': '운전실·제어장치',
    'cat5': '제동장치',
    'cat6': '주행장치',
    'cat7': '차상신호장치',
    'cat8': '차체·설비',
}


def chapter_to_cat(chapter: str | None, assembly: str | None) -> str | None:
    """
    산천류 기준 category_code 매핑:
    1=전력추진, 2=연결, 3=보조전원, 4=운전실·제어, 5=제동, 6=주행, 7=차상신호, 8=차체·설비

    KTX-1 부품도해집 PART 구성:
    PART100 차체계통       → cat8 (차체·설비)
    PART200 기계계통       → cat6 (주행), 단 연결기 관련은 cat2
    PART300/400 제동계통   → cat5 (제동)
    PART500 견인제동계통   → cat1 (전력추진)
    PART600 전기계통       → cat3 (보조전원)
    PART700 보조/공기초화  → cat3 (보조전원)
    PART800 제어안전계통   → cat4 (운전실·제어), 단 TVM/ATP/ATC는 cat7
    차량일반/하부설비       → cat8 (차체·설비)
    TVM/신호 관련          → cat7 (차상신호)
    연결기 관련            → cat2 (연결)
    """
    # assembly 이름 기반 우선 분류 (chapter와 무관하게)
    if assembly:
        a = assembly.upper()
        # 연결기: PART200 내에도 있음
        if any(k in a for k in ('COUPL', '연결기', 'COUPLING', 'KNUCKLE', 'HOOK EYE', 'TRACTION HOOK')):
            return 'cat2'
        # 차상신호: chapter 무관
        if any(k in a for k in ('TVM', 'ATP', 'ATC', 'SIGNAL', '신호', 'CAB SIGNAL')):
            return 'cat7'

    if not chapter:
        if not assembly or assembly in ('목차', '예비품 및 특수공구 부품도해집'):
            return None
        a = assembly.upper()
        if any(k in a for k in ('차량일반', '하부설비')):
            return 'cat8'
        # 미분류는 기본 cat8
        return 'cat8'

    c = chapter.upper()
    if 'SPECIAL' in c:
        return None
    if '100' in c:
        return 'cat8'
    if '200' in c:
        return 'cat6'
    if '300' in c or '400' in c:
        return 'cat5'
    if '500' in c:
        return 'cat1'
    if '600' in c or '700' in c:
        return 'cat3'
    if '800' in c:
        return 'cat4'
    if '차량일반' in c or '하부설비' in c:
        return 'cat8'
    return None


conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT id, file_no, chapter, assembly, drawing_no, parent_assembly
    FROM diagram_pages WHERE vehicle='KTX-1'
    ORDER BY file_no
""")
pages = cur.fetchall()

# index.json 구성
manifest = {k: {'label': v, 'pages': []} for k, v in CAT_LABEL.items()}
mat_index = {}

skip_assemblies = {'목차', '예비품 및 특수공구 부품도해집', None}

for pid, file_no, chapter, assembly, drawing_no, parent_assembly in pages:
    if assembly in skip_assemblies:
        continue
    cat = chapter_to_cat(chapter, assembly)
    if not cat:
        continue

    entry = {
        'page': file_no,
        'file': f'ktx1_p{file_no}.jpg',
        'mat_nos': [],
        'assembly': assembly or '',
        'sub_assembly': parent_assembly,
        'chapter': chapter or '',
        'parts': [],
        'diagram_page_id': pid,
    }
    manifest[cat]['pages'].append(entry)

# 각 카테고리 page 수 출력
print('=== index.json 카테고리별 페이지 수 ===')
total = 0
for k, v in manifest.items():
    print(f'  {k} ({v["label"]}): {len(v["pages"])}개')
    total += len(v['pages'])
print(f'  합계: {total}개 (전체 564개 중 목차/특수공구 제외)')

index_data = {'mat_index': mat_index, 'manifest': manifest}
with open(INDEX_OUT, 'w', encoding='utf-8') as f:
    json.dump(index_data, f, ensure_ascii=False, indent=2)
print(f'\nindex.json 저장: {INDEX_OUT}')

# ── BOM 노드 매칭 ──────────────────────────────────────────────
print('\n=== BOM 노드 ↔ diagram_pages 매칭 ===')

cur.execute("SELECT id, name FROM bom_nodes WHERE vehicle_type_id=5")
bom_nodes = {r[0]: r[1] for r in cur.fetchall()}

def normalize(s):
    if not s:
        return ''
    s = re.sub(r'[\s()\[\]/,_·\-　、。]', '', s).lower()
    s = re.sub(r'<[^>]+>', '', s)
    return s

bom_norm = {nid: normalize(name) for nid, name in bom_nodes.items()}

cur.execute("""
    SELECT id, file_no, assembly
    FROM diagram_pages WHERE vehicle='KTX-1' AND assembly NOT IN ('목차','예비품 및 특수공구 부품도해집')
    AND assembly IS NOT NULL
    ORDER BY file_no
""")
diag_pages = cur.fetchall()

matched = 0
already = 0
for dpid, file_no, assembly in diag_pages:
    dn = normalize(assembly)
    if not dn:
        continue
    # BOM 노드에서 정규화 이름이 포함되는 것 찾기
    hits = [nid for nid, nn in bom_norm.items() if dn in nn or nn in dn]
    if not hits:
        continue
    for nid in hits:
        cur.execute("""
            INSERT INTO bom_node_diagrams (bom_node_id, diagram_page_id, match_type, confidence)
            VALUES (%s, %s, 'name_match', 0.7)
            ON CONFLICT DO NOTHING
        """, (nid, dpid))
        if cur.rowcount:
            matched += 1
        else:
            already += 1

conn.commit()
print(f'  새로 연결: {matched}개, 이미 있음: {already}개')
conn.close()
print('\n완료')
