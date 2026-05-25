import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useRef } from 'react'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MarketsPage from './pages/MarketsPage'
import WalletPage from './pages/WalletPage'
import TradePage from './pages/TradePage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import BotsPage from './pages/BotsPage'
import ProfilePage from './pages/ProfilePage'
import SupportPage from './pages/SupportPage'
import TransactionHistoryPage from './pages/TransactionHistoryPage'
import CalendarPage from './pages/CalendarPage'
import AlertsPage from './pages/AlertsPage'
import RecommendationsPage from './pages/RecommendationsPage'
import SubscribePayPage from './pages/SubscribePayPage'
import PricingPage from './pages/PricingPage'
import NotificationsPage from './pages/NotificationsPage'
import { useAuthStore } from './store/authStore'
import DashboardLayout from './layouts/DashboardLayout'
import { trackVisitor } from './lib/api'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function VisitorBeacon() {
  const location = useLocation()
  const sessionIdRef = useRef<string>(
    sessionStorage.getItem('_vid') || (() => {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
      sessionStorage.setItem('_vid', id)
      return id
    })()
  )

  useEffect(() => {
    const sid = sessionIdRef.current
    trackVisitor(sid, location.pathname)
    const timer = setInterval(() => trackVisitor(sid, location.pathname), 30_000)
    return () => clearInterval(timer)
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <VisitorBeacon />
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
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="markets"      element={<MarketsPage />} />
          <Route path="trade"        element={<TradePage />} />
          <Route path="wallet"       element={<WalletPage />} />
          <Route path="transactions" element={<TransactionHistoryPage />} />
          <Route path="bots"         element={<BotsPage />} />
          <Route path="settings"     element={<SettingsPage />} />
          <Route path="profile"      element={<ProfilePage />} />
          <Route path="calendar"     element={<CalendarPage />} />
          <Route path="support"      element={<SupportPage />} />
          <Route path="admin"        element={<AdminPage />} />
          <Route path="alerts"          element={<AlertsPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="subscribe"       element={<SubscribePayPage />} />
          <Route path="pricing"         element={<PricingPage />} />
          <Route path="notifications"   element={<NotificationsPage />} />
        </Route>
        <Route path="/subscribe" element={<Navigate to="/app/subscribe" replace />} />
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
