import client from './client'

export interface RepairKitItem {
  id: number
  ref_node_id: number
  quantity: number
  notes: string | null
  sort_order: number
  material_no: string
  name: string
  name_en: string | null
  manufacturer_pn: string | null
}

export interface RepairKit {
  id: number
  parent_id: number
  material_no: string
  name: string
  node_type: 'repair_kit'
  items: RepairKitItem[]
}

export const repairKitApi = {
  create: (data: { parent_id: number; name: string; ref_node_ids: number[]; quantities?: Record<number, number> }) =>
    client.post<RepairKit>('/repair-kits', data).then(r => r.data),

  getByParent: (parentId: number) =>
    client.get<RepairKit[]>(`/repair-kits/by-parent/${parentId}`).then(r => r.data),

  get: (kitId: number) =>
    client.get<RepairKit>(`/repair-kits/${kitId}`).then(r => r.data),

  addItem: (kitId: number, data: { ref_node_id: number; quantity?: number }) =>
    client.post<RepairKit>(`/repair-kits/${kitId}/items`, data).then(r => r.data),

  removeItem: (kitId: number, itemId: number) =>
    client.delete(`/repair-kits/${kitId}/items/${itemId}`),

  delete: (kitId: number) =>
    client.delete(`/repair-kits/${kitId}`),
}
