import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../auth/LoginPage'
import { useAuth } from '../auth/context'
import { AppShell } from '../components/AppShell'
import { CheckInEditorPage } from '../features/checkins/CheckInEditorPage'
import { CheckInsPage } from '../features/checkins/CheckInsPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InternetEditorPage } from '../features/internet/InternetEditorPage'
import { InternetPage } from '../features/internet/InternetPage'
import { PresentationPage } from '../features/presentation/PresentationPage'
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
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="check-ins" element={<CheckInsPage />} />
          <Route path="check-ins/new" element={<CheckInEditorPage />} />
          <Route path="check-ins/:id/edit" element={<CheckInEditorPage />} />
          <Route path="internet" element={<InternetPage />} />
          <Route path="internet/new" element={<InternetEditorPage />} />
          <Route path="internet/:id/edit" element={<InternetEditorPage />} />
          <Route path="presentation" element={<PresentationPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="users" element={user.role === 'admin' ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
