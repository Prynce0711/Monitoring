import { useEffect, useMemo, useState } from 'react'
import { api, type AuthUser } from '../services/api'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getCurrentUser()
      setUser(result.user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to check sign-in status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.getCurrentUser().then((result) => {
      if (active) setUser(result.user)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to check sign-in status.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function login(username: string, password: string) {
    const signedInUser = await api.login(username, password)
    setUser(signedInUser)
    setError(null)
  }

  async function logout() {
    await api.logout()
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, error, login, logout, reload }), [
    user, loading, error,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
