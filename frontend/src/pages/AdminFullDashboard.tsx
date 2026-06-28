import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import AdminPage from './AdminPage'
import AdminDashboardPage from './AdminDashboardPage'
import {
  ShieldCheck, LogOut, User, BarChart2, Activity,
  ChevronLeft, ChevronRight, Zap, Monitor,
  LayoutDashboard, Receipt, Bell, Wallet, MessageSquare,
  Gift, Share2, Megaphone, ShoppingBag, Star, Globe,
  Clock, MessageCircle, Server, Terminal, Key, Users,
  CreditCard, ExternalLink,
} from 'lucide-react'
import { cn } from '../lib/utils'

type AdminTab =
  | 'users' | 'transactions' | 'notifications' | 'wallet-config'
  | 'api-users' | 'support' | 'health' | 'subscriptions' | 'visitors'
  | 'bonuses' | 'referrals' | 'ads' | 'products' | 'testimonials'
  | 'activity' | 'platform-stats' | 'whatsapp-bot' | 'server-monitor' | 'api-console'

type View = 'overview' | 'grafana' | 'prometheus' | AdminTab

interface NavItem {
  id: View
  label: string
  icon: React.ElementType
  color: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { id: 'overview',       label: 'Overview',       icon: LayoutDashboard, color: '#f0b90b' },
    ],
  },
  {
    title: 'Management',
    items: [
      { id: 'users',          label: 'Users',          icon: Users,          color: '#60a5fa' },
      { id: 'transactions',   label: 'Transactions',   icon: Receipt,        color: '#0ecb81' },
      { id: 'subscriptions',  label: 'Subscriptions',  icon: CreditCard,     color: '#a78bfa' },
      { id: 'notifications',  label: 'Notifications',  icon: Bell,           color: '#f0b90b' },
      { id: 'wallet-config',  label: 'Wallet Config',  icon: Wallet,         color: '#22d3ee' },
      { id: 'support',        label: 'Support',        icon: MessageSquare,  color: '#fb923c' },
      { id: 'bonuses',        label: 'Bonuses',        icon: Gift,           color: '#f0b90b' },
      { id: 'referrals',      label: 'Referrals',      icon: Share2,         color: '#0ecb81' },
      { id: 'ads',            label: 'Ads',            icon: Megaphone,      color: '#a78bfa' },
      { id: 'products',       label: 'Products',       icon: ShoppingBag,    color: '#fb923c' },
      { id: 'testimonials',   label: 'Testimonials',   icon: Star,           color: '#f0b90b' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { id: 'visitors',       label: 'Visitors',       icon: Globe,          color: '#22d3ee' },
      { id: 'health',         label: 'Health',         icon: Activity,       color: '#0ecb81' },
      { id: 'activity',       label: 'Activity Log',   icon: Clock,          color: '#848e9c' },
      { id: 'platform-stats', label: 'Platform Stats', icon: BarChart2,      color: '#f0b90b' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'whatsapp-bot',   label: 'WhatsApp Bot',   icon: MessageCircle,  color: '#25D366' },
      { id: 'server-monitor', label: 'Server Monitor', icon: Server,         color: '#60a5fa' },
      { id: 'api-console',    label: 'API Console',    icon: Terminal,       color: '#a78bfa' },
      { id: 'api-users',      label: 'API Users',      icon: Key,            color: '#fb923c' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { id: 'grafana',        label: 'Grafana',        icon: BarChart2,      color: '#f46800' },
      { id: 'prometheus',     label: 'Prometheus',     icon: Activity,       color: '#e6522c' },
    ],
  },
]

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

function MonitorFrame({ title, storageKey, defaultUrl, accentColor }: {
  title: string
  storageKey: string
  defaultUrl: string
  accentColor: string
}) {
  const [url, setUrl] = useState(() => localStorage.getItem(storageKey) || defaultUrl)
  const [inputUrl, setInputUrl] = useState(url)
  const [editing, setEditing] = useState(false)
  const [frameKey, setFrameKey] = useState(0)

  const applyUrl = () => {
    const trimmed = inputUrl.trim()
    setUrl(trimmed)
    localStorage.setItem(storageKey, trimmed)
    setEditing(false)
    setFrameKey(k => k + 1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#161a1e] border-b border-[#2b3139] flex-shrink-0 flex-wrap gap-y-2">
        <Monitor size={14} style={{ color: accentColor }} />
        <span className="text-sm font-semibold text-[#eaecef]">{title}</span>
        {!editing ? (
          <>
            <span className="text-xs text-[#848e9c] truncate max-w-xs hidden sm:block">{url}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => { setInputUrl(url); setEditing(true) }}
                className="text-xs text-[#848e9c] hover:text-[#eaecef] transition px-2 py-1 rounded border border-[#2b3139] hover:border-[#3c4451]"
              >
                Change URL
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 text-[#848e9c] hover:text-[#eaecef] transition px-2 py-1 rounded border border-[#2b3139] hover:border-[#3c4451]">
                <ExternalLink size={11} /> Open
              </a>
            </div>
          </>
        ) : (
          <form onSubmit={e => { e.preventDefault(); applyUrl() }} className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              autoFocus
              placeholder="http://..."
              className="flex-1 min-w-0 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-1.5 text-xs text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition"
            />
            <button type="submit"
              className="flex-shrink-0 text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-3 py-1.5 rounded-lg transition">
              Apply
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="flex-shrink-0 text-xs text-[#848e9c] hover:text-[#eaecef] transition px-2 py-1.5">
              Cancel
            </button>
          </form>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          key={frameKey}
          src={url}
          className="w-full h-full border-0"
          title={title}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}

export default function AdminFullDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('overview')
  const [collapsed, setCollapsed] = useState(false)

  if (!user?.is_admin) {
    navigate('/admin-login', { replace: true })
    return null
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const activeItem = ALL_ITEMS.find(i => i.id === view)
  const isMonitor = view === 'grafana' || view === 'prometheus'
  const isAdminTab = !['overview', 'grafana', 'prometheus'].includes(view)

  return (
    <div className="flex h-screen bg-[#0b0e11] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={cn(
        'flex-shrink-0 flex flex-col bg-[#161a1e] border-r border-[#2b3139] transition-all duration-200 overflow-hidden',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center border-b border-[#2b3139] h-14 px-3 gap-2.5 flex-shrink-0',
          collapsed && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-xl bg-[#f6465d] flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#eaecef] leading-tight">FinAi</p>
              <p className="text-[10px] text-[#f6465d] font-semibold leading-tight">Admin Panel</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="text-[#848e9c] hover:text-[#eaecef] transition flex-shrink-0"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-[#2b3139] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#f6465d]/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={12} className="text-[#f6465d]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#eaecef] truncate">
                  {user?.first_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-[#f6465d] font-medium">Administrator</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {section.title && !collapsed && (
                <p className="text-[9px] font-bold text-[#4a5568] uppercase tracking-widest px-2 mb-1">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ id, label, icon: Icon, color }) => {
                  const active = view === id
                  return (
                    <button
                      key={id}
                      onClick={() => setView(id)}
                      title={collapsed ? label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                        collapsed ? 'justify-center' : '',
                        active
                          ? 'bg-[#1e2329]'
                          : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#1e2329]/60'
                      )}
                    >
                      <Icon
                        size={14}
                        style={{ color: active ? color : undefined }}
                        className={active ? '' : 'text-[#848e9c]'}
                      />
                      {!collapsed && (
                        <span style={{ color: active ? color : undefined }} className="truncate">
                          {label}
                        </span>
                      )}
                      {!collapsed && active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-1.5 border-t border-[#2b3139] flex-shrink-0 space-y-0.5">
          <button
            onClick={() => navigate('/app/dashboard')}
            title={collapsed ? 'User View' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#0ecb81] hover:bg-[#0ecb81]/10 transition-all',
              collapsed && 'justify-center'
            )}
          >
            <User size={14} />
            {!collapsed && <span>Switch to User View</span>}
          </button>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition-all',
              collapsed && 'justify-center'
            )}
          >
            <LogOut size={14} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top header bar — always fixed, outside scroll */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#161a1e] border-b border-[#2b3139] gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {activeItem && (
              <>
                <activeItem.icon size={16} style={{ color: activeItem.color }} />
                <span className="text-sm font-semibold text-[#eaecef] truncate">{activeItem.label}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/app/dashboard')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0ecb81] bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 px-3 py-1.5 rounded-lg transition"
            >
              <User size={12} />
              <span className="hidden sm:inline">User View</span>
            </button>
          </div>
        </header>

        {/* Page body */}
        <div className="flex-1 overflow-hidden">
          {isMonitor ? (
            <div className="h-full">
              {view === 'grafana' && (
                <MonitorFrame
                  title="Grafana"
                  storageKey="finai-grafana-url"
                  defaultUrl="/graf/"
                  accentColor="#f46800"
                />
              )}
              {view === 'prometheus' && (
                <MonitorFrame
                  title="Prometheus"
                  storageKey="finai-prometheus-url"
                  defaultUrl="/prom/"
                  accentColor="#e6522c"
                />
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-5 lg:px-6 py-5">
                {view === 'overview' && <AdminDashboardPage onNavigate={(tab) => setView(tab as View)} />}
                {isAdminTab && (
                  <AdminPage key={view} initialTab={view as AdminTab} embedded />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
