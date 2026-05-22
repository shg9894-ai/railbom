import client from './client'
import type { NodeMaterial } from '../types'

export interface NodeMaterialInput {
  corp_material_no: string
  vehicle_type_id?: number | null
  is_primary?: boolean
  notes?: string | null
}

export const nodeMaterialsApi = {
  list: (nodeId: number) =>
    client.get<NodeMaterial[]>(`/bom/nodes/${nodeId}/materials`).then((r) => r.data),

  add: (nodeId: number, data: NodeMaterialInput) =>
    client.post<NodeMaterial>(`/bom/nodes/${nodeId}/materials`, data).then((r) => r.data),

  update: (nodeId: number, matId: number, data: NodeMaterialInput) =>
    client.put<NodeMaterial>(`/bom/nodes/${nodeId}/materials/${matId}`, data).then((r) => r.data),

  delete: (nodeId: number, matId: number) =>
    client.delete(`/bom/nodes/${nodeId}/materials/${matId}`),
}
