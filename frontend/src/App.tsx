import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MarketsPage from './pages/MarketsPage'
import WalletPage from './pages/WalletPage'
import TradePage from './pages/TradePage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import BotsPage from './pages/BotsPage'
import { useAuthStore } from './store/authStore'
import DashboardLayout from './layouts/DashboardLayout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e2329', color: '#eaecef', border: '1px solid #2b3139' },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="trade" element={<TradePage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="bots" element={<BotsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
