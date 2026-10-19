import { useEffect, useState } from 'react'
import { ArrowLeft, RadioTower, Save } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import type { CircuitStatus, InternetCircuitInput } from '../../types/monitoring'

const emptyForm: InternetCircuitInput = {
  site: '', provider: '', circuitId: '', bandwidth: '', status: 'Online',
  lastChecked: new Date().toISOString().slice(0, 16), notes: '',
}
const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15'
const labelClass = 'text-[11px] font-semibold text-slate-600'

export function InternetEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<InternetCircuitInput>(emptyForm)
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    api.getCircuit(id).then((record) => {
      if (active) setForm({
        site: record.site, provider: record.provider, circuitId: record.circuitId,
        bandwidth: record.bandwidth, status: record.status,
        lastChecked: record.lastChecked.slice(0, 16), notes: record.notes,
      })
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load circuit.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [id])

  function update<K extends keyof InternetCircuitInput>(key: K, value: InternetCircuitInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, lastChecked: new Date(form.lastChecked).toISOString() }
      if (id) await api.updateCircuit(id, payload)
      else await api.createCircuit(payload)
      navigate('/internet')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save circuit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[850px] space-y-6">
      <Link to="/internet" className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={14} /> Back to circuits</Link>
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400"><RadioTower size={14} /> INFRASTRUCTURE / CONNECTIVITY</div>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{id ? 'Edit circuit' : 'Add a circuit'}</h1>
        <p className="mt-1 text-[13px] text-slate-500">Record connection details and the latest health status.</p>
      </div>
      <form onSubmit={(event) => void submit(event)} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        {error && <div role="alert" className="m-5 mb-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{error}</div>}
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 p-6 max-sm:grid-cols-1 max-sm:p-4">
          {loading ? <div className="col-span-2 py-10 text-center text-sm text-slate-400">Loading circuit…</div> : <>
            <label className={labelClass}>Venue / site<input required maxLength={300} className={inputClass} value={form.site} onChange={(event) => update('site', event.target.value)} placeholder="e.g. Harbor Convention Center" /></label>
            <label className={labelClass}>Provider<input required maxLength={300} className={inputClass} value={form.provider} onChange={(event) => update('provider', event.target.value)} placeholder="e.g. Lumen" /></label>
            <label className={labelClass}>Circuit ID<input required maxLength={300} className={inputClass} value={form.circuitId} onChange={(event) => update('circuitId', event.target.value)} placeholder="Provider circuit reference" /></label>
            <label className={labelClass}>Bandwidth<input required maxLength={300} className={inputClass} value={form.bandwidth} onChange={(event) => update('bandwidth', event.target.value)} placeholder="e.g. 1 Gbps" /></label>
            <label className={labelClass}>Connection status<select className={inputClass} value={form.status} onChange={(event) => update('status', event.target.value as CircuitStatus)}><option>Online</option><option>Degraded</option><option>Offline</option></select></label>
            <label className={labelClass}>Last checked<input required type="datetime-local" className={inputClass} value={form.lastChecked} onChange={(event) => update('lastChecked', event.target.value)} /></label>
            <label className={`${labelClass} col-span-2 max-sm:col-span-1`}>Notes <span className="font-normal text-slate-400">(optional)</span><textarea maxLength={2000} rows={4} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Add service notes or provider ticket details…" /></label>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-[#fcfcfb] px-6 py-4 max-sm:px-4">
          <Link to="/internet" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</Link>
          <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-[#26362a] disabled:cursor-not-allowed disabled:opacity-60"><Save size={14} />{saving ? 'Saving…' : id ? 'Save changes' : 'Create circuit'}</button>
        </div>
      </form>
    </div>
  )
}
