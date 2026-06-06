import client from './client'

export interface VehicleTypeUnits {
  vehicle_type_id: number
  vehicle_type_code: string
  vehicle_type_name: string
  active_units: number
  inactive_units: number
  total_units: number
}

export interface CountsSummary {
  by_vehicle_type: VehicleTypeUnits[]
  total_units: number
  active_units: number
  inactive_units: number
}

export const vehicleUnitsApi = {
  countsSummary: (): Promise<CountsSummary> =>
    client.get('/vehicle-units/counts-summary').then(r => r.data),
}
