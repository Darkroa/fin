import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useRef } from 'react'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import TermsPage from './pages/TermsPage'
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
import NewsPage from './pages/NewsPage'
import ChatFinPage from './pages/ChatFinPage'
import StorePage from './pages/StorePage'
import AdsPage from './pages/AdsPage'
import MorePage from './pages/MorePage'
import OpenPositionsPage from './pages/OpenPositionsPage'

import { useAuthStore } from './store/authStore'
import DashboardLayout from './layouts/DashboardLayout'
import { trackVisitor } from './lib/api'
import { LanguageProvider } from './contexts/LanguageContext'

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
    <LanguageProvider>
    <BrowserRouter>
      <VisitorBeacon />
      <Toaster
        position="top-center"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: '380px',
          },
          success: {
            style: { background: '#166534', color: '#fff', border: '1px solid #15803d' },
            iconTheme: { primary: '#fff', secondary: '#166534' },
          },
          error: {
            style: { background: '#7f1d1d', color: '#fff', border: '1px solid #b91c1c' },
            iconTheme: { primary: '#fff', secondary: '#7f1d1d' },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />

        <Route path="/terms" element={<TermsPage />} />
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
          <Route path="dashboard"       element={<DashboardPage />} />
          <Route path="markets"         element={<MarketsPage />} />
          <Route path="news"            element={<NewsPage />} />
          <Route path="chat"            element={<ChatFinPage />} />
          <Route path="trade"           element={<TradePage />} />
          <Route path="wallet"          element={<WalletPage />} />
          <Route path="transactions"    element={<TransactionHistoryPage />} />
          <Route path="bots"            element={<BotsPage />} />
          <Route path="settings"        element={<SettingsPage />} />
          <Route path="profile"         element={<ProfilePage />} />
          <Route path="calendar"        element={<CalendarPage />} />
          <Route path="support"         element={<SupportPage />} />
          <Route path="admin"           element={<AdminPage />} />
          <Route path="alerts"          element={<AlertsPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="subscribe"       element={<SubscribePayPage />} />
          <Route path="pricing"         element={<PricingPage />} />
          <Route path="notifications"   element={<NotificationsPage />} />
          <Route path="store"           element={<StorePage />} />
          <Route path="ads"             element={<AdsPage />} />
          <Route path="more"            element={<MorePage />} />
          <Route path="positions"       element={<OpenPositionsPage />} />
        </Route>
        <Route path="/subscribe" element={<Navigate to="/app/subscribe" replace />} />
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  )
}
