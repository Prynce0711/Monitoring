export type CheckInStatus = 'Pending' | 'Confirmed' | 'Checked in' | 'At risk'
export type CircuitStatus = 'Online' | 'Degraded' | 'Offline'

export interface CheckIn {
  id: string
  event: string
  venue: string
  contact: string
  checkInAt: string
  status: CheckInStatus
  notes: string
  updatedAt: string
}

export interface CheckInInput {
  event: string
  venue: string
  contact: string
  checkInAt: string
  status: CheckInStatus
  notes: string
}

export interface InternetCircuit {
  id: string
  site: string
  provider: string
  circuitId: string
  bandwidth: string
  status: CircuitStatus
  lastChecked: string
  notes: string
  updatedAt: string
}

export interface InternetCircuitInput {
  site: string
  provider: string
  circuitId: string
  bandwidth: string
  status: CircuitStatus
  lastChecked: string
  notes: string
}

export interface MonitoringSummary {
  checkins: {
    total: number
    pending: number
    atRisk: number
    checkedIn: number
  }
  circuits: {
    total: number
    online: number
    degraded: number
    offline: number
  }
}
