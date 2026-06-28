import { useEffect, useState } from 'react'
import {
  Users, Receipt, DollarSign, Activity, ShieldCheck, RefreshCw,
  UserCheck, Bell, Wallet, MessageSquare, Gift, Share2, Megaphone,
  ShoppingBag, Star, Globe, Clock, MessageCircle, Server, Terminal,
  Key, CreditCard, BarChart2, ExternalLink,
} from 'lucide-react'
import { adminGetUsers, adminGetTransactions, adminHealthCheck } from '../lib/api'
import { useAuthStore } from '../store/authStore'

type AdminTab =
  | 'users' | 'transactions' | 'notifications' | 'wallet-config'
  | 'api-users' | 'support' | 'health' | 'subscriptions' | 'visitors'
  | 'bonuses' | 'referrals' | 'ads' | 'products' | 'testimonials'
  | 'platform-stats' | 'whatsapp-bot' | 'server-monitor' | 'api-console'

const NAV_ICONS: { id: AdminTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'platform-stats', label: 'Stats',          icon: BarChart2,     color: '#f0b90b' },
  { id: 'users',          label: 'Users',          icon: Users,         color: '#60a5fa' },
  { id: 'health',         label: 'Health',         icon: Activity,      color: '#0ecb81' },
  { id: 'server-monitor', label: 'Server',         icon: Server,        color: '#60a5fa' },
  { id: 'api-console',    label: 'API Console',    icon: Terminal,      color: '#a78bfa' },
  { id: 'api-users',      label: 'API Users',      icon: Key,           color: '#fb923c' },
  { id: 'visitors',       label: 'Visitors',       icon: Globe,         color: '#22d3ee' },
  { id: 'transactions',   label: 'Transactions',   icon: Receipt,       color: '#0ecb81' },
  { id: 'subscriptions',  label: 'Subscriptions',  icon: CreditCard,    color: '#a78bfa' },
  { id: 'notifications',  label: 'Notifications',  icon: Bell,          color: '#f0b90b' },
  { id: 'wallet-config',  label: 'Wallet',         icon: Wallet,        color: '#22d3ee' },
  { id: 'support',        label: 'Support',        icon: MessageSquare, color: '#fb923c' },
  { id: 'bonuses',        label: 'Bonuses',        icon: Gift,          color: '#f0b90b' },
  { id: 'referrals',      label: 'Referrals',      icon: Share2,        color: '#0ecb81' },
  { id: 'ads',            label: 'Ads',            icon: Megaphone,     color: '#a78bfa' },
  { id: 'products',       label: 'Products',       icon: ShoppingBag,   color: '#fb923c' },
  { id: 'testimonials',   label: 'Testimonials',   icon: Star,          color: '#f0b90b' },
  { id: 'whatsapp-bot',   label: 'WhatsApp',       icon: MessageCircle, color: '#25D366' },
]

function MonitorCard() {
  const [active, setActive] = useState<'grafana' | 'prometheus'>('grafana')
  const grafanaUrl = localStorage.getItem('finai-grafana-url') || '/graf/'
  const prometheusUrl = localStorage.getItem('finai-prometheus-url') || '/prom/'

  return (
    <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139]">
        <BarChart2 size={13} className="text-[#f46800]" />
        <span className="text-xs font-semibold text-[#eaecef]">Monitoring</span>
        <div className="flex items-center gap-0.5 ml-3 bg-[#0b0e11] rounded-lg p-0.5">
          <button
            onClick={() => setActive('grafana')}
            className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${active === 'grafana' ? 'bg-[#1e2329] text-[#f46800]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}
          >
            Grafana
          </button>
          <button
            onClick={() => setActive('prometheus')}
            className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${active === 'prometheus' ? 'bg-[#1e2329] text-[#e6522c]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}
          >
            Prometheus
          </button>
        </div>
        <a
          href={active === 'grafana' ? grafanaUrl : prometheusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-[10px] text-[#848e9c] hover:text-[#eaecef] transition"
        >
          <ExternalLink size={11} /> Open
        </a>
      </div>
      <div className="h-64">
        <iframe
          key={active}
          src={active === 'grafana' ? grafanaUrl : prometheusUrl}
          className="w-full h-full border-0"
          title={active === 'grafana' ? 'Grafana' : 'Prometheus'}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}

export default function AdminDashboardPage({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const user = useAuthStore(s => s.user)
  const [stats, setStats] = useState({ users: 0, activeUsers: 0, totalTx: 0, pendingTx: 0, revenue: 0, kycPending: 0 })
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminGetUsers(), adminGetTransactions(), adminHealthCheck()])
      .then(([ur, tr, hr]) => {
        const users = ur.data || []
        const txs = tr.data || []
        const h = hr.data || {}
        setStats({
          users: users.length,
          activeUsers: users.filter((u: any) => u.is_active && !u.is_banned).length,
          totalTx: txs.length,
          pendingTx: txs.filter((t: any) => t.status === 'pending').length,
          revenue: txs.filter((t: any) => t.status === 'approved' && t.tx_type === 'deposit').reduce((s: number, t: any) => s + (t.amount_usdt || t.amount || 0), 0),
          kycPending: users.filter((u: any) => u.kyc_status === 'pending').length,
        })
        setRecentUsers(users.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5))
        setHealth(h)
      })
      .finally(() => setLoading(false))
  }, [])

  const statusDot = (status: string) => ({ healthy: '#0ecb81', degraded: '#f0b90b', error: '#f6465d' }[status] || '#848e9c')

  const topCards = [
    { label: 'Total Users',    value: stats.users,      sub: `${stats.activeUsers} active`,    icon: Users,     color: '#f0b90b' },
    { label: 'Transactions',   value: stats.totalTx,    sub: `${stats.pendingTx} pending`,     icon: Receipt,   color: '#0ecb81' },
    { label: 'KYC Pending',    value: stats.kycPending, sub: 'awaiting review',                icon: UserCheck, color: '#f6465d' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw size={20} className="text-[#f0b90b] animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#f6465d]/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={18} className="text-[#f6465d]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">Admin Dashboard</h1>
          <p className="text-xs text-[#848e9c]">Welcome back, {user?.first_name || 'Admin'}</p>
        </div>
      </div>

      {/* Top 3 stat cards in one row */}
      <div className="grid grid-cols-3 gap-3">
        {topCards.map(c => (
          <div key={c.label} className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}15` }}>
                <c.icon size={14} style={{ color: c.color }} />
              </div>
              <span className="text-[10px] text-[#848e9c] uppercase tracking-wide font-medium leading-tight">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-[#eaecef]">{c.value}</p>
            <p className="text-[10px] text-[#848e9c] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue card — full width below */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#a78bfa15' }}>
          <DollarSign size={18} style={{ color: '#a78bfa' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide font-medium">Revenue (USDT)</p>
          <p className="text-2xl font-bold text-[#eaecef]">${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-[#848e9c] mt-0.5">approved deposits</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#a78bfa20', color: '#a78bfa' }}>Total Earned</span>
        </div>
      </div>

      {/* Grafana / Prometheus monitor tabs */}
      <MonitorCard />

      {/* System Health + New Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide">System Health</p>
            <Activity size={13} className="text-[#848e9c]" />
          </div>
          {health && Object.keys(health).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(health).map(([key, val]: any) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-[#848e9c] capitalize">{key.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-1.5">
                    {val?.latency_ms && <span className="text-[10px] text-[#848e9c]">{val.latency_ms}ms</span>}
                    <div className="w-2 h-2 rounded-full" style={{ background: statusDot(val?.status) }} />
                    <span className="text-[10px] capitalize font-medium" style={{ color: statusDot(val?.status) }}>{val?.status || 'unknown'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <div className="w-2 h-2 rounded-full bg-[#848e9c]" />
              <p className="text-xs text-[#848e9c]">Health data unavailable</p>
            </div>
          )}
        </div>

        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
          <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide mb-3">New Users</p>
          <div className="space-y-2">
            {recentUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#f0b90b]/10 flex items-center justify-center shrink-0">
                  <Users size={12} className="text-[#f0b90b]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#eaecef] truncate">{u.first_name} {u.last_name}</p>
                  <p className="text-[10px] text-[#848e9c] truncate">{u.email}</p>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-xs text-[#848e9c]">No users yet</p>}
          </div>
        </div>
      </div>

      {/* Nav Icon Grid */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
        <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide mb-3">Admin Panels</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {NAV_ICONS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => onNavigate?.(id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#2b3139] hover:border-[#3c4451] hover:bg-[#1e2329]/60 transition-all"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${color}15` }}
              >
                <Icon size={15} style={{ color }} />
              </div>
              <span className="text-[9px] font-medium text-center leading-tight text-[#848e9c]">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
