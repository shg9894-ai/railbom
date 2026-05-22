import client from './client'

export interface ChangeRequest {
  id: number
  node_id: number
  node_name: string
  vehicle_type_id: number
  vehicle_name: string | null
  material_no: string | null
  corp_material_no: string | null
  request_type: string
  current_value: string | null
  requested_value: string | null
  requester_name: string | null
  requester_note: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  reviewer_note: string | null
}

export interface ChangeRequestCreate {
  node_id: number
  request_type: string
  current_value?: string | null
  requested_value?: string | null
  requester_name?: string | null
  requester_note?: string | null
}

export const changeRequestsApi = {
  list: (status?: string): Promise<ChangeRequest[]> =>
    client.get('/change-requests', { params: status ? { status } : {} }).then((r) => r.data),

  create: (body: ChangeRequestCreate): Promise<{ id: number; status: string }> =>
    client.post('/change-requests', body).then((r) => r.data),

  approve: (id: number, reviewer_note?: string): Promise<{ id: number; status: string }> =>
    client.patch(`/change-requests/${id}/approve`, { reviewer_note }).then((r) => r.data),

  reject: (id: number, reviewer_note?: string): Promise<{ id: number; status: string }> =>
    client.patch(`/change-requests/${id}/reject`, { reviewer_note }).then((r) => r.data),
}
