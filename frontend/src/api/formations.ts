import client from './client'
import type { Formation } from '../types'

export const formationApi = {
  list: (vehicleId: number) =>
    client.get<Formation[]>(`/vehicles/${vehicleId}/formations`).then((r) => r.data),
  create: (vehicleId: number, data: { formation_no: number; status?: string; notes?: string }) =>
    client.post<Formation>(`/vehicles/${vehicleId}/formations`, data).then((r) => r.data),
  createBulk: (vehicleId: number, count: number) =>
    client.post<Formation[]>(`/vehicles/${vehicleId}/formations/bulk`, { count }).then((r) => r.data),
  update: (formationId: number, data: { status: string; notes?: string }) =>
    client.put<Formation>(`/vehicles/formations/${formationId}`, data).then((r) => r.data),
  delete: (formationId: number) => client.delete(`/vehicles/formations/${formationId}`),
}
