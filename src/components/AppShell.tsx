import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { Sidebar } from './Sidebar'

const pageNames: Record<string, string> = {
  '/': 'Overview',
  '/check-ins': 'Venue check-ins',
  '/internet': 'Dedicated internet',
  '/presentation': 'Presentation view',
  '/account': 'Your account',
  '/users': 'User accounts',
}

export function AppShell() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const pageName = pageNames[location.pathname] ?? (location.pathname.includes('check-ins') ? 'Venue check-ins' : 'Dedicated internet')

  return (
    <div className="flex min-h-screen bg-[#f5f6f3]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white px-8 max-md:px-4">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">{pageName}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 max-sm:hidden">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9dbc4d]" /> Live sync
            </span>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <Link to="/account" className="flex items-center gap-2 rounded-md text-left hover:opacity-80">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6ebdd] text-xs font-bold uppercase text-[#536437]">{user?.username.slice(0, 2)}</span>
                <span className="max-sm:hidden">
                  <span className="block text-xs font-semibold text-slate-800">{user?.username}</span>
                  <span className="block text-[10px] capitalize text-slate-400">{user?.role}</span>
                </span>
              </Link>
              <button
                type="button"
                title="Sign out"
                aria-label="Sign out"
                onClick={() => {
                  setLogoutError(null)
                  void logout().catch((cause: unknown) => setLogoutError(cause instanceof Error ? cause.message : 'Unable to sign out.'))
                }}
                className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
              ><LogOut size={15} /></button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-8 py-8 max-md:px-4 max-md:py-5">
          {logoutError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{logoutError}</p>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
