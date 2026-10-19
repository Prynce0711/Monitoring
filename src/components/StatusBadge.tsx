import type { CircuitStatus, CheckInStatus } from '../types/monitoring'

type Status = CircuitStatus | CheckInStatus

const styles: Record<Status, string> = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  Confirmed: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  'Checked in': 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  'At risk': 'bg-rose-50 text-rose-700 ring-rose-600/15',
  Online: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  Degraded: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  Offline: 'bg-rose-50 text-rose-700 ring-rose-600/15',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}
