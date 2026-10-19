import type {
  CheckIn,
  CheckInInput,
  InternetCircuit,
  InternetCircuitInput,
  PresentationContent,
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

function normalizePresentationContent(content: PresentationContent): PresentationContent {
  return {
    ...content,
    teamEndorsements: content.teamEndorsements ?? [],
  }
}

function verifySavedEndorsements(
  result: PresentationContent,
  expected: PresentationContent['teamEndorsements'],
): PresentationContent {
  if (!Array.isArray(result.teamEndorsements)) {
    throw new Error('The API server does not support saving team endorsements yet. Restart the API server, then try again.')
  }
  const savedIds = new Set(result.teamEndorsements.map((endorsement) => endorsement.id))
  if (savedIds.size !== expected.length || expected.some((endorsement) => !savedIds.has(endorsement.id))) {
    throw new Error('The server did not confirm all team endorsements were saved. Your changes are still on this page; try saving again.')
  }
  return normalizePresentationContent(result)
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
  getPresentationContent: async () =>
    normalizePresentationContent(await request<PresentationContent>('/api/presentation/content')),
  savePresentationContent: async (content: Omit<PresentationContent, 'uploads'>) => {
    const result = await request<PresentationContent>('/api/admin/presentation/content', {
      method: 'PUT',
      body: JSON.stringify(content),
    })
    return verifySavedEndorsements(result, content.teamEndorsements)
  },
  uploadPresentationImage: async (kind: 'service-desk' | 'shift', file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Unable to read the selected image.'))
      reader.onerror = () => reject(new Error('Unable to read the selected image.'))
      reader.readAsDataURL(file)
    })
    return normalizePresentationContent(await request<PresentationContent>(`/api/admin/presentation/uploads/${kind}`, {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, data: dataUrl.split(',')[1] }),
    }))
  },
  deletePresentationImage: (kind: 'service-desk' | 'shift') =>
    request<PresentationContent>(`/api/admin/presentation/uploads/${kind}`, { method: 'DELETE' })
      .then(normalizePresentationContent),
}

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export interface ManagedUser extends AuthUser {
  createdAt: string
}
