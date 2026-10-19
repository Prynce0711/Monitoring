import { useCallback, useEffect, useState } from 'react'
import { UserPlus, UserRoundX } from 'lucide-react'
import { api, type ManagedUser } from '../../services/api'
import { useAuth } from '../../auth/context'

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15'
const labelClass = 'text-[11px] font-semibold text-slate-600'

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      const records = await api.getUsers()
      setUsers(records)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.getUsers().then((records) => {
      if (active) setUsers(records)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load accounts.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await api.createUser({ username, password, role })
      setUsername('')
      setPassword('')
      setRole('user')
      setNotice('Account created.')
      await loadUsers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account.')
    } finally {
      setSaving(false)
    }
  }

  async function removeUser(target: ManagedUser) {
    if (!window.confirm(`Remove the account "${target.username}"? Their active sessions will end.`)) return
    setError(null)
    setNotice(null)
    try {
      await api.deleteUser(target.id)
      setUsers((existing) => existing.filter((item) => item.id !== target.id))
      setNotice(`Removed ${target.username}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove account.')
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-semibold text-slate-400">ACCESS CONTROL</div>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">User accounts</h1>
        <p className="mt-1 text-[13px] text-slate-500">Only accounts created by an administrator can sign in.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{notice}</p>}

      <form onSubmit={(event) => void createUser(event)} className="rounded-xl border border-slate-200/80 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Create account</h2>
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <label className={labelClass}>Username
            <input required minLength={3} maxLength={32} autoComplete="off" className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className={labelClass}>Temporary password
            <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className={labelClass}>Access level
            <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'user')}>
              <option value="user">User — manage records</option>
              <option value="admin">Administrator — manage records and accounts</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#26362a] disabled:opacity-60">
          <UserPlus size={14} />{saving ? 'Creating…' : 'Create account'}
        </button>
        <p className="mt-3 text-[11px] text-slate-500">Passwords must be at least 12 characters. Share passwords with users privately.</p>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Existing accounts</h2>
        </div>
        {loading ? <p className="px-5 py-8 text-center text-sm text-slate-400">Loading accounts…</p> : users.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">No accounts found.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-5 py-3 font-semibold">Username</th><th className="px-5 py-3 font-semibold">Role</th><th className="px-5 py-3 font-semibold">Created</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((account) => (
                  <tr key={account.id}>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{account.username}{account.id === currentUser?.id && <span className="ml-2 font-normal text-slate-400">You</span>}</td>
                    <td className="px-5 py-3.5 capitalize text-slate-600">{account.role}</td>
                    <td className="px-5 py-3.5 text-slate-500">{new Date(account.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      {account.id !== currentUser?.id && <button type="button" aria-label={`Remove ${account.username}`} onClick={() => void removeUser(account)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><UserRoundX size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
