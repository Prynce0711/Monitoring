import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../auth/LoginPage'
import { useAuth } from '../auth/context'
import { AppShell } from '../components/AppShell'

import { DashboardPage } from '../features/dashboard/DashboardPage'
import { PresentationPage } from '../features/presentation/PresentationPage'
import { AdminPresentationPage } from '../features/presentation/AdminPresentationPage'
import { AccountPage } from '../features/users/AccountPage'
import { UsersPage } from '../features/users/UsersPage'

export default function App() {
  const { user, loading, error, reload } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking sign-in…</div>
  }
  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f5f6f3] px-4 text-center">
        <p role="alert" className="text-sm text-rose-700">{error}</p>
        <button type="button" onClick={() => void reload()} className="rounded-lg bg-[#17211a] px-4 py-2 text-xs font-semibold text-white">Try again</button>
      </main>
    )
  }
  if (!user) return <LoginPage />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="presentation" element={<PresentationPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="admin/presentation" element={user.role === 'admin' ? <AdminPresentationPage /> : <Navigate to="/" replace />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="users" element={user.role === 'admin' ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
