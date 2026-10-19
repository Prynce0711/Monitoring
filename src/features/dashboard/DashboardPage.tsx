import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, CalendarCheck2, CircleAlert, Clock3, Globe2, Plus, RadioTower, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { api } from '../../services/api'
import type { CheckIn, InternetCircuit, MonitoringSummary } from '../../types/monitoring'

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

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function DashboardPage() {
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [circuits, setCircuits] = useState<InternetCircuit[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [nextSummary, nextCheckins, nextCircuits] = await Promise.all([
          api.getSummary(), api.getCheckIns(), api.getCircuits(),
        ])
        if (active) {
          setSummary(nextSummary)
          setCheckins(nextCheckins)
          setCircuits(nextCircuits)
          setError(null)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.')
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

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900">Today’s check-ins</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">Upcoming venue arrivals and event readiness</p>
          </div>
          <Link to="/check-ins" className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900">View all <ArrowRight size={13} /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-[#fafbf9] text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
              <tr><th className="px-5 py-3">Event</th><th className="px-4 py-3">Venue</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkins.slice(0, 4).map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-800">{record.event}</td>
                  <td className="px-4 py-3.5 text-[12px] text-slate-500">{record.venue}</td>
                  <td className="px-4 py-3.5 text-[12px] text-slate-500">{record.contact}</td>
                  <td className="px-4 py-3.5 text-[12px] text-slate-500">{dateLabel(record.checkInAt)}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={record.status} /></td>
                  <td className="px-5 py-3.5"><Link aria-label={`Edit ${record.event}`} to={`/check-ins/${record.id}/edit`} className="text-slate-400 hover:text-slate-800"><ArrowUpRight size={16} /></Link></td>
                </tr>
              ))}
              {checkins.length === 0 && <tr><td colSpan={6} className="px-5 py-9 text-center text-sm text-slate-400">No check-ins yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-[1.3fr_0.7fr] gap-4 max-lg:grid-cols-1">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><RadioTower size={16} /></span>
              <div><h2 className="text-[13px] font-semibold text-slate-900">Dedicated internet</h2><p className="mt-0.5 text-[10px] text-slate-400">Circuit health across all venues</p></div>
            </div>
            <Link to="/internet" className="text-[11px] font-semibold text-slate-500 hover:text-slate-900">View circuits <ArrowRight className="ml-1 inline" size={13} /></Link>
          </div>
          <div className="divide-y divide-slate-100">
            {circuits.slice(0, 3).map((circuit) => (
              <div key={circuit.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-slate-800">{circuit.site}</p><p className="mt-0.5 text-[10px] text-slate-400">{circuit.provider} · {circuit.bandwidth}</p></div>
                <StatusBadge status={circuit.status} />
              </div>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-[#d5f078] p-5 text-[#2b391d]">
          <div className="relative z-10">
            <span className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/60"><Globe2 size={18} /></span>
            <h2 className="max-w-[220px] text-[17px] font-semibold leading-snug">Your operations, all in one place.</h2>
            <p className="mt-2 max-w-[240px] text-[11px] leading-5 text-[#526439]">Check-ins and connectivity stay in sync across every open workspace.</p>
            <Link to="/internet" className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#354620] hover:underline">Explore network status <ArrowRight size={13} /></Link>
          </div>
          <div className="absolute -bottom-12 -right-8 h-40 w-40 rounded-full border-[24px] border-white/20" />
          <div className="absolute -bottom-6 -right-1 h-28 w-28 rounded-full border-[14px] border-white/20" />
        </div>
      </section>
    </div>
  )
}
