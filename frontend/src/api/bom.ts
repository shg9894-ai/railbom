import client from './client'
import type { BomNode } from '../types'

export const bomApi = {
  getTree: (vehicleId: number, category?: string) =>
    client
      .get<BomNode[]>(`/bom/tree/${vehicleId}`, { params: category ? { category } : {} })
      .then((r) => r.data),
  getRoots: (vehicleId: number, category?: string) =>
    client
      .get<BomNode[]>(`/bom/roots/${vehicleId}`, { params: category ? { category } : {} })
      .then((r) => r.data),
  getChildrenLazy: (nodeId: number) =>
    client.get<BomNode[]>(`/bom/nodes/${nodeId}/children-lazy`).then((r) => r.data),
  getNode: (nodeId: number) => client.get<BomNode>(`/bom/nodes/${nodeId}`).then((r) => r.data),
  getAncestors: (nodeId: number) =>
    client.get<BomNode[]>(`/bom/nodes/${nodeId}/ancestors`).then((r) => r.data),
  search: (vehicleId: number, q: string) =>
    client.get<BomNode[]>('/bom/search', { params: { vehicle_id: vehicleId, q } }).then((r) => r.data),
  searchGlobal: (q: string, vehicleId?: number) =>
    client.get<(BomNode & { vehicle_name: string; vehicle_code: string })[]>('/bom/search-global', {
      params: { q, ...(vehicleId ? { vehicle_id: vehicleId } : {}) },
    }).then((r) => r.data),
  create: (data: Partial<BomNode>) =>
    client.post<BomNode>('/bom/nodes', data).then((r) => r.data),
  update: (nodeId: number, data: Partial<BomNode>) =>
    client.put<BomNode>(`/bom/nodes/${nodeId}`, data).then((r) => r.data),
  move: (nodeId: number, data: { new_parent_id?: number | null; new_vehicle_type_id?: number }) =>
    client.post<BomNode>(`/bom/nodes/${nodeId}/move`, data).then((r) => r.data),
  reorder: (orderedIds: number[]) =>
    client.put('/bom/nodes/reorder', { ordered_ids: orderedIds }).then((r) => r.data),
  delete: (nodeId: number) => client.delete(`/bom/nodes/${nodeId}`),

  getNodesByMaterialNos: (materialNos: string[]) =>
    client.get<(BomNode & { vehicle_name: string; vehicle_code: string })[]>(
      '/bom/nodes-by-material-nos', { params: { material_nos: materialNos.join(',') } }
    ).then((r) => r.data),

  searchByCorpMaterialNo: (q: string) =>
    client.get<(BomNode & { vehicle_name: string; vehicle_code: string; corp_material_no: string; is_primary: number; mat_notes: string | null })[]>(
      '/bom/search-by-corp-material-no', { params: { q } }
    ).then((r) => r.data),

  getDiagrams: (nodeId: number) =>
    client.get<any[]>(`/bom/nodes/${nodeId}/diagrams`).then((r) => r.data),
  linkDiagram: (nodeId: number, data: { diagram_page_id: number; match_type?: string; confidence?: number }) =>
    client.post(`/bom/nodes/${nodeId}/diagrams`, data).then((r) => r.data),
  unlinkDiagram: (nodeId: number, linkId: number) =>
    client.delete(`/bom/nodes/${nodeId}/diagrams/${linkId}`),
  autoLinkDiagrams: (nodeId: number, diagramPageIds: number[]) =>
    client.post(`/bom/nodes/${nodeId}/diagrams/auto`, { diagram_page_ids: diagramPageIds }).then((r) => r.data),
}
