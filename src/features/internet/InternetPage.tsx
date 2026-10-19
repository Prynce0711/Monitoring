import { useCallback, useMemo, useState } from 'react'
import { Plus, Printer, RadioTower, Search, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { useLiveCollection } from '../../hooks/useLiveCollection'
import { api } from '../../services/api'
import type { CircuitStatus, InternetCircuit } from '../../types/monitoring'

const filters: Array<'All circuits' | CircuitStatus> = ['All circuits', 'Online', 'Degraded', 'Offline']
const checkedAt = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))

export function InternetPage() {
  const load = useCallback(() => api.getCircuits(), [])
  const { data, error, refresh } = useLiveCollection<InternetCircuit[]>(load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]>('All circuits')
  const records = useMemo(() => (data ?? []).filter((record) => {
    const matchesQuery = `${record.site} ${record.provider} ${record.circuitId}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'All circuits' || record.status === filter)
  }), [data, filter, query])

  async function removeRecord(record: InternetCircuit) {
    if (!window.confirm(`Delete the internet circuit for "${record.site}"?`)) return
    try {
      await api.deleteCircuit(record.id)
      refresh()
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Unable to delete this circuit.')
    }
  }

  const count = data ?? []
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400"><RadioTower size={14} /> INFRASTRUCTURE / CONNECTIVITY</div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Dedicated internet</h1>
          <p className="mt-1 text-[13px] text-slate-500">Monitor circuit health, providers, and venue connectivity.</p>
        </div>
        <Link to="/internet/new" className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#26362a]"><Plus size={15} /> Add circuit</Link>
      </div>
      {error && <div role="alert" className="flex justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>{error}</span><button onClick={refresh} className="font-semibold underline">Retry</button></div>}

      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {[
          { label: 'Online', count: count.filter((circuit) => circuit.status === 'Online').length, color: 'bg-emerald-500' },
          { label: 'Degraded', count: count.filter((circuit) => circuit.status === 'Degraded').length, color: 'bg-amber-500' },
          { label: 'Offline', count: count.filter((circuit) => circuit.status === 'Offline').length, color: 'bg-rose-500' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2.5"><span className={`h-2 w-2 rounded-full ${item.color}`} /><span className="text-[12px] font-medium text-slate-600">{item.label}</span></div>
            <span className="text-[17px] font-semibold text-slate-900">{item.count}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900"><Wifi size={15} className="text-[#819d3a]" /> Circuit inventory <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{records.length}</span></h2>
            <p className="mt-1 text-[10px] text-slate-400">Connection status and provider details by venue.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input aria-label="Search circuits" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search circuits..." className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#9dbc4d] max-sm:w-36" />
            </label>
            <button onClick={() => window.print()} aria-label="Print circuits" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Printer size={15} /></button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 pt-1">
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={`shrink-0 border-b-2 px-3 py-2.5 text-[11px] font-medium transition ${filter === item ? 'border-[#91ad49] text-[#526c25]' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {item}{item === 'All circuits' ? ` (${data?.length ?? 0})` : ''}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead className="bg-[#fafbf9] text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <tr><th className="px-5 py-3">Venue / site</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Circuit ID</th><th className="px-4 py-3">Bandwidth</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last checked</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 text-[12px] font-semibold text-slate-800">{record.site}</td>
                  <td className="px-4 py-4 text-[12px] text-slate-600">{record.provider}</td>
                  <td className="px-4 py-4 font-mono text-[10px] text-slate-500">{record.circuitId}</td>
                  <td className="px-4 py-4 text-[12px] text-slate-600">{record.bandwidth}</td>
                  <td className="px-4 py-4"><StatusBadge status={record.status} />{record.notes && <span className="mt-1 block max-w-44 truncate text-[10px] text-slate-400">{record.notes}</span>}</td>
                  <td className="px-4 py-4 text-[11px] text-slate-500">{checkedAt(record.lastChecked)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link to={`/internet/${record.id}/edit`} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Edit</Link>
                    <button onClick={() => void removeRecord(record)} className="ml-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-50">Delete</button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center"><p className="text-[13px] font-medium text-slate-600">{query || filter !== 'All circuits' ? 'No circuits match your filters.' : 'No circuits yet.'}</p><p className="mt-1 text-[11px] text-slate-400">Add a circuit to start monitoring connectivity.</p></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400"><span>Showing {records.length} of {data?.length ?? 0} circuits</span><span>Live sync enabled</span></div>
      </div>
    </div>
  )
}
