import client from './client'

export interface DiagramPageRequest {
  id: number
  page_id: number
  vehicle: string
  file_no: number
  assembly: string | null
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

export const diagramPageRequestsApi = {
  create: (body: {
    page_id: number
    vehicle: string
    file_no: number
    assembly: string | null
    request_type: string
    current_value?: string | null
    requested_value?: string | null
    requester_name?: string | null
    requester_note?: string | null
  }) => client.post('/diagram-page-requests', body).then((r) => r.data),

  list: (status?: string): Promise<DiagramPageRequest[]> =>
    client.get('/diagram-page-requests', { params: status ? { status } : {} }).then((r) => r.data),

  approve: (id: number, reviewer_note?: string) =>
    client.patch(`/diagram-page-requests/${id}/approve`, { reviewer_note }).then((r) => r.data),

  reject: (id: number, reviewer_note?: string) =>
    client.patch(`/diagram-page-requests/${id}/reject`, { reviewer_note }).then((r) => r.data),
}
