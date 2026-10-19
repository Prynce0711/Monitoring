import { useState } from 'react'
import { Activity, LockKeyhole } from 'lucide-react'
import { useAuth } from './context'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3] px-4 py-10">
      <section className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d2f36a] text-[#1c2912]">
            <Activity size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Monitorly</h1>
            <p className="text-xs text-slate-500">Sign in to your workspace</p>
          </div>
        </div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</p>}
          <label className="block text-xs font-semibold text-slate-600">
            Username
            <input
              autoComplete="username"
              required
              maxLength={32}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Password
            <input
              autoComplete="current-password"
              required
              type="password"
              maxLength={128}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#17211a] text-sm font-semibold text-white hover:bg-[#26362a] disabled:opacity-60"
          >
            <LockKeyhole size={15} />{submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
