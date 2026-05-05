import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, TrendingUp, BarChart2, Wallet,
  Settings, ShieldCheck, LogOut, Zap, Bell, Bot, X, ChevronRight
} from 'lucide-react'
import { cn } from '../lib/utils'
import { getUserNotifications, markAllNotificationsRead } from '../lib/api'

const navItems = [
  { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/markets', icon: BarChart2, label: 'Markets' },
  { to: '/app/trade', icon: TrendingUp, label: 'Trade' },
  { to: '/app/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/app/bots', icon: Bot, label: 'AI Bots' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
]

interface AppNotification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchNotifications = () => {
    getUserNotifications().then(r => setNotifications(r.data)).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {})
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div className="flex h-screen bg-[#0b0e11] overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'flex-shrink-0 bg-[#161a1e] border-r border-[#2b3139] flex flex-col transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-0 overflow-hidden border-0'
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f0b90b] flex items-center justify-center flex-shrink-0">
              <Zap size={16} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-lg tracking-tight whitespace-nowrap">FinAi</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-[#f0b90b]/10 text-[#f0b90b]'
                  : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'
              )}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {user?.is_admin && (
            <NavLink
              to="/app/admin"
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-[#f6465d]/10 text-[#f6465d]'
                  : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'
              )}
            >
              <ShieldCheck size={16} className="flex-shrink-0" />
              Admin Panel
            </NavLink>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#2b3139]">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-[#f0b90b] flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#eaecef] text-xs font-medium truncate">{user?.email ?? 'User'}</p>
              <p className="text-[#848e9c] text-xs">{user?.is_admin ? 'Admin' : 'Member'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition-all"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-[#2b3139] bg-[#161a1e] flex items-center justify-between px-4 gap-4 flex-shrink-0">
          {/* Left: sidebar toggle + ticker */}
          <div className="flex items-center gap-4 overflow-hidden">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="w-8 h-8 rounded-lg bg-[#2b3139] hover:bg-[#3c4451] flex items-center justify-center transition flex-shrink-0"
              title="Toggle sidebar"
            >
              {sidebarOpen
                ? <X size={14} className="text-[#848e9c]" />
                : <Zap size={14} className="text-[#f0b90b]" />}
            </button>
            <TickerBar />
          </div>

          {/* Right: notifications + profile */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }}
                className="relative w-8 h-8 rounded-full bg-[#2b3139] hover:bg-[#3c4451] flex items-center justify-center transition"
              >
                <Bell size={15} className="text-[#848e9c]" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#f6465d] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-[#161a1e] border border-[#2b3139] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
                    <span className="text-sm font-semibold text-[#eaecef]">Notifications</span>
                    {unread > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-[#f0b90b] hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#848e9c]">No notifications yet</div>
                    ) : notifications.slice(0, 20).map(n => (
                      <div key={n.id} className={cn('px-4 py-3 border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition', !n.is_read && 'bg-[#f0b90b]/5')}>
                        <div className="flex items-start gap-2">
                          {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#f0b90b] mt-1.5 flex-shrink-0" />}
                          <div className={cn('flex-1', n.is_read && 'pl-3.5')}>
                            <p className="text-xs font-medium text-[#eaecef]">{n.title}</p>
                            <p className="text-xs text-[#848e9c] mt-0.5 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] text-[#4a5568] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }}
                className="flex items-center gap-2 bg-[#2b3139] hover:bg-[#3c4451] rounded-full pl-1 pr-2 py-1 transition"
              >
                <div className="w-6 h-6 rounded-full bg-[#f0b90b] flex items-center justify-center text-black font-bold text-xs">
                  {user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <ChevronRight size={12} className="text-[#848e9c]" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-10 w-52 bg-[#161a1e] border border-[#2b3139] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2b3139]">
                    <p className="text-xs font-medium text-[#eaecef] truncate">{user?.email}</p>
                    <p className="text-[10px] text-[#848e9c]">{user?.is_admin ? 'Admin' : 'Member'}</p>
                  </div>
                  <div className="p-1">
                    <button onClick={() => { navigate('/app/settings'); setProfileOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-lg transition">
                      Account Settings
                    </button>
                    {user?.is_admin && (
                      <button onClick={() => { navigate('/app/admin'); setProfileOpen(false) }}
                        className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-lg transition">
                        Admin Panel
                      </button>
                    )}
                    <button onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-xs text-[#f6465d] hover:bg-[#f6465d]/10 rounded-lg transition">
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const TICKERS = [
  { symbol: 'BTC/USDT', price: 67432, change: 2.4 },
  { symbol: 'ETH/USDT', price: 3521, change: 1.8 },
  { symbol: 'AAPL', price: 192.35, change: 0.9 },
  { symbol: 'TSLA', price: 248.7, change: -1.2 },
  { symbol: 'SPY', price: 530.4, change: 0.5 },
  { symbol: 'NVDA', price: 875, change: 3.1 },
]

function TickerBar() {
  return (
    <div className="flex items-center gap-5 overflow-hidden">
      {TICKERS.map((t) => (
        <div key={t.symbol} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className="text-[#848e9c]">{t.symbol}</span>
          <span className="text-[#eaecef] font-mono">${t.price.toLocaleString()}</span>
          <span className={t.change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
            {t.change >= 0 ? '▲' : '▼'}{Math.abs(t.change)}%
          </span>
        </div>
      ))}
    </div>
  )
}
