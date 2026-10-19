import { useEffect, useState } from 'react'
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import type {
  InternetRequest,
  PresentationContent,
  PresentationStatus,
  PresentationUpload,
  TeamEndorsement,
  VenueSetupRequest,
} from '../../types/monitoring'

const fieldClass = 'h-9 w-full min-w-[100px] rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#9dbc4d] focus:ring-2 focus:ring-[#9dbc4d]/15'
const statusOptions: PresentationStatus[] = ['Pending', 'Ongoing', 'Done']

function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function blankInternetRequest(): InternetRequest {
  return {
    id: newId(), sortOrder: 0, status: 'Pending', eventName: '',
    startDate: new Date().toISOString().slice(0, 10), startTime: '',
    bandwidth: '', ssidName: '', passwordName: '',
    functionRoom: '', eventsOrganizer: '', remarks: '',
  }
}

function blankVenueRequest(): VenueSetupRequest {
  return {
    id: newId(), sortOrder: 0, status: 'Pending', eventDescription: '',
    startDate: new Date().toISOString().slice(0, 10), beoNumber: '',
    noOfComputers: '', functionRoom: '', eventsOrganizer: '',
  }
}

function blankTeamEndorsement(): TeamEndorsement {
  return {
    id: newId(), sortOrder: 0, endorseDate: new Date().toISOString().slice(0, 10),
    notes: '', assignTo: '', status: 'Pending',
  }
}

function updateRow<T extends { id: string }, K extends keyof T>(
  rows: T[],
  id: string,
  key: K,
  value: T[K],
) {
  return rows.map((row) => row.id === id ? { ...row, [key]: value } : row)
}

function removeRow<T extends { id: string }>(rows: T[], id: string) {
  return rows.filter((row) => row.id !== id)
}

function StatusSelect({ value, onChange }: {
  value: PresentationStatus
  onChange: (value: PresentationStatus) => void
}) {
  return (
    <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value as PresentationStatus)}>
      {statusOptions.map((status) => <option key={status}>{status}</option>)}
    </select>
  )
}

function UploadPanel({ kind, title, description, upload, onChange }: {
  kind: 'service-desk' | 'shift'
  title: string
  description: string
  upload?: PresentationUpload
  onChange: (content: PresentationContent) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP screenshot.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('The screenshot must be 8 MB or smaller.')
      return
    }
    setBusy(true)
    try {
      onChange(await api.uploadPresentationImage(kind, file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to upload screenshot.')
    } finally {
      setBusy(false)
    }
  }

  async function removeFile() {
    setError(null)
    setBusy(true)
    try {
      onChange(await api.deletePresentationImage(kind))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove screenshot.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#17211a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#26362a]">
          <Upload size={14} />{busy ? 'Working…' : upload ? 'Replace screenshot' : 'Upload screenshot'}
          <input
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              void uploadFile(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
      {upload ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <img src={upload.imageUrl} alt={`${title} screenshot preview`} className="max-h-72 w-full object-contain" />
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2">
            <span className="truncate text-[11px] text-slate-500">{upload.fileName} · {new Date(upload.updatedAt).toLocaleString()}</span>
            <button type="button" disabled={busy} onClick={() => void removeFile()} aria-label={`Remove ${title} screenshot`} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
          <span className="flex items-center gap-2"><ImagePlus size={15} /> No screenshot uploaded. This dashboard section will be hidden.</span>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-400">PNG, JPEG, or WebP · 8 MB maximum · only the latest screenshot is kept</p>
    </section>
  )
}

export function AdminPresentationPage() {
  const [content, setContent] = useState<PresentationContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.getPresentationContent().then((result) => {
      if (active) setContent(result)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load presentation content.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  function setItems<K extends keyof Omit<PresentationContent, 'uploads'>>(
    key: K,
    items: PresentationContent[K],
  ) {
    setContent((current) => current ? { ...current, [key]: items } : current)
    setNotice(null)
  }

  function updateUploads(result: PresentationContent) {
    setContent((current) => current ? { ...current, uploads: result.uploads } : result)
  }

  async function saveContent() {
    if (!content) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const saved = await api.savePresentationContent({
        projects: content.projects,
        internetRequests: content.internetRequests,
        venueSetupRequests: content.venueSetupRequests,
        teamEndorsements: content.teamEndorsements,
      })
      setContent(saved)
      setNotice('Dashboard data saved and published to open viewers.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save presentation data.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading presentation content…</div>
  if (!content) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error ?? 'Presentation content is unavailable.'}</p>

  const uploads = (kind: PresentationUpload['kind']) => content.uploads.find((upload) => upload.kind === kind)
  const activeProjects = content.projects.filter((project) => project.status !== 'Done')

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/presentation" className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={14} /> Open operations dashboard</Link>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">ADMINISTRATION / OPERATIONS DASHBOARD</div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Dashboard content</h1>
          <p className="mt-1 text-[13px] text-slate-500">Manage activity, request, team endorsement, and presentation slide content.</p>
        </div>
        <button type="button" onClick={() => void saveContent()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#26362a] disabled:opacity-60">
          <Save size={14} />{saving ? 'Publishing…' : 'Save and publish changes'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{notice}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Dashboard content overview">
        {[
          { label: 'Active projects', value: activeProjects.length, detail: `${content.projects.length - activeProjects.length} completed` },
          { label: 'Dedicated requests', value: content.internetRequests.length, detail: 'Connection requests' },
          { label: 'Venue requests', value: content.venueSetupRequests.length, detail: 'Setup requests' },
          { label: 'Team endorsements', value: content.teamEndorsements.length, detail: 'Endorsed activities' },
          { label: 'Dashboard images', value: content.uploads.length, detail: 'Service Desk and shift schedule' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
            <p className="mt-1 text-[10px] text-slate-400">{item.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pending projects and activities</h2>
            <p className="mt-1 text-[11px] text-slate-500">Projects not marked Done appear in the dashboard overview.</p>
          </div>
          <button type="button" onClick={() => setItems('projects', [...content.projects, { id: newId(), sortOrder: content.projects.length + 1, title: '', status: 'Pending' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Plus size={14} /> Add activity
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <tr><th className="w-14 px-4 py-3">#</th><th className="px-3 py-3">Activity</th><th className="w-36 px-3 py-3">Status</th><th className="w-16 px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {content.projects.map((project, index) => (
                <tr key={project.id}>
                  <td className="px-4 py-2 text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                  <td className="px-3 py-2"><input aria-label={`Activity ${index + 1}`} maxLength={300} className={fieldClass} value={project.title} onChange={(event) => setItems('projects', updateRow(content.projects, project.id, 'title', event.target.value))} /></td>
                  <td className="px-3 py-2"><StatusSelect value={project.status} onChange={(status) => setItems('projects', updateRow(content.projects, project.id, 'status', status))} /></td>
                  <td className="px-3 py-2"><button type="button" aria-label={`Remove activity ${index + 1}`} onClick={() => setItems('projects', removeRow(content.projects, project.id))} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {content.projects.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">No activities yet. Add one to populate the dashboard.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Internet dedicated connection requests</h2>
            <p className="mt-1 text-[11px] text-slate-500">These requests appear in the dedicated connections dashboard panel.</p>
          </div>
          <button type="button" onClick={() => setItems('internetRequests', [...content.internetRequests, blankInternetRequest()])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Plus size={14} /> Add request</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <tr>{['Status', 'Events name', 'Start date', 'Start time', 'Bandwidth', 'SSID name', 'Password name', 'Function room', 'Events organizer', 'Remarks', ''].map((heading) => <th key={heading} className="px-2 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {content.internetRequests.map((row) => (
                <tr key={row.id}>
                  <td className="w-32 px-2 py-2"><StatusSelect value={row.status} onChange={(value) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'status', value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Events name" maxLength={300} className={fieldClass} value={row.eventName} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'eventName', event.target.value))} /></td>
                  <td className="w-40 px-2 py-2"><input aria-label="Start date" type="date" className={fieldClass} value={row.startDate.slice(0, 10)} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'startDate', event.target.value))} /></td>
                  <td className="w-32 px-2 py-2"><input aria-label="Start time" maxLength={80} className={fieldClass} value={row.startTime} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'startTime', event.target.value))} /></td>
                  <td className="w-36 px-2 py-2"><input aria-label="Bandwidth" maxLength={300} className={fieldClass} value={row.bandwidth} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'bandwidth', event.target.value))} /></td>
                  <td className="w-40 px-2 py-2"><input aria-label="SSID name" maxLength={300} className={fieldClass} value={row.ssidName} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'ssidName', event.target.value))} /></td>
                  <td className="w-40 px-2 py-2"><input aria-label="Password name" maxLength={300} className={fieldClass} value={row.passwordName} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'passwordName', event.target.value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Function room" maxLength={300} className={fieldClass} value={row.functionRoom} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'functionRoom', event.target.value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Events organizer" maxLength={300} className={fieldClass} value={row.eventsOrganizer} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'eventsOrganizer', event.target.value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Remarks" maxLength={2000} className={fieldClass} value={row.remarks} onChange={(event) => setItems('internetRequests', updateRow(content.internetRequests, row.id, 'remarks', event.target.value))} /></td>
                  <td className="px-2 py-2"><button type="button" aria-label={`Remove ${row.eventName || 'internet request'}`} onClick={() => setItems('internetRequests', removeRow(content.internetRequests, row.id))} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {content.internetRequests.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-slate-400">No internet requests added.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Check-in venue setup requests</h2>
            <p className="mt-1 text-[11px] text-slate-500">Includes the BEO, computer count, function room, and event organizer.</p>
          </div>
          <button type="button" onClick={() => setItems('venueSetupRequests', [...content.venueSetupRequests, blankVenueRequest()])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Plus size={14} /> Add request</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <tr>{['Status', 'Event description', 'Start date', 'BEO number', 'No. of computers', 'Function room', 'Events organizer', ''].map((heading) => <th key={heading} className="px-2 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {content.venueSetupRequests.map((row) => (
                <tr key={row.id}>
                  <td className="w-32 px-2 py-2"><StatusSelect value={row.status} onChange={(value) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'status', value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Event description" maxLength={300} className={fieldClass} value={row.eventDescription} onChange={(event) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'eventDescription', event.target.value))} /></td>
                  <td className="w-40 px-2 py-2"><input aria-label="Setup start date" type="date" className={fieldClass} value={row.startDate.slice(0, 10)} onChange={(event) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'startDate', event.target.value))} /></td>
                  <td className="w-36 px-2 py-2"><input aria-label="BEO number" maxLength={300} className={fieldClass} value={row.beoNumber} onChange={(event) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'beoNumber', event.target.value))} /></td>
                  <td className="w-36 px-2 py-2"><input aria-label="Number of computers" maxLength={100} className={fieldClass} value={row.noOfComputers} onChange={(event) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'noOfComputers', event.target.value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Setup function room" maxLength={300} className={fieldClass} value={row.functionRoom} onChange={(event) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'functionRoom', event.target.value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Setup events organizer" maxLength={300} className={fieldClass} value={row.eventsOrganizer} onChange={(event) => setItems('venueSetupRequests', updateRow(content.venueSetupRequests, row.id, 'eventsOrganizer', event.target.value))} /></td>
                  <td className="px-2 py-2"><button type="button" aria-label={`Remove ${row.eventDescription || 'venue setup request'}`} onClick={() => setItems('venueSetupRequests', removeRow(content.venueSetupRequests, row.id))} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {content.venueSetupRequests.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400">No venue setup requests added.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Team endorsement</h2>
            <p className="mt-1 text-[11px] text-slate-500">Manage endorsement date, notes, assignee, and status for the presentation slide.</p>
          </div>
          <button type="button" onClick={() => setItems('teamEndorsements', [...content.teamEndorsements, blankTeamEndorsement()])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Plus size={14} /> Add endorsement</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="bg-[#17637f] text-[10px] font-semibold uppercase tracking-wide text-white">
              <tr>{['Item No', 'Endorse date', 'Notes', 'Assign to', 'Status', ''].map((heading) => <th key={heading} className="px-2 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {content.teamEndorsements.map((row, index) => (
                <tr key={row.id}>
                  <td className="w-24 px-3 py-2 text-xs text-slate-500">{index + 1}</td>
                  <td className="w-48 px-2 py-2"><input aria-label="Endorse date" type="date" className={fieldClass} value={row.endorseDate.slice(0, 10)} onChange={(event) => setItems('teamEndorsements', updateRow(content.teamEndorsements, row.id, 'endorseDate', event.target.value))} /></td>
                  <td className="px-2 py-2"><input aria-label="Endorsement notes" maxLength={2000} className={fieldClass} value={row.notes} onChange={(event) => setItems('teamEndorsements', updateRow(content.teamEndorsements, row.id, 'notes', event.target.value))} /></td>
                  <td className="w-56 px-2 py-2"><input aria-label="Assign to" maxLength={300} className={fieldClass} value={row.assignTo} onChange={(event) => setItems('teamEndorsements', updateRow(content.teamEndorsements, row.id, 'assignTo', event.target.value))} /></td>
                  <td className="w-40 px-2 py-2"><StatusSelect value={row.status} onChange={(value) => setItems('teamEndorsements', updateRow(content.teamEndorsements, row.id, 'status', value))} /></td>
                  <td className="w-16 px-2 py-2"><button type="button" aria-label={`Remove endorsement ${index + 1}`} onClick={() => setItems('teamEndorsements', removeRow(content.teamEndorsements, row.id))} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {content.teamEndorsements.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">No team endorsements yet. Add one to populate the slide.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dashboard images</h2>
          <p className="mt-1 text-[11px] text-slate-500">Upload the latest Service Desk and shift screenshots. Each uploaded image appears as its own white-background presentation slide.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <UploadPanel kind="service-desk" title="Service Desk update" description="Helpdesk dashboard or request status screenshot." upload={uploads('service-desk')} onChange={updateUploads} />
          <UploadPanel kind="shift" title="IT shift schedule" description="Current weekly IT team schedule screenshot." upload={uploads('shift')} onChange={updateUploads} />
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button type="button" onClick={() => void saveContent()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#17211a] px-5 py-3 text-xs font-semibold text-white shadow-lg hover:bg-[#26362a] disabled:opacity-60">
          <Save size={14} />{saving ? 'Publishing…' : 'Save and publish changes'}
        </button>
      </div>
    </div>
  )
}
