import client from './client'

export interface NativeSheet {
  sheet: string
  rows: number
}

export interface ImportResult {
  inserted: number
  updated: number
  compat_added?: number
  errors: string[]
}

export const excelApi = {
  exportBom: async (vehicleId: number, vehicleCode: string) => {
    const res = await client.get(`/excel/export/${vehicleId}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `bom_${vehicleCode}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  },
  downloadTemplate: async () => {
    const res = await client.get('/excel/template', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bom_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },
  importBom: async (vehicleId: number, file: File): Promise<ImportResult> => {
    const form = new FormData()
    form.append('file', file)
    const res = await client.post(`/excel/import/${vehicleId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
  previewNative: async (file: File): Promise<{ sheets: NativeSheet[] }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await client.post('/excel/preview-native', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
  importNative: async (
    vehicleId: number,
    file: File,
    sheetName: string,
    otherVehicleMap: Record<string, number>,
  ): Promise<ImportResult> => {
    const form = new FormData()
    form.append('file', file)
    form.append('sheet_name', sheetName)
    form.append('other_vehicle_map', JSON.stringify(otherVehicleMap))
    const res = await client.post(`/excel/import-native/${vehicleId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
