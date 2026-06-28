import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Receipt, DollarSign, Activity, ShieldCheck, ArrowRight,
  TrendingUp, UserCheck, Clock, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react'
import { adminGetUsers, adminGetTransactions, adminHealthCheck } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function AdminDashboardPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [stats, setStats] = useState({ users: 0, activeUsers: 0, totalTx: 0, pendingTx: 0, revenue: 0, kycPending: 0 })
  const [recentTx, setRecentTx] = useState<any[]>([])
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.is_admin) { navigate('/app/dashboard'); return }
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
        setRecentTx(txs.slice(0, 6))
        setRecentUsers(users.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5))
        setHealth(h)
      })
      .finally(() => setLoading(false))
  }, [])

  const statusDot = (status: string) => {
    const map: Record<string, string> = { healthy: '#0ecb81', degraded: '#f0b90b', error: '#f6465d' }
    return map[status] || '#848e9c'
  }

  const txStatusColor = (s: string) => ({ approved: 'text-[#0ecb81]', rejected: 'text-[#f6465d]', pending: 'text-[#f0b90b]' }[s] || 'text-[#848e9c]')

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw size={20} className="text-[#f0b90b] animate-spin" />
    </div>
  )

  const statCards = [
    { label: 'Total Users', value: stats.users, sub: `${stats.activeUsers} active`, icon: Users, color: '#f0b90b' },
    { label: 'Transactions', value: stats.totalTx, sub: `${stats.pendingTx} pending`, icon: Receipt, color: '#0ecb81' },
    { label: 'Revenue (USDT)', value: `$${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, sub: 'approved deposits', icon: DollarSign, color: '#a78bfa' },
    { label: 'KYC Pending', value: stats.kycPending, sub: 'awaiting review', icon: UserCheck, color: '#f6465d' },
  ]

  const quickActions = [
    { label: 'Manage Users', desc: 'Edit, ban, verify accounts', tab: 'users', color: '#f0b90b' },
    { label: 'Transactions', desc: 'Approve / reject deposits', tab: 'transactions', color: '#0ecb81' },
    { label: 'Subscriptions', desc: 'Review subscription requests', tab: 'subscriptions', color: '#a78bfa' },
    { label: 'Notifications', desc: 'Push alerts to users', tab: 'notifications', color: '#f6465d' },
    { label: 'Server Monitor', desc: 'CPU, memory, DB health', tab: 'server-monitor', color: '#22d3ee' },
    { label: 'API Console', desc: 'Test endpoints live', tab: 'api-console', color: '#fb923c' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#f6465d]/10 flex items-center justify-center">
          <ShieldCheck size={18} className="text-[#f6465d]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">Admin Dashboard</h1>
          <p className="text-xs text-[#848e9c]">Welcome back, {user?.first_name || 'Admin'}</p>
        </div>
        <button
          onClick={() => navigate('/app/admin')}
          className="ml-auto flex items-center gap-1.5 bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] text-xs font-semibold px-3 py-1.5 rounded-xl transition"
        >
          Full Panel <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(c => (
          <div key={c.label} className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}15` }}>
                <c.icon size={14} style={{ color: c.color }} />
              </div>
              <span className="text-[10px] text-[#848e9c] uppercase tracking-wide font-medium">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-[#eaecef]">{c.value}</p>
            <p className="text-[10px] text-[#848e9c] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide">Recent Transactions</p>
            <button onClick={() => navigate('/app/admin')} className="text-[10px] text-[#f0b90b] hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {recentTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#2b3139]/50">
                <div>
                  <p className="text-xs text-[#eaecef] truncate max-w-[180px]">{tx.user_email || `User #${tx.user_id}`}</p>
                  <p className="text-[10px] text-[#848e9c] capitalize">{(tx.tx_type || 'deposit').replace(/_/g, ' ')} · #{tx.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold text-[#eaecef]">${(tx.amount_usdt || tx.amount || 0).toFixed(2)}</p>
                  <p className={`text-[10px] font-medium capitalize ${txStatusColor(tx.status)}`}>{tx.status}</p>
                </div>
              </div>
            ))}
            {recentTx.length === 0 && <p className="text-xs text-[#848e9c] py-4 text-center">No transactions yet</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide">System Health</p>
              <Activity size={13} className="text-[#848e9c]" />
            </div>
            <div className="space-y-2">
              {health && Object.entries(health).map(([key, val]: any) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-[#848e9c] capitalize">{key.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-1.5">
                    {val?.latency_ms && <span className="text-[10px] text-[#848e9c]">{val.latency_ms}ms</span>}
                    <div className="w-2 h-2 rounded-full" style={{ background: statusDot(val?.status) }} />
                    <span className="text-[10px] capitalize" style={{ color: statusDot(val?.status) }}>{val?.status || 'unknown'}</span>
                  </div>
                </div>
              ))}
              {!health && <p className="text-xs text-[#848e9c]">Health data unavailable</p>}
            </div>
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
      </div>

      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
        <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quickActions.map(a => (
            <button
              key={a.tab}
              onClick={() => navigate('/app/admin', { state: { tab: a.tab } })}
              className="text-left p-3 rounded-xl border border-[#2b3139] hover:border-[#f0b90b]/30 hover:bg-[#1e2329] transition group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-[#eaecef] group-hover:text-[#f0b90b] transition">{a.label}</p>
                <ArrowRight size={11} className="text-[#848e9c] group-hover:text-[#f0b90b] transition" />
              </div>
              <p className="text-[10px] text-[#848e9c]">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
