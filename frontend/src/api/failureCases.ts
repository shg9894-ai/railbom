import client from './client'

export interface FailureCase {
  id: number
  node_id: number
  title: string
  symptom: string | null
  cause: string | null
  action: string | null
  author: string | null
  created_at: string
  updated_at: string
}

export const failureCasesApi = {
  listByNode: (node_id: number): Promise<FailureCase[]> =>
    client.get(`/failure-cases/node/${node_id}`).then(r => r.data),

  create: (data: { node_id: number; title: string; symptom?: string; cause?: string; action?: string; author?: string }): Promise<{ id: number }> =>
    client.post('/failure-cases', data).then(r => r.data),

  update: (id: number, data: { title?: string; symptom?: string; cause?: string; action?: string }): Promise<void> =>
    client.patch(`/failure-cases/${id}`, data).then(r => r.data),

  delete: (id: number): Promise<void> =>
    client.delete(`/failure-cases/${id}`).then(r => r.data),
}
