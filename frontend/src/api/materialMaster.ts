import client from './client'

export interface BomLink {
  id: number
  bom_code: string | null
  name: string
  vehicle_code: string | null
  vehicle_name: string | null
}

export interface MaterialMasterItem {
  material_no: string
  material_desc: string | null
  manufacturer_pn: string | null
  unit: string | null
  product_group: string | null
  product_group_desc: string | null
  material_group: string | null
  material_group_desc: string | null
  material_type: string | null
  material_type_desc: string | null
  importance: string | null
  importance_desc: string | null
  procurement: string | null
  procurement_desc: string | null
  lead_time_days: number | null
  legacy_material_no: string | null
  created_date: string | null
  is_unused: boolean | null
  bom_links?: BomLink[]
}

export interface SearchResult {
  items: MaterialMasterItem[]
  total: number
  limit: number
  offset: number
}

export interface PrefixItem { prefix: string; cnt: number; sub_count: number }
export interface TypeItem   { code: string; name: string; cnt: number }

export interface Groups {
  product_group_prefixes: PrefixItem[]
  material_types: TypeItem[]
}

export interface Stats {
  total: number
  ersa_count: number
  hibe_count: number
  unused_count: number
  active_count: number
}

export interface MaterialDetail extends MaterialMasterItem {
  spec: string | null
  type_approval_desc: string | null
  safety_cert_desc: string | null
  safety_type_desc: string | null
  industry_desc: string | null
  inspection_desc: string | null
  eval_class_desc: string | null
  bom_links: BomLink[]
}

export interface EcatAttribute { name: string; value: string; unit: string; desc: string }
export interface EcatImage { filename: string; url: string }
export interface EcatMaterial {
  material_no: string
  material_desc_full: string
  material_desc_40: string
  group_classification_no: string
  group_classification_name: string
  group_classification_en: string
  group_classification_desc: string
  product_group: string
  product_group_desc: string
  unit: string
  manufacturer_pn: string
  created_date: string
  procurement_name: string
  safety_code: string
  safety_type: string
  is_unused: boolean
  use_plant: string
  stock_count: string
  optimal_stock: string
  lead_time: string
  yearly_plan_amount: string
  registered_company_count: string
  contract_in_progress: string
  contract_completed: string
  avg_contract_amount: string
  category_2: string
  purchase_group: string
  purchase_group_name: string
  last_update_date: string
  last_update_time: string
  attributes: EcatAttribute[]
  images: EcatImage[]
  source_url: string
}

export interface SyncResult {
  scanned_range: string
  scanned_count: number
  found_count: number
  next_start: number
}

export const ecatApi = {
  material: (materialNo: string): Promise<EcatMaterial> =>
    client.get(`/ecat/material/${encodeURIComponent(materialNo)}`).then(r => r.data),

  syncNew: (params: { start?: number; count?: number; concurrency?: number }): Promise<SyncResult> =>
    client.post('/ecat/sync-new', params).then(r => r.data),

  syncStatus: (): Promise<{ total: number; max_no: number; recent_updated: number }> =>
    client.get('/ecat/sync-status').then(r => r.data),
}

export const materialMasterApi = {
  search: (params: {
    q?: string
    product_group_prefix?: string
    material_type?: string
    is_unused?: boolean
    limit?: number
    offset?: number
  }): Promise<SearchResult> =>
    client.get('/material-master/search', { params }).then(r => r.data),

  groups: (): Promise<Groups> =>
    client.get('/material-master/groups').then(r => r.data),

  stats: (): Promise<Stats> =>
    client.get('/material-master/stats').then(r => r.data),

  detail: (materialNo: string): Promise<MaterialDetail> =>
    client.get(`/material-master/${encodeURIComponent(materialNo)}`).then(r => r.data),
}

// 용품별그룹 prefix 라벨 (코레일 표 기준)
// 자재번호 prefix 별 큰 분류:
//   1xxxxxx (ERSA) 보수품  → AA~FF + II
//   7xxxxxx (HIBE) 비재고품 → GG, JJ, KK (+ 일부)
export const PRODUCT_GROUP_PREFIX_LABEL: Record<string, string> = {
  // 고속차량
  'AA01': '궤도',
  // 일반차량 (BB01~BB04)
  'BB01': 'KTX',
  'BB02': '디젤동차',
  'BB03': '디젤기관차',
  'BB04': '전기기관차',
  // 전동차량 (BB05~BB08)
  'BB05': '전동차',
  'BB06': '객차',
  'BB07': '화차',
  'BB08': '발전차',
  // 시설/전기/기타 (BB09~BB13)
  'BB09': '차량복구장비',
  'BB10': '차량공통',
  'BB11': '간선형전기동차',
  'BB12': 'KTX-산천',
  'BB13': 'KTX-이음',
  // 전철 및 전력 / 통신 / 신호 (CC01~CC04)
  'CC01': '전철 및 전력',
  'CC02': '통신',
  'CC03': '신호',
  'CC04': '전기/신호 공통',
  // 금속 / 시설 / 연료
  'DD01': '금속',
  'EE01': '시설',
  'FF01': '연료 및 윤활류',
  // 기계기구·보선·대표 (보수품/비)
  'GG01': '기계기구및비품',
  'HH01': '제용품',
  'II01': '보선장비',
  'JJ00': '대표자재(기계기구)',
  'KK00': '대표자재(제용품)',
}

// prefix별 큰 구분 (보수품/비)
export const PRODUCT_GROUP_CATEGORY: Record<string, '보수품' | '비' | '보수품·비'> = {
  AA01: '보수품',
  BB01: '보수품', BB02: '보수품', BB03: '보수품', BB04: '보수품',
  BB05: '보수품', BB06: '보수품', BB07: '보수품', BB08: '보수품',
  BB09: '보수품', BB10: '보수품', BB11: '보수품', BB12: '보수품', BB13: '보수품',
  CC01: '보수품', CC02: '보수품', CC03: '보수품', CC04: '보수품',
  DD01: '보수품',
  EE01: '보수품',
  FF01: '비',
  GG01: '보수품·비',
  HH01: '비',
  II01: '보수품',
  JJ00: '비',
  KK00: '비',
}

// 색상으로 묶이는 큰 분류 (코레일 표의 우측 색 범례 기준)
// 고속차량 / 일반차량 / 전동차량 / 시설 / 전기 / 기타
export const PRODUCT_GROUP_BIG_CATEGORY: Record<string, '고속차량' | '일반차량' | '전동차량' | '시설' | '전기' | '기타'> = {
  AA01: '고속차량',
  BB01: '일반차량', BB02: '일반차량', BB03: '일반차량', BB04: '일반차량',
  BB05: '전동차량', BB06: '전동차량', BB07: '전동차량', BB08: '전동차량',
  BB09: '시설', BB10: '전기', BB11: '전동차량', BB12: '일반차량', BB13: '일반차량',
  CC01: '전기', CC02: '전기', CC03: '전기', CC04: '전기',
  DD01: '기타',
  EE01: '시설',
  FF01: '시설',
  GG01: '기타',
  HH01: '기타',
  II01: '시설',
  JJ00: '기타',
  KK00: '기타',
}

export const BIG_CATEGORY_COLOR: Record<string, string> = {
  '고속차량': '#8c8c8c',
  '일반차량': '#1677ff',
  '전동차량': '#722ed1',
  '시설':     '#cf1322',
  '전기':     '#52c41a',
  '기타':     '#bfbfbf',
}
