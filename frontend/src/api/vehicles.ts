import client from './client'
import type { Vehicle } from '../types'

export const vehicleApi = {
  list: () => client.get<Vehicle[]>('/vehicles').then((r) => r.data),
  get: (id: number) => client.get<Vehicle>(`/vehicles/${id}`).then((r) => r.data),
  create: (data: { code: string; name: string; description?: string }) =>
    client.post<Vehicle>('/vehicles', data).then((r) => r.data),
  update: (id: number, data: { code: string; name: string; description?: string }) =>
    client.put<Vehicle>(`/vehicles/${id}`, data).then((r) => r.data),
  delete: (id: number) => client.delete(`/vehicles/${id}`),
}
