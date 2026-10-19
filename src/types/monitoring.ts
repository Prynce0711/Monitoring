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

export type PresentationStatus = 'Pending' | 'Ongoing' | 'Done'

export interface PresentationProject {
  id: string
  sortOrder: number
  title: string
  status: PresentationStatus
}

export interface InternetRequest {
  id: string
  sortOrder: number
  status: PresentationStatus
  eventName: string
  startDate: string
  startTime: string
  bandwidth: string
  ssidName: string
  passwordName: string
  functionRoom: string
  eventsOrganizer: string
  remarks: string
}

export interface VenueSetupRequest {
  id: string
  sortOrder: number
  status: PresentationStatus
  eventDescription: string
  startDate: string
  beoNumber: string
  noOfComputers: string
  functionRoom: string
  eventsOrganizer: string
}

export interface TeamEndorsement {
  id: string
  sortOrder: number
  endorseDate: string
  notes: string
  assignTo: string
  status: PresentationStatus
}

export interface PresentationUpload {
  kind: 'service-desk' | 'shift'
  fileName: string
  mimeType: string
  updatedAt: string
  size: number
  imageUrl: string
}

export interface PresentationContent {
  projects: PresentationProject[]
  internetRequests: InternetRequest[]
  venueSetupRequests: VenueSetupRequest[]
  teamEndorsements: TeamEndorsement[]
  uploads: PresentationUpload[]
}
