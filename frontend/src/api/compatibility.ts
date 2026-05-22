import client from './client'
import type { Compatibility } from '../types'

export const compatApi = {
  byNode: (nodeId: number) =>
    client.get<Compatibility[]>('/compatibility', { params: { node_id: nodeId } }).then((r) => r.data),
  byVehicle: (vehicleId: number) =>
    client.get<Compatibility[]>('/compatibility', { params: { vehicle_id: vehicleId } }).then((r) => r.data),
  upsert: (data: { bom_node_id: number; vehicle_type_id: number; compat_type?: string; notes?: string }) =>
    client.post<Compatibility>('/compatibility', data).then((r) => r.data),
  delete: (id: number) => client.delete(`/compatibility/${id}`),
}
