import { useCallback, useMemo, useState } from 'react'
import { CalendarDays, Plus, Printer, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { useLiveCollection } from '../../hooks/useLiveCollection'
import { api } from '../../services/api'
import type { CheckIn, CheckInStatus } from '../../types/monitoring'

const filters: Array<'All statuses' | CheckInStatus> = ['All statuses', 'Pending', 'Confirmed', 'Checked in', 'At risk']
const when = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))

export function CheckInsPage() {
  const load = useCallback(() => api.getCheckIns(), [])
  const { data, error, refresh } = useLiveCollection<CheckIn[]>(load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]>('All statuses')
  const records = useMemo(() => (data ?? []).filter((record) => {
    const matchesQuery = `${record.event} ${record.venue} ${record.contact}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'All statuses' || record.status === filter)
  }), [data, filter, query])

  async function removeRecord(record: CheckIn) {
    if (!window.confirm(`Delete the check-in for "${record.event}"?`)) return
    try {
      await api.deleteCheckIn(record.id)
      refresh()
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Unable to delete this check-in.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400"><CalendarDays size={14} /> OPERATIONS / VENUES</div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Venue check-ins</h1>
          <p className="mt-1 text-[13px] text-slate-500">Track event arrivals and keep venue teams ready.</p>
        </div>
        <Link to="/check-ins/new" className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#26362a]"><Plus size={15} /> Add check-in</Link>
      </div>
      {error && <div role="alert" className="flex justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>{error}</span><button onClick={refresh} className="font-semibold underline">Retry</button></div>}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">Check-in schedule <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{records.length}</span></h2>
            <p className="mt-1 text-[10px] text-slate-400">Records sync automatically when updated.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input aria-label="Search check-ins" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search check-ins..." className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#9dbc4d] max-sm:w-36" />
            </label>
            <button onClick={() => window.print()} aria-label="Print check-ins" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Printer size={15} /></button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 pt-1">
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={`shrink-0 border-b-2 px-3 py-2.5 text-[11px] font-medium transition ${filter === item ? 'border-[#91ad49] text-[#526c25]' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {item}{item === 'All statuses' ? ` (${data?.length ?? 0})` : ''}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#fafbf9] text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <tr><th className="px-5 py-3">Event</th><th className="px-4 py-3">Venue</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Check-in time</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4"><span className="block text-[12px] font-semibold text-slate-800">{record.event}</span>{record.notes && <span className="mt-1 block max-w-56 truncate text-[10px] text-slate-400">{record.notes}</span>}</td>
                  <td className="px-4 py-4 text-[12px] text-slate-600">{record.venue}</td>
                  <td className="px-4 py-4 text-[12px] text-slate-600">{record.contact}</td>
                  <td className="px-4 py-4 text-[11px] text-slate-500">{when(record.checkInAt)}</td>
                  <td className="px-4 py-4"><StatusBadge status={record.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <Link to={`/check-ins/${record.id}/edit`} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Edit</Link>
                    <button onClick={() => void removeRecord(record)} className="ml-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-50">Delete</button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center"><p className="text-[13px] font-medium text-slate-600">{query || filter !== 'All statuses' ? 'No check-ins match your filters.' : 'No check-ins yet.'}</p><p className="mt-1 text-[11px] text-slate-400">Add a check-in to start tracking venue arrivals.</p></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">
          <span>Showing {records.length} of {data?.length ?? 0} check-ins</span><span>Live sync enabled</span>
        </div>
      </div>
    </div>
  )
}
