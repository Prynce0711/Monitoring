import type {
  CheckIn,
  CheckInInput,
  InternetCircuit,
  InternetCircuitInput,
  MonitoringSummary,
} from '../types/monitoring'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}

function requireId(id: string | undefined, label: string): string {
  if (!id || id === 'undefined' || id === 'null') {
    throw new Error(`${label} is required.`)
  }
  return id
}

export const api = {
  getCurrentUser: () => request<{ user: AuthUser | null }>('/api/auth/me'),
  login: (username: string, password: string) =>
    request<AuthUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  getUsers: () => request<ManagedUser[]>('/api/users'),
  createUser: (input: { username: string; password: string; role: 'admin' | 'user' }) =>
    request<ManagedUser>('/api/users', { method: 'POST', body: JSON.stringify(input) }),
  deleteUser: (id: string) =>
    request<{ id: string }>(`/api/users/${requireId(id, 'User id')}`, { method: 'DELETE' }),
  getCheckIns: () => request<CheckIn[]>('/api/check-ins'),
  getCheckIn: (id: string | undefined) => request<CheckIn>(`/api/check-ins/${requireId(id, 'Check-in id')}`),
  createCheckIn: (input: CheckInInput) =>
    request<CheckIn>('/api/check-ins', { method: 'POST', body: JSON.stringify(input) }),
  updateCheckIn: (id: string | undefined, input: CheckInInput) =>
    request<CheckIn>(`/api/check-ins/${requireId(id, 'Check-in id')}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCheckIn: (id: string | undefined) =>
    request<{ id: string }>(`/api/check-ins/${requireId(id, 'Check-in id')}`, { method: 'DELETE' }),
  getCircuits: () => request<InternetCircuit[]>('/api/internet'),
  getCircuit: (id: string | undefined) => request<InternetCircuit>(`/api/internet/${requireId(id, 'Circuit id')}`),
  createCircuit: (input: InternetCircuitInput) =>
    request<InternetCircuit>('/api/internet', { method: 'POST', body: JSON.stringify(input) }),
  updateCircuit: (id: string | undefined, input: InternetCircuitInput) =>
    request<InternetCircuit>(`/api/internet/${requireId(id, 'Circuit id')}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCircuit: (id: string | undefined) =>
    request<{ id: string }>(`/api/internet/${requireId(id, 'Circuit id')}`, { method: 'DELETE' }),
  getSummary: () => request<MonitoringSummary>('/api/summary'),
}

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export interface ManagedUser extends AuthUser {
  createdAt: string
}
