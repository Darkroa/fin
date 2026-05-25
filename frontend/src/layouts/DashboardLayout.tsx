import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, TrendingUp, BarChart2, Wallet,
  Settings, ShieldCheck, LogOut, Zap, Bell, Bot,
  X, ChevronDown, User, Receipt, MessageSquare, Menu, CalendarDays,
  Sun, Moon, Lightbulb, Crown, BellRing
} from 'lucide-react'
import { cn } from '../lib/utils'
import { getUserNotifications, markAllNotificationsRead } from '../lib/api'
import { useLivePrices } from '../hooks/useLivePrices'
import FloatingAI from '../components/FloatingAI'

const navItems = [
  { to: '/app/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/markets',      icon: BarChart2,       label: 'Markets' },
  { to: '/app/bots',         icon: Bot,             label: 'AI Bots' },
  { to: '/app/trade',        icon: TrendingUp,      label: 'Trade' },
  { to: '/app/recommendations', icon: Lightbulb,    label: 'Signals' },
  { to: '/app/wallet',       icon: Wallet,          label: 'Wallet' },
  { to: '/app/transactions', icon: Receipt,         label: 'History' },
  { to: '/app/alerts',       icon: Bell,            label: 'Alerts' },
  { to: '/app/notifications',icon: BellRing,        label: 'Notifications' },
  { to: '/app/calendar',     icon: CalendarDays,    label: 'Calendar' },
  { to: '/app/settings',     icon: Settings,        label: 'Settings' },
  { to: '/app/profile',      icon: User,            label: 'Profile' },
  { to: '/app/support',      icon: MessageSquare,   label: 'Support' },
  { to: '/app/pricing',      icon: Crown,           label: 'Pricing' },
]

interface AppNotification {
  id: number; title: string; message: string; is_read: boolean; created_at: string
}

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('finai-theme') === 'light')
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lightMode) {
      document.documentElement.classList.add('light')
      localStorage.setItem('finai-theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('finai-theme', 'dark')
    }
  }, [lightMode])

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

  const handleLogout = () => { logout(); navigate('/login') }

  const unread = notifications.filter(n => !n.is_read).length

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[#2b3139] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#f0b90b] flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-black" />
          </div>
          <span className="text-[#f0b90b] font-bold text-lg tracking-tight whitespace-nowrap">FinAi</span>
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-[#848e9c] hover:text-[#eaecef]">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            onClick={() => isMobile && setMobileOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              isActive ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]/60'
            )}>
            <Icon size={15} className="flex-shrink-0" />{label}
          </NavLink>
        ))}
        {user?.is_admin && (
          <NavLink to="/app/admin"
            onClick={() => isMobile && setMobileOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              isActive ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]/60'
            )}>
            <ShieldCheck size={15} className="flex-shrink-0" />Admin Panel
          </NavLink>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-[#2b3139] flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-[#0b0e11] mb-1">
          <div className="w-8 h-8 rounded-full bg-[#f0b90b] flex items-center justify-center text-black font-bold text-sm flex-shrink-0 overflow-hidden">
            {user?.profile_photo ? <img src={user.profile_photo} className="w-full h-full object-cover" /> : user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#eaecef] text-xs font-medium truncate">{user?.full_name || user?.email}</p>
            <p className="text-[#848e9c] text-[10px]">{user?.is_admin ? 'Admin' : `Tier ${user?.account_tier ?? 0}`}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition-all">
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-[#0b0e11] overflow-hidden">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-50 bg-[#161a1e] border-r border-[#2b3139] flex flex-col transition-transform duration-200 w-56 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent isMobile />
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-shrink-0 bg-[#161a1e] border-r border-[#2b3139] flex-col transition-all duration-200 overflow-hidden',
        sidebarOpen ? 'w-56' : 'w-0 border-0'
      )}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-[#2b3139] bg-[#161a1e] flex items-center justify-between px-3 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden w-8 h-8 rounded-lg bg-[#0b0e11] hover:bg-[#2b3139] flex items-center justify-center transition flex-shrink-0">
              <Menu size={15} className="text-[#848e9c]" />
            </button>
            {/* Desktop sidebar toggle */}
            <button onClick={() => setSidebarOpen(v => !v)}
              className="hidden lg:flex w-8 h-8 rounded-lg bg-[#0b0e11] hover:bg-[#2b3139] items-center justify-center transition flex-shrink-0">
              {sidebarOpen ? <X size={14} className="text-[#848e9c]" /> : <Zap size={14} className="text-[#f0b90b]" />}
            </button>
            <LiveTickerBar />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Balance chip */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-1.5">
              <Wallet size={11} className="text-[#f0b90b]" />
              <span className="text-xs font-mono text-[#eaecef]">${(user?.balance_usdt ?? 0).toFixed(2)}</span>
            </div>

            {/* Brightness toggle */}
            <button
              onClick={() => setLightMode(v => !v)}
              title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
              className="w-8 h-8 rounded-full bg-[#0b0e11] hover:bg-[#2b3139] flex items-center justify-center transition">
              {lightMode
                ? <Moon size={14} className="text-[#848e9c]" />
                : <Sun  size={14} className="text-[#848e9c]" />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }}
                className="relative w-8 h-8 rounded-full bg-[#0b0e11] hover:bg-[#2b3139] flex items-center justify-center transition">
                <Bell size={15} className="text-[#848e9c]" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#f6465d] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-72 sm:w-80 bg-[#161a1e] border border-[#2b3139] rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
                    <span className="text-sm font-semibold text-[#eaecef]">Notifications</span>
                    {unread > 0 && <button onClick={handleMarkAllRead} className="text-xs text-[#f0b90b] hover:underline">Mark all read</button>}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center"><Bell size={20} className="text-[#2b3139] mx-auto mb-2" /><p className="text-xs text-[#848e9c]">No notifications</p></div>
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
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/app/notifications') }}
                    className="w-full px-4 py-2.5 text-xs text-[#f0b90b] hover:bg-[#1e2329] transition border-t border-[#2b3139] font-medium">
                    View all notifications →
                  </button>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }}
                className="flex items-center gap-1.5 bg-[#0b0e11] hover:bg-[#2b3139] rounded-full pl-1 pr-2.5 py-1 transition">
                <div className="w-6 h-6 rounded-full bg-[#f0b90b] flex items-center justify-center text-black font-bold text-xs overflow-hidden">
                  {user?.profile_photo ? <img src={user.profile_photo} className="w-full h-full object-cover" /> : user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <ChevronDown size={11} className="text-[#848e9c]" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-11 w-52 bg-[#161a1e] border border-[#2b3139] rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2b3139]">
                    <p className="text-xs font-medium text-[#eaecef] truncate">{user?.full_name || user?.email}</p>
                    <p className="text-[10px] text-[#848e9c]">Tier {user?.account_tier ?? 0} · ${(user?.balance_usdt ?? 0).toFixed(2)} USDT</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button onClick={() => { navigate('/app/profile'); setProfileOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-xl transition">My Profile</button>
                    <button onClick={() => { navigate('/app/settings'); setProfileOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-xl transition">Settings</button>
                    <button onClick={() => { navigate('/app/wallet'); setProfileOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-xl transition">Wallet</button>
                    <button onClick={() => { navigate('/app/support'); setProfileOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-xl transition">Support</button>
                    {user?.is_admin && <button onClick={() => { navigate('/app/admin'); setProfileOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] rounded-xl transition">Admin Panel</button>}
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-[#f6465d] hover:bg-[#f6465d]/10 rounded-xl transition">Sign Out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-5 lg:px-6 py-4 sm:py-5 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating AI button */}
      <FloatingAI />
    </div>
  )
}

function LiveTickerBar() {
  const { btcPrice, btcChange, ethPrice, ethChange, loading } = useLivePrices(60000)
  const STATIC = [
    { symbol: 'AAPL', price: 192.35, change: 0.9 },
    { symbol: 'NVDA', price: 875, change: 3.1 },
  ]
  const tickers = [
    { symbol: 'BTC', price: btcPrice ?? 67432, change: btcChange ?? 2.4, live: !loading && btcPrice !== null },
    { symbol: 'ETH', price: ethPrice ?? 3521, change: ethChange ?? 1.8, live: !loading && ethPrice !== null },
    ...STATIC.map(t => ({ ...t, live: false })),
  ]
  return (
    <div className="flex items-center gap-4 overflow-hidden">
      {tickers.map(t => (
        <div key={t.symbol} className="flex items-center gap-1 text-xs whitespace-nowrap hidden sm:flex">
          <span className="text-[#848e9c]">{t.symbol}</span>
          <span className="text-[#eaecef] font-mono">${t.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          <span className={t.change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
            {t.change >= 0 ? '▲' : '▼'}{Math.abs(t.change).toFixed(1)}%
          </span>
          {t.live && <span className="w-1 h-1 rounded-full bg-[#0ecb81] animate-pulse" />}
        </div>
      ))}
    </div>
  )
}