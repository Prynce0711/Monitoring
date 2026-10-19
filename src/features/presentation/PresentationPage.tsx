import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  Clock3,
  Maximize,
  Minimize,
  Pause,
  Play,
  RadioTower,
  Wifi,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { api } from '../../services/api'
import type { CheckIn, InternetCircuit, MonitoringSummary } from '../../types/monitoring'

const checkInsPerSlide = 8
const circuitsPerSlide = 7
const slideIntervalMs = 12_000

type Slide =
  | { type: 'overview' }
  | { type: 'checkins'; page: number; records: CheckIn[] }
  | { type: 'circuits'; page: number; records: InternetCircuit[] }

function pages<T>(records: T[], perPage: number) {
  if (records.length === 0) return [[] as T[]]
  const result: T[][] = []
  for (let index = 0; index < records.length; index += perPage) {
    result.push(records.slice(index, index + perPage))
  }
  return result
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value))
}

function PresentationMetric({ title, value, detail, icon: Icon, accent }: {
  title: string
  value: number
  detail: string
  icon: typeof CalendarDays
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#fbfcfa] p-5 sm:p-7">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={21} />
      </div>
      <p className="text-sm font-medium text-slate-500 sm:text-base">{title}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{value}</p>
      <p className="mt-2 text-xs text-slate-500 sm:text-sm">{detail}</p>
    </div>
  )
}

function PresentationPage() {
  const screenRef = useRef<HTMLElement>(null)
  const requestSequence = useRef(0)
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [circuits, setCircuits] = useState<InternetCircuit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const sequence = ++requestSequence.current
      try {
        const [nextSummary, nextCheckIns, nextCircuits] = await Promise.all([
          api.getSummary(),
          api.getCheckIns(),
          api.getCircuits(),
        ])
        if (active && sequence === requestSequence.current) {
          setSummary(nextSummary)
          setCheckIns(nextCheckIns)
          setCircuits(nextCircuits)
          const nextSlideCount = 1
            + Math.max(1, Math.ceil(nextCheckIns.length / checkInsPerSlide))
            + Math.max(1, Math.ceil(nextCircuits.length / circuitsPerSlide))
          setSlideIndex((index) => Math.min(index, nextSlideCount - 1))
          setError(null)
          setLoading(false)
        }
      } catch (cause) {
        if (active && sequence === requestSequence.current) {
          setError(cause instanceof Error ? cause.message : 'Unable to load presentation data.')
          setLoading(false)
        }
      }
    }

    void load()
    const events = new EventSource('/api/events')
    events.onopen = () => {
      if (active) setLive(true)
      void load()
    }
    events.onmessage = () => void load()
    events.onerror = () => {
      if (active) setLive(false)
    }
    return () => {
      active = false
      events.close()
    }
  }, [])

  const slides = useMemo<Slide[]>(() => [
    { type: 'overview' },
    ...pages(checkIns, checkInsPerSlide).map((records, page) => ({ type: 'checkins' as const, page, records })),
    ...pages(circuits, circuitsPerSlide).map((records, page) => ({ type: 'circuits' as const, page, records })),
  ], [checkIns, circuits])
  const currentSlide = slides[slideIndex] ?? slides[0]

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setSlideIndex((index) => (index + 1) % slides.length)
    }, slideIntervalMs)
    return () => window.clearInterval(timer)
  }, [playing, slides.length])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input, textarea, select')) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        setSlideIndex((index) => (index + 1) % slides.length)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        setSlideIndex((index) => (index - 1 + slides.length) % slides.length)
      } else if (event.key === ' ') {
        event.preventDefault()
        setPlaying((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [slides.length])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === screenRef.current)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    setFullscreenError(null)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await screenRef.current?.requestFullscreen()
    } catch (cause) {
      setFullscreenError(cause instanceof Error ? cause.message : 'Fullscreen mode is unavailable.')
    }
  }

  function moveSlide(direction: -1 | 1) {
    setSlideIndex((index) => (index + direction + slides.length) % slides.length)
  }

  const title = currentSlide.type === 'overview'
    ? 'Operations overview'
    : currentSlide.type === 'checkins'
      ? 'Venue check-ins'
      : 'Dedicated internet'
  const pageLabel = currentSlide.type === 'overview'
    ? 'Live operations'
    : `Page ${currentSlide.page + 1}`

  return (
    <section ref={screenRef} className="presentation-screen min-h-[calc(100vh-68px)] bg-[#f3f5f1] px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-124px)] w-full max-w-[1500px] flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!isFullscreen && (
              <Link to="/" aria-label="Back to dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                <ArrowLeft size={17} />
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <Activity size={13} className="text-[#819d3a]" /> Monitorly presentation
                <span className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 normal-case tracking-normal ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {live ? 'Live updates on' : 'Connecting…'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{pageLabel} · Changes appear here automatically</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause presentation' : 'Play presentation'} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {playing ? <Pause size={15} /> : <Play size={15} />}
              <span className="hidden sm:inline">{playing ? 'Pause' : 'Auto-play'}</span>
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#17211a] px-3 text-xs font-semibold text-white hover:bg-[#26362a]">
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}
        {fullscreenError && <p role="alert" className="mb-3 text-xs text-rose-700">{fullscreenError}</p>}

        <article aria-label={`${title} presentation slide`} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_35px_rgba(24,39,30,0.08)]">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-6 py-6 sm:px-10 sm:py-8 lg:px-14">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#819d3a]">
                {currentSlide.type === 'overview' ? 'Operations briefing' : currentSlide.type === 'checkins' ? 'Venue operations' : 'Network health'}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[#172b40] sm:text-4xl lg:text-5xl">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {currentSlide.type === 'overview'
                  ? formatDate(new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  : currentSlide.type === 'checkins'
                    ? `${checkIns.length} tracked check-ins`
                    : `${circuits.length} monitored circuits`}
              </p>
            </div>
            <div className="pb-1 text-left sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Slide {slideIndex + 1} of {slides.length}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{formatDate(new Date().toISOString(), { hour: 'numeric', minute: '2-digit' })} · Live</p>
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-10 sm:py-8 lg:px-14">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-400">Loading the latest monitoring data…</div>
            ) : currentSlide.type === 'overview' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
                  <PresentationMetric title="Tracked check-ins" value={summary?.checkins.total ?? checkIns.length} detail={`${summary?.checkins.checkedIn ?? 0} completed`} icon={CalendarDays} accent="bg-lime-50 text-lime-700" />
                  <PresentationMetric title="Pending check-ins" value={summary?.checkins.pending ?? 0} detail={`${summary?.checkins.atRisk ?? 0} need attention`} icon={Clock3} accent="bg-amber-50 text-amber-700" />
                  <PresentationMetric title="Circuits online" value={summary?.circuits.online ?? 0} detail={`of ${summary?.circuits.total ?? circuits.length} monitored`} icon={Wifi} accent="bg-blue-50 text-blue-700" />
                  <PresentationMetric title="Network alerts" value={(summary?.circuits.degraded ?? 0) + (summary?.circuits.offline ?? 0)} detail={`${summary?.circuits.offline ?? 0} offline`} icon={CircleAlert} accent="bg-rose-50 text-rose-700" />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Upcoming check-ins</h2>
                      <span className="text-xs text-slate-400">{checkIns.length} total</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {checkIns.slice(0, 4).map((record) => (
                        <div key={record.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{record.event}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">{record.venue} · {formatDate(record.checkInAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                          </div>
                          <StatusBadge status={record.status} />
                        </div>
                      ))}
                      {checkIns.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No check-ins recorded.</p>}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Circuit health</h2>
                      <RadioTower size={17} className="text-[#819d3a]" />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {circuits.slice(0, 4).map((circuit) => (
                        <div key={circuit.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{circuit.site}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">{circuit.provider} · {circuit.bandwidth}</p>
                          </div>
                          <StatusBadge status={circuit.status} />
                        </div>
                      ))}
                      {circuits.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No circuits recorded.</p>}
                    </div>
                  </section>
                </div>
              </div>
            ) : currentSlide.type === 'checkins' ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(120px,0.8fr)_minmax(110px,0.8fr)] gap-3 bg-[#172b40] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white sm:px-6">
                  <span>Event</span><span>Venue</span><span>Check-in</span><span>Status</span>
                </div>
                {currentSlide.records.length === 0 ? (
                  <p className="px-6 py-16 text-center text-sm text-slate-400">No check-ins recorded.</p>
                ) : currentSlide.records.map((record, index) => (
                  <div key={record.id} className={`grid min-h-[62px] grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(120px,0.8fr)_minmax(110px,0.8fr)] items-center gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 ${index % 2 ? 'bg-[#fafbf9]' : 'bg-white'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{record.event}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{record.contact}</p>
                    </div>
                    <span className="truncate text-xs text-slate-600 sm:text-sm">{record.venue}</span>
                    <span className="text-[11px] text-slate-500 sm:text-xs">{formatDate(record.checkInAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    <span><StatusBadge status={record.status} /></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(100px,0.8fr)_minmax(100px,0.7fr)_minmax(105px,0.8fr)] gap-3 bg-[#172b40] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white sm:px-6">
                  <span>Venue / site</span><span>Provider</span><span>Circuit ID</span><span>Bandwidth</span><span>Status</span>
                </div>
                {currentSlide.records.length === 0 ? (
                  <p className="px-6 py-16 text-center text-sm text-slate-400">No internet circuits recorded.</p>
                ) : currentSlide.records.map((circuit, index) => (
                  <div key={circuit.id} className={`grid min-h-[66px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(100px,0.8fr)_minmax(100px,0.7fr)_minmax(105px,0.8fr)] items-center gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 ${index % 2 ? 'bg-[#fafbf9]' : 'bg-white'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{circuit.site}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">Checked {formatDate(circuit.lastChecked, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <span className="truncate text-xs text-slate-600 sm:text-sm">{circuit.provider}</span>
                    <span className="truncate font-mono text-[10px] text-slate-500 sm:text-xs">{circuit.circuitId}</span>
                    <span className="text-xs text-slate-600 sm:text-sm">{circuit.bandwidth}</span>
                    <div className="min-w-0">
                      <StatusBadge status={circuit.status} />
                      {circuit.notes && <p className="mt-1 truncate text-[10px] text-slate-400">{circuit.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-8">
            <p className="text-[10px] text-slate-400 sm:text-xs">Use ← → to navigate · Space to {playing ? 'pause' : 'play'}</p>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-1.5 sm:flex" aria-label="Slide indicators">
                {slides.map((slide, index) => (
                  <button key={`${slide.type}-${index}`} type="button" onClick={() => setSlideIndex(index)} aria-label={`Go to slide ${index + 1}`} aria-current={index === slideIndex ? 'step' : undefined} className={`h-2 rounded-full transition-all ${index === slideIndex ? 'w-6 bg-[#819d3a]' : 'w-2 bg-slate-200 hover:bg-slate-300'}`} />
                ))}
              </div>
              <button type="button" onClick={() => moveSlide(-1)} aria-label="Previous slide" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                <ArrowLeft size={15} />
              </button>
              <button type="button" onClick={() => moveSlide(1)} aria-label="Next slide" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#17211a] text-white hover:bg-[#26362a]">
                <ArrowRight size={15} />
              </button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  )
}

export { PresentationPage }
