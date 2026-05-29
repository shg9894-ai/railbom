export interface Vehicle {
  id: number
  code: string
  name: string
  description?: string
  sap_code?: string
  total_cars?: number
  active_cars?: number
  formation_count?: number
  manufacturer?: string
  acquisition_years?: string
  dimensions?: string
  weight_ton?: number
  created_at: string
  updated_at: string
}

export interface Formation {
  id: number
  vehicle_type_id: number
  formation_no: number
  formation_code?: string
  car_count?: number
  acquisition_date?: string
  sap_description?: string
  status: 'active' | 'maintenance' | 'retired'
  notes?: string
  created_at: string
  updated_at: string
}

export type NodeType = 'category' | 'assembly' | 'part' | 'kit' | 'repair_kit'

export interface BomNode {
  id: number
  parent_id: number | null
  vehicle_type_id: number | null
  node_type: NodeType
  category_code: string | null
  material_no: string | null
  name: string
  name_en: string | null
  specification: string | null
  unit: string
  quantity: number
  manufacturer: string | null
  manufacturer_pn: string | null
  drawing_no: string | null
  weight_kg: number | null
  material: string | null
  notes: string | null
  sort_order: number
  depth: number
  path: string
  corp_material_no: string | null
  created_at: string
  updated_at: string
  // 지연 로딩 플래그 (API에서 반환)
  has_children?: number   // 1=자식 있음, 0=없음
  compat_codes?: string[] // 같은 corp_material_no를 공유하는 다른 노드의 material_no 목록
  // 프론트 전용 (트리 조립 후)
  children?: BomNode[]
  key?: string
  title?: string
}

export interface NodeMaterial {
  id: number
  bom_node_id: number
  vehicle_type_id: number | null
  corp_material_no: string
  is_primary: number
  notes: string | null
  vehicle_name: string | null
  vehicle_code: string | null
  created_at: string
  updated_at: string
}

export interface Compatibility {
  id: number
  bom_node_id: number
  vehicle_type_id: number
  compat_type: 'compatible' | 'partial' | 'incompatible'
  notes?: string
  vehicle_name?: string
  vehicle_code?: string
}

export const CATEGORIES: { code: string; name: string }[] = [
  { code: '1', name: '전력추진' },
  { code: '2', name: '연결' },
  { code: '3', name: '보조전원' },
  { code: '4', name: '운전실및제어' },
  { code: '5', name: '제동' },
  { code: '6', name: '주행' },
  { code: '7', name: '차상신호' },
  { code: '8', name: '차체및차내외설비' },
]

/** HR-770-1-15-9-0-0-0 → HR-770-1-15-9 (trailing -0 segments 제거) */
export function formatBomCode(code: string | null | undefined): string | null {
  if (!code) return null
  return code.replace(/(-0)+$/, '') || code
}

/** HR-760-1-2-3 → '1', HR-770-2-1 → '2', null → null */
export function getCategoryCode(node: { category_code?: string | null; material_no?: string | null }): string | null {
  if (node.category_code) return node.category_code
  if (node.material_no) {
    const seg = node.material_no.split('-')[2]
    if (seg && /^[0-9]+$/.test(seg)) return seg
  }
  return null
}

export const CATEGORY_COLORS: Record<string, string> = {
  '1': '#1677ff',
  '2': '#52c41a',
  '3': '#fa8c16',
  '4': '#722ed1',
  '5': '#eb2f96',
  '6': '#13c2c2',
  '7': '#fadb14',
  '8': '#f5222d',
}

export const VEHICLE_DB_CODE: Record<number, string> = {
  1: 'emu320',
  2: 'emu260',
  3: 'KTX-산천4',
  4: 'KTX-산천2',
  5: 'KTX-1',
  6: 'KTX-산천1',
  7: 'KTX-산천3',
  8: 'ITX-마음',
}

// 플랜트 코드(로그인 ID) → 소속명
export const PLANT_NAMES: Record<string, string> = {
  '1000': '본사공통',
  '1200': '오송고속광역시설사업소',
  '1300': '서울정보통신사무소',
  '1400': '오송고속광역전기사업소',
  '1500': 'IT운영센터',
  '1600': '특별동차운영단',
  '1700': '경주고속광역시설사업소',
  '1800': '경주고속광역전기사업소',
  '1900': '청음고속광역시설사업소',
  '2000': '청음고속광역전기사업소',
  '2100': '서울본부',
  '2200': '수도권서부본부',
  '2300': '수도권동부본부',
  '2700': '대전충남본부',
  '2900': '전북본부',
  '3000': '광주본부',
  '3100': '전남본부',
  '3200': '대구본부',
  '3300': '부산경남본부',
  '3500': '충북본부',
  '3600': '경북본부',
  '3700': '강원본부',
  '4100': '고속시설사업단',
  '4200': '고속기계사업단',
  '5100': '수도권철도차량정비단',
  '5200': '부산철도차량정비단',
  '5300': '대전철도차량정비단',
  '5400': '호남철도차량정비단',
  '5500': '시흥철도차량정비단',
  '6100': '인재개발원',
  '6200': '철도연구원',
  '6400': '회계통합센터',
  '6500': '철도교통관제센터',
}
