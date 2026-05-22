import client from './client'

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export interface DiagramPage {
  id: number
  vehicle: string
  file_no: number
  book_page: number | null
  source_file: string | null
  page_type: string | null
  chapter_no: number | null
  chapter: string | null
  assembly: string | null
  parent_assembly: string | null
  parent_part_no: number | null
  drawing_no: string | null
  parts: { part_no: string; part_name: string }[]
}

export const diagramPagesApi = {
  byDrawingNo: (drawing_no: string, vehicle?: string): Promise<DiagramPage[]> =>
    client
      .get(`/diagram-pages/by-drawing/${encodeURIComponent(drawing_no)}`, {
        params: vehicle ? { vehicle } : {},
      })
      .then((r) => r.data),

  imageUrl: (file_no: number, vehicle?: string) =>
    `${API_BASE}/diagram-pages/image/${file_no}${vehicle ? `?vehicle=${vehicle}` : ''}`,

  hasPages: (
    drawing_nos: string[],
    vehicle?: string,
    node_names?: string[],
  ): Promise<{ matched_drawing_nos: string[]; matched_node_names: string[] }> =>
    client
      .post('/diagram-pages/has-pages', { drawing_nos, node_names: node_names ?? [] }, {
        params: vehicle ? { vehicle } : {},
      })
      .then((r) => r.data),

  byPageType: (vehicle: string, page_type: string): Promise<DiagramPage[]> =>
    client
      .get(`/diagram-pages/${vehicle}`, { params: { page_type } })
      .then((r) => r.data),

  byAssembly: (assembly: string, vehicle: string): Promise<DiagramPage[]> =>
    client
      .get('/diagram-pages/by-assembly', { params: { assembly, vehicle } })
      .then((r) => r.data),

  allPages: (vehicle: string): Promise<DiagramPage[]> =>
    client
      .get(`/diagram-pages/${vehicle}`)
      .then((r) => r.data),
}
