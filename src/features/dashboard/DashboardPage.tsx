import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarCheck2, CircleAlert, Clock3, Plus, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { api } from '../../services/api'
import type { MonitoringSummary, PresentationContent, PresentationStatus } from '../../types/monitoring'

function MetricCard({ title, value, helper, icon: Icon, tone }: {
  title: string
  value: number
  helper: string
  icon: typeof CalendarCheck2
  tone: 'lime' | 'amber' | 'blue' | 'rose'
}) {
  const tones = {
    lime: 'bg-[#f2f8e6] text-[#698526]',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(20,30,20,0.02)]">
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-medium text-slate-500">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={17} /></span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-[30px] font-semibold leading-none tracking-tight text-slate-900">{value}</span>
        <span className="mb-0.5 text-[11px] text-slate-400">{helper}</span>
      </div>
    </div>
  )
}

function RequestStatus({ status }: { status: PresentationStatus }) {
  const style = status === 'Done'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'Ongoing'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-amber-50 text-amber-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${style}`}>{status}</span>
}

export function DashboardPage() {
  const { user } = useAuth()
  const requestSequence = useRef(0)
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [presentation, setPresentation] = useState<PresentationContent>({
    projects: [],
    internetRequests: [],
    venueSetupRequests: [],
    teamEndorsements: [],
    uploads: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [presentationLoaded, setPresentationLoaded] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const sequence = ++requestSequence.current
      try {
        const [nextSummary, nextPresentation] = await Promise.all([
          api.getSummary(), api.getPresentationContent(),
        ])
        if (active && sequence === requestSequence.current) {
          setSummary(nextSummary)
          setPresentation(nextPresentation)
          setPresentationLoaded(true)
          setError(null)
        }
      } catch (cause) {
        if (active && sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.')
      }
    }
    void refresh()
    const events = new EventSource('/api/events')
    events.onmessage = () => void refresh()
    events.onopen = () => {
      if (active) {
        setError(null)
        void refresh()
      }
    }
    events.onerror = () => {
      if (active) setError('Live updates are reconnecting. Data may be briefly out of date.')
    }
    return () => {
      active = false
      events.close()
    }
  }, [])

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#879b53]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9dbc4d]" /> {today}
          </div>
          <h1 className="text-[27px] font-semibold tracking-tight text-slate-900">{greeting}, Alex <span className="text-2xl">✳</span></h1>
          <p className="mt-1 text-[13px] text-slate-500">Here’s what’s happening across your operations today.</p>
        </div>
        <Link to="/check-ins/new" className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#26362a]">
          <Plus size={15} /> Add a record
        </Link>
      </div>

      {error && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1" aria-label="Monitoring summary">
        <MetricCard title="Tracked check-ins" value={summary?.checkins.total ?? 0} helper={`${summary?.checkins.checkedIn ?? 0} completed`} icon={CalendarCheck2} tone="lime" />
        <MetricCard title="Pending check-ins" value={summary?.checkins.pending ?? 0} helper={`${summary?.checkins.atRisk ?? 0} need attention`} icon={Clock3} tone="amber" />
        <MetricCard title="Circuits online" value={summary?.circuits.online ?? 0} helper={`of ${summary?.circuits.total ?? 0} total`} icon={Wifi} tone="blue" />
        <MetricCard title="Network alerts" value={(summary?.circuits.degraded ?? 0) + (summary?.circuits.offline ?? 0)} helper={`${summary?.circuits.offline ?? 0} offline`} icon={CircleAlert} tone="rose" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Internet dedicated connection requests</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{presentationLoaded ? `${presentation.internetRequests.length} requests` : 'Loading requests…'}</p>
            </div>
            {user?.role === 'admin' && <Link to="/admin/presentation" className="shrink-0 text-[11px] font-semibold text-slate-500 hover:text-slate-900">Manage <ArrowRight className="ml-1 inline" size={13} /></Link>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left">
              <thead className="bg-[#fafbf9] text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                <tr>{['Status', 'Events name', 'Start date', 'Start time', 'Bandwidth', 'SSID name', 'Password name', 'Function room', 'Events organizer', 'Remarks'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presentation.internetRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-3"><RequestStatus status={request.status} /></td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-800">{request.eventName || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{request.startDate || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.startTime || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.bandwidth || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.ssidName || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.passwordName || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.functionRoom || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.eventsOrganizer || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.remarks || '—'}</td>
                  </tr>
                ))}
                {presentationLoaded && presentation.internetRequests.length === 0 && <tr><td colSpan={10} className="px-5 py-9 text-center text-xs text-slate-400">No dedicated connection requests added.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Check-in venue setup requests</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{presentationLoaded ? `${presentation.venueSetupRequests.length} requests` : 'Loading requests…'}</p>
            </div>
            {user?.role === 'admin' && <Link to="/admin/presentation" className="shrink-0 text-[11px] font-semibold text-slate-500 hover:text-slate-900">Manage <ArrowRight className="ml-1 inline" size={13} /></Link>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-[#fafbf9] text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                <tr>{['Status', 'Event description', 'Start date', 'BEO number', 'No. of computers', 'Function room', 'Events organizer'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presentation.venueSetupRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-3"><RequestStatus status={request.status} /></td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-800">{request.eventDescription || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{request.startDate || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.beoNumber || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.noOfComputers || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.functionRoom || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{request.eventsOrganizer || '—'}</td>
                  </tr>
                ))}
                {presentationLoaded && presentation.venueSetupRequests.length === 0 && <tr><td colSpan={7} className="px-5 py-9 text-center text-xs text-slate-400">No venue setup requests added.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  )
}
