import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api } from '../../services/api'
import { useAuth } from '../../auth/context'

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15'
const labelClass = 'text-[11px] font-semibold text-slate-600'

export function AccountPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setNotice('Password changed. Other active sessions have been signed out.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[700px] space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-semibold text-slate-400">ACCOUNT SETTINGS</div>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Your account</h1>
        <p className="mt-1 text-[13px] text-slate-500">Signed in as <span className="font-semibold text-slate-700">{user?.username}</span>.</p>
      </div>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-6">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <KeyRound size={16} /> Change password
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">{notice}</p>}
        <label className={labelClass}>Current password
          <input required type="password" autoComplete="current-password" maxLength={128} className={inputClass} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label className={labelClass}>New password
          <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label className={labelClass}>Confirm new password
          <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <p className="text-[11px] text-slate-500">Use a unique password of at least 12 characters. Changing it signs out your other sessions.</p>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#26362a] disabled:opacity-60">
          <KeyRound size={14} />{saving ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
