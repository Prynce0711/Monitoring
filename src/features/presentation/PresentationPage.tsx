import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import type {
  InternetRequest,
  PresentationContent,
  PresentationProject,
  PresentationStatus,
  TeamEndorsement,
  VenueSetupRequest,
} from '../../types/monitoring'

const slideDurationSeconds = 30
const requestsPerSlide = 6
const panelClass = 'min-h-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(24,39,30,0.07)]'
const thClass = 'whitespace-normal px-3 py-3 text-left text-sm font-semibold uppercase tracking-wide text-slate-400'
const tdClass = 'px-3 py-3 text-base font-semibold leading-snug text-slate-700'

type PresentationSlide =
  | { type: 'projects'; page: number; totalPages: number; records: PresentationProject[] }
  | { type: 'internet'; page: number; totalPages: number; records: InternetRequest[] }
  | { type: 'venue'; page: number; totalPages: number; records: VenueSetupRequest[] }
  | { type: 'endorsements'; page: number; totalPages: number; records: TeamEndorsement[] }
  | { type: 'upload'; kind: 'service-desk' | 'shift'; title: string }

function pages<T>(records: T[], pageSize: number) {
  if (records.length === 0) return [[] as T[]]
  const result: T[][] = []
  for (let index = 0; index < records.length; index += pageSize) {
    result.push(records.slice(index, index + pageSize))
  }
  return result
}

function buildSlides(content: PresentationContent): PresentationSlide[] {
  const slides: PresentationSlide[] = []
  slides.push({
    type: 'projects',
    page: 1,
    totalPages: 1,
    records: content.projects.filter((project) => project.status !== 'Done'),
  })
  const internetPages = pages(content.internetRequests, requestsPerSlide)
  internetPages.forEach((records, index) => slides.push({
    type: 'internet',
    page: index + 1,
    totalPages: internetPages.length,
    records,
  }))
  const venuePages = pages(content.venueSetupRequests, requestsPerSlide)
  venuePages.forEach((records, index) => slides.push({
    type: 'venue',
    page: index + 1,
    totalPages: venuePages.length,
    records,
  }))
  const endorsementPages = pages(content.teamEndorsements, requestsPerSlide)
  endorsementPages.forEach((records, index) => slides.push({
    type: 'endorsements',
    page: index + 1,
    totalPages: endorsementPages.length,
    records,
  }))
  if (content.uploads.some((upload) => upload.kind === 'service-desk')) {
    slides.push({ type: 'upload', kind: 'service-desk', title: 'Service Desk update' })
  }
  if (content.uploads.some((upload) => upload.kind === 'shift')) {
    slides.push({ type: 'upload', kind: 'shift', title: 'IT shift schedule' })
  }
  return slides
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function StatusPill({ status }: { status: PresentationStatus }) {
  const tone = status === 'Done'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'Ongoing'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-amber-50 text-amber-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>
}

function SlideTitle({ title, page, totalPages }: { title: string; page: number; totalPages: number }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-base font-semibold uppercase tracking-[0.15em] text-[#819d3a]">Monitorly operations</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#172b40] sm:text-5xl">{title}</h2>
      </div>
      {totalPages > 1 && <span className="rounded-full bg-white px-4 py-2 text-base font-semibold text-slate-500 shadow-sm">Page {page} of {totalPages}</span>}
    </div>
  )
}

export function PresentationPage() {
  const requestSequence = useRef(0)
  const [content, setContent] = useState<PresentationContent>({
    projects: [],
    internetRequests: [],
    venueSetupRequests: [],
    teamEndorsements: [],
    uploads: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [secondsRemaining, setSecondsRemaining] = useState(slideDurationSeconds)
  const slideIndexRef = useRef(0)
  const slideCountRef = useRef(1)
  const secondsRemainingRef = useRef(slideDurationSeconds)

  useEffect(() => {
    let active = true
    const load = async () => {
      const sequence = ++requestSequence.current
      try {
        const nextContent = await api.getPresentationContent()
        if (active && sequence === requestSequence.current) {
          setContent(nextContent)
          setError(null)
          setLoading(false)
        }
      } catch (cause) {
        if (active && sequence === requestSequence.current) {
          setError(cause instanceof Error ? cause.message : 'Unable to load dashboard data.')
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

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const slides = buildSlides(content)
  const currentSlideIndex = slideIndex % slides.length

  useEffect(() => {
    slideIndexRef.current = slideIndex % slides.length
    slideCountRef.current = slides.length
  }, [slideIndex, slides.length])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (secondsRemainingRef.current > 1) {
        secondsRemainingRef.current -= 1
      } else {
        slideIndexRef.current = (slideIndexRef.current + 1) % slideCountRef.current
        secondsRemainingRef.current = slideDurationSeconds
        setSlideIndex(slideIndexRef.current)
      }
      setSecondsRemaining(secondsRemainingRef.current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function toggleFullscreen() {
    setFullscreenError(null)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch (cause) {
      setFullscreenError(cause instanceof Error ? cause.message : 'Fullscreen mode is unavailable.')
    }
  }

  const currentSlide = slides[currentSlideIndex]
  const currentUpload = currentSlide.type === 'upload'
    ? content.uploads.find((upload) => upload.kind === currentSlide.kind)
    : undefined
  const countdownLabel = `${Math.floor(secondsRemaining / 60).toString().padStart(2, '0')}:${(secondsRemaining % 60).toString().padStart(2, '0')}`

  function goToSlide(index: number) {
    const nextIndex = (index + slides.length) % slides.length
    slideIndexRef.current = nextIndex
    secondsRemainingRef.current = slideDurationSeconds
    setSlideIndex(nextIndex)
    setSecondsRemaining(slideDurationSeconds)
  }

  return (
    <main className="dashboard-screen relative h-dvh overflow-hidden bg-[#f3f5f1] p-2 sm:p-3 lg:p-4">
      <div className="mx-auto grid h-full max-w-[1900px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Back to administration" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={17} />
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              <Activity size={16} className="text-[#819d3a]" /> Monitorly operations
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 normal-case tracking-normal ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {live ? 'Live updates on' : 'Connecting…'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/presentation" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Manage slides</Link>
            <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17211a] px-3 text-sm font-semibold text-white hover:bg-[#26362a]">
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </header>

        {(error || fullscreenError) && <p role="alert" className="absolute right-4 top-2 z-20 max-w-[60vw] truncate rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">{error ?? fullscreenError}</p>}

        <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {loading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center text-base text-slate-400">Loading presentation…</div>
          ) : currentSlide.type === 'projects' ? (
            <>
              <SlideTitle title="Active projects and activities" page={currentSlide.page} totalPages={currentSlide.totalPages} />
              <div className="grid min-h-0 flex-1 grid-cols-2 grid-flow-col content-stretch gap-x-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_10px_35px_rgba(24,39,30,0.07)] sm:p-5"
                style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(currentSlide.records.length / 2))}, minmax(0, 1fr))` }}>
                {currentSlide.records.map((project, index) => (
                  <div key={project.id} className="flex min-h-0 min-w-0 items-center gap-2 overflow-hidden border-b border-slate-100 py-1">
                    <span className="w-7 shrink-0 text-sm font-semibold tabular-nums text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                    <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal break-words text-lg font-bold leading-tight text-slate-800">{project.title || 'Untitled activity'}</span>
                    <StatusPill status={project.status} />
                  </div>
                ))}
                {currentSlide.records.length === 0 && <p className="col-span-2 flex items-center justify-center text-base text-slate-400">No active projects.</p>}
              </div>
            </>
          ) : currentSlide.type === 'internet' ? (
            <>
              <SlideTitle title="Dedicated connection requests" page={currentSlide.page} totalPages={currentSlide.totalPages} />
              <div className={`${panelClass} min-h-0 flex-1 overflow-auto`}>
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[14%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>{['Status', 'Event', 'Date / time', 'Bandwidth', 'SSID name', 'Password name', 'Room', 'Organizer', 'Remarks'].map((label) => <th className={thClass} key={label}>{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSlide.records.map((request) => (
                      <tr key={request.id}>
                        <td className={tdClass}><StatusPill status={request.status} /></td>
                        <td className={`${tdClass} whitespace-normal break-words font-medium text-slate-800`}>{request.eventName || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{formatDate(request.startDate)}{request.startTime ? ` · ${request.startTime}` : ''}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.bandwidth || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.ssidName || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.passwordName || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.functionRoom || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.eventsOrganizer || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.remarks || '—'}</td>
                      </tr>
                    ))}
                    {currentSlide.records.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-base text-slate-400">No dedicated connection requests.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : currentSlide.type === 'venue' ? (
            <>
              <SlideTitle title="Venue setup requests" page={currentSlide.page} totalPages={currentSlide.totalPages} />
              <div className={`${panelClass} min-h-0 flex-1 overflow-auto`}>
                <table className="w-full table-fixed text-left">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>{['Status', 'Event', 'Date', 'BEO', 'Computers', 'Room', 'Organizer'].map((label) => <th className={thClass} key={label}>{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSlide.records.map((request) => (
                      <tr key={request.id}>
                        <td className={tdClass}><StatusPill status={request.status} /></td>
                        <td className={`${tdClass} whitespace-normal break-words font-medium text-slate-800`}>{request.eventDescription || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{formatDate(request.startDate)}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.beoNumber || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.noOfComputers || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.functionRoom || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{request.eventsOrganizer || '—'}</td>
                      </tr>
                    ))}
                    {currentSlide.records.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-base text-slate-400">No venue setup requests.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : currentSlide.type === 'endorsements' ? (
            <>
              <SlideTitle title="Team endorsement" page={currentSlide.page} totalPages={currentSlide.totalPages} />
              <div className={`${panelClass} min-h-0 flex-1 overflow-auto`}>
                <table className="w-full table-fixed text-left">
                  <thead className="sticky top-0 bg-[#17637f] text-white">
                    <tr>{['Item No', 'Endorse date', 'Notes', 'Assign to', 'Status'].map((label) => <th className={`${thClass} text-white`} key={label}>{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentSlide.records.map((endorsement, index) => (
                      <tr key={endorsement.id} className={index % 2 === 0 ? 'bg-slate-100' : 'bg-white'}>
                        <td className={tdClass}>{(currentSlide.page - 1) * requestsPerSlide + index + 1}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{formatDate(endorsement.endorseDate)}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{endorsement.notes || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words`}>{endorsement.assignTo || '—'}</td>
                        <td className={`${tdClass} whitespace-normal break-words capitalize`}>{endorsement.status}</td>
                      </tr>
                    ))}
                    {currentSlide.records.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-base text-slate-400">No team endorsements.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4">
              {currentUpload
                ? <img src={currentUpload.imageUrl} alt={currentSlide.title} className="h-full w-full object-contain" />
                : <p className="text-base text-slate-500">This slide image is unavailable.</p>}
            </div>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-base font-medium text-slate-500">Slide {currentSlideIndex + 1} of {slides.length} <span className="mx-1 text-slate-300">·</span> advances in <span className="font-semibold tabular-nums text-slate-800">{countdownLabel}</span></p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goToSlide(currentSlideIndex - 1)} aria-label="Previous slide" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronLeft size={20} /></button>
            <button type="button" onClick={() => goToSlide(currentSlideIndex + 1)} aria-label="Next slide" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronRight size={20} /></button>
          </div>
        </footer>
      </div>
    </main>
  )
}
