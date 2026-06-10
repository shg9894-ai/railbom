import client from './client'

export interface Inquiry {
  id: number
  user_id?: string
  user_role?: string
  page_path?: string
  message: string
  screenshot_url: string | null
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'
  admin_reply: string | null
  replied_by?: string | null
  replied_at?: string | null
  created_at: string
}

export const inquiriesApi = {
  create: async (data: { message: string; page_path?: string; screenshot?: Blob | File }) => {
    const fd = new FormData()
    fd.append('message', data.message)
    if (data.page_path) fd.append('page_path', data.page_path)
    if (data.screenshot) {
      // Blob에 이름이 없으면 파일명 보강
      const name = (data.screenshot as any).name || `paste_${Date.now()}.png`
      fd.append('screenshot', data.screenshot, name)
    }
    const r = await client.post('/inquiries', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return r.data as { id: number; status: string }
  },
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    client.get<Inquiry[]>('/inquiries', { params }).then(r => r.data),
  my: () => client.get<Inquiry[]>('/inquiries/my').then(r => r.data),
  reply: (id: number, body: { status?: string; admin_reply?: string }) =>
    client.put(`/inquiries/${id}`, body).then(r => r.data),
}
