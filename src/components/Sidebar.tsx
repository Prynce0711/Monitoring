import {
  Activity,
  CalendarDays,
  Gauge,
  Globe2,
  KeyRound,
  Presentation,
  Radio,
  Settings2,
  UsersRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/context'

const primaryLinks = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/check-ins', label: 'Venue check-ins', icon: CalendarDays },
  { to: '/internet', label: 'Dedicated internet', icon: Globe2 },
  { to: '/presentation', label: 'Presentation view', icon: Presentation },
]

export function Sidebar() {
  const { user } = useAuth()
  return (
    <aside className="sidebar flex h-screen w-[248px] shrink-0 flex-col bg-[#111820] px-4 py-6 text-slate-300 max-lg:w-[76px] max-lg:items-center max-lg:px-2">
      <a className="mb-9 flex w-full items-center gap-3 px-2 max-lg:justify-center max-lg:px-0" href="/">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d2f36a] text-[#1c2912]">
          <Activity size={21} strokeWidth={2.4} />
        </span>
        <span className="max-lg:hidden">
          <span className="block text-[15px] font-bold tracking-tight text-white">monitorly</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-500">Operations</span>
        </span>
      </a>

      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 max-lg:hidden">Workspace</div>
      <nav className="flex w-full flex-col gap-1" aria-label="Main navigation">
        {primaryLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors max-lg:justify-center max-lg:px-0 ${isActive ? 'bg-[#26323c] text-[#d2f36a]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
            }
          >
            <Icon size={17} />
            <span className="max-lg:hidden">{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/account"
          title="Your account"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors max-lg:justify-center max-lg:px-0 ${isActive ? 'bg-[#26323c] text-[#d2f36a]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
          }
        >
          <KeyRound size={17} />
          <span className="max-lg:hidden">Your account</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink
            to="/users"
            title="User accounts"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors max-lg:justify-center max-lg:px-0 ${isActive ? 'bg-[#26323c] text-[#d2f36a]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
            }
          >
            <UsersRound size={17} />
            <span className="max-lg:hidden">User accounts</span>
          </NavLink>
        )}
      </nav>

      <div className="mt-8 mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 max-lg:hidden">System</div>
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-400 max-lg:justify-center max-lg:px-0" title="Live monitoring status">
          <Radio size={17} />
          <span className="max-lg:hidden">Live status</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d2f36a] max-lg:hidden" />
        </div>
      </div>

      <div className="mt-auto rounded-xl border border-white/8 bg-white/[0.035] p-3.5 max-lg:hidden">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
          <Settings2 size={14} className="text-[#d2f36a]" />
          Live sync enabled
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Updates sync automatically across your workspace.</p>
      </div>
    </aside>
  )
}
