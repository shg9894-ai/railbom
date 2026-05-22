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

export type NodeType = 'category' | 'assembly' | 'part' | 'kit'

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
  6: 'KTX-산천1',
}
