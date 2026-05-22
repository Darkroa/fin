import { useEffect, useState } from 'react'
import {
  adminGetUsers, adminGetTransactions, adminApproveTransaction, adminRejectTransaction,
  adminPushNotification, adminGetNotifications, adminGetWalletConfig, adminUpdateWalletConfig,
  adminGetApiKeyUsers, adminGetSupportTickets, adminGetTicket, adminReplyTicket,
  adminUpdateTicketStatus, adminHealthCheck, adminUpdateUser,
  adminGetSubscriptions, adminApproveSubscription, adminRejectSubscription
} from '../lib/api'
import { AdminLiveVisitors } from '../components/AdminLiveVisitors'
import toast from 'react-hot-toast'
import {
  Users, Receipt, ShieldCheck, CheckCircle, XCircle, Bell, Send, Globe, User,
  Server, Key, MessageSquare, Activity, Settings, Wallet, Save, RefreshCw,
  Lock, Unlock, Ban, Star, Edit3, CreditCard, Eye
} from 'lucide-react'

type Tab = 'users' | 'transactions' | 'notifications' | 'wallet-config' | 'api-users' | 'support' | 'health' | 'subscriptions' | 'visitors'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [walletConfig, setWalletConfig] = useState<any[]>([])
  const [apiKeyUsers, setApiKeyUsers] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [healthData, setHealthData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(false)
  const [subscriptions, setSubscriptions] = useState<any[]>([])

  // Notification form
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifTarget, setNotifTarget] = useState<'all' | 'user'>('all')
  const [notifUserId, setNotifUserId] = useState('')
  const [sending, setSending] = useState(false)

  // Wallet config form
  const [cfgEdits, setCfgEdits] = useState<Record<string, string>>({})

  // Support reply
  const [adminReply, setAdminReply] = useState('')

  // Edit user
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})

  useEffect(() => {
    setLoading(true)
    Promise.all([adminGetUsers(), adminGetTransactions(), adminGetNotifications()])
      .then(([u, t, n]) => {
        setUsers(Array.isArray(u.data) ? u.data : [])
        setTransactions(Array.isArray(t.data) ? t.data : [])
        setNotifications(Array.isArray(n.data) ? n.data : [])
      })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false))
  }, [])

  const loadTabData = async (t: Tab) => {
    setTab(t)
    if (t === 'wallet-config' && walletConfig.length === 0) {
      const res = await adminGetWalletConfig().catch(() => null)
      if (res) setWalletConfig(res.data)
    }
    if (t === 'api-users' && apiKeyUsers.length === 0) {
      const res = await adminGetApiKeyUsers().catch(() => null)
      if (res) setApiKeyUsers(Array.isArray(res.data) ? res.data : [])
    }
    if (t === 'support' && tickets.length === 0) {
      const res = await adminGetSupportTickets().catch(() => null)
      if (res) setTickets(Array.isArray(res.data) ? res.data : [])
    }
    if (t === 'subscriptions') {
      const res = await adminGetSubscriptions().catch(() => null)
      if (res) {
        const d = res.data
        setSubscriptions(Array.isArray(d) ? d : (Array.isArray(d?.subscriptions) ? d.subscriptions : []))
      }
    }
    if (t === 'health') runHealthCheck()
  }

  const approveSubscription = async (id: number) => {
    try {
      await adminApproveSubscription(id)
      toast.success('Subscription approved')
      setSubscriptions(ss => ss.map(s => s.id === id ? { ...s, status: 'approved' } : s))
    } catch { toast.error('Failed to approve') }
  }

  const rejectSubscription = async (id: number) => {
    try {
      await adminRejectSubscription(id)
      toast.success('Subscription rejected')
      setSubscriptions(ss => ss.map(s => s.id === id ? { ...s, status: 'rejected' } : s))
    } catch { toast.error('Failed to reject') }
  }

  const runHealthCheck = async () => {
    setHealthLoading(true)
    try {
      const res = await adminHealthCheck()
      setHealthData(res.data)
    } catch { toast.error('Health check failed') }
    finally { setHealthLoading(false) }
  }

  const approve = async (txId: number) => {
    try {
      await adminApproveTransaction(String(txId))
      toast.success('Transaction approved')
      setTransactions(ts => ts.map(t => t.id === txId ? { ...t, status: 'approved' } : t))
      const u = await adminGetUsers(); setUsers(Array.isArray(u.data) ? u.data : [])
    } catch { toast.error('Failed to approve') }
  }

  const reject = async (txId: number) => {
    try {
      await adminRejectTransaction(String(txId))
      toast.success('Transaction rejected')
      setTransactions(ts => ts.map(t => t.id === txId ? { ...t, status: 'rejected' } : t))
    } catch { toast.error('Failed to reject') }
  }

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notifTitle.trim() || !notifMessage.trim()) return
    setSending(true)
    try {
      const payload = { title: notifTitle, message: notifMessage, target_all: notifTarget === 'all', target_user_id: notifTarget === 'user' && notifUserId ? parseInt(notifUserId) : null }
      const res = await adminPushNotification(payload)
      toast.success('Notification sent!')
      setNotifications(ns => [res.data, ...ns])
      setNotifTitle(''); setNotifMessage(''); setNotifUserId('')
    } catch { toast.error('Failed to send') }
    finally { setSending(false) }
  }

  const saveWalletConfig = async (key: string) => {
    if (!cfgEdits[key] && cfgEdits[key] !== '') return
    try {
      await adminUpdateWalletConfig({ key, value: cfgEdits[key], label: key.replace(/_/g, ' ').toUpperCase() })
      toast.success('Saved')
      const res = await adminGetWalletConfig(); setWalletConfig(res.data)
      setCfgEdits(p => { const n = { ...p }; delete n[key]; return n })
    } catch { toast.error('Failed to save') }
  }

  const openTicket = async (id: number) => {
    try {
      const res = await adminGetTicket(id)
      setSelectedTicket(res.data)
    } catch { toast.error('Failed to load ticket') }
  }

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminReply.trim() || !selectedTicket) return
    try {
      await adminReplyTicket(selectedTicket.id, adminReply)
      toast.success('Reply sent')
      setAdminReply('')
      openTicket(selectedTicket.id)
    } catch { toast.error('Failed to reply') }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminUpdateUser({ user_id: editingUser.id, ...editForm })
      toast.success('User updated')
      const u = await adminGetUsers(); setUsers(Array.isArray(u.data) ? u.data : [])
      setEditingUser(null); setEditForm({})
    } catch { toast.error('Failed to update') }
  }

  const tierColor = (t: number) => ['text-[#848e9c]', 'text-[#f0b90b]', 'text-[#0ecb81]', 'text-[#a78bfa]'][t] || 'text-[#848e9c]'

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'wallet-config', label: 'Wallet Config', icon: Wallet },
    { id: 'api-users', label: 'API Users', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'support', label: 'Support', icon: MessageSquare },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'visitors', label: 'Live Visitors', icon: Eye },
  ] as const

  const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f6465d]/10 flex items-center justify-center">
          <ShieldCheck size={16} className="text-[#f6465d]" />
        </div>
        <h1 className="text-xl font-bold text-[#eaecef]">Admin Panel</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d] font-medium">Admin Only</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'text-[#f0b90b]' },
          { label: 'Active Users', value: users.filter(u => u.is_active && !u.is_banned).length, color: 'text-[#0ecb81]' },
          { label: 'Pending Txns', value: transactions.filter(t => t.status === 'pending').length, color: 'text-[#f0b90b]' },
          { label: 'Open Tickets', value: tickets.filter(t => t.status === 'open').length, color: 'text-[#848e9c]' },
        ].map(s => (
          <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
            <p className="text-xs text-[#848e9c] mb-2">{s.label}</p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => loadTabData(id as Tab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${tab === id ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4">Edit User — {editingUser.email}</h2>
            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-[#848e9c] mb-1 block">First Name</label><input value={editForm.first_name ?? ''} onChange={e => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">Last Name</label><input value={editForm.last_name ?? ''} onChange={e => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">Email</label><input value={editForm.email ?? ''} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">Phone</label><input value={editForm.phone ?? ''} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">Balance (USDT)</label><input type="number" step="0.01" value={editForm.balance_usdt ?? ''} onChange={e => setEditForm((f: any) => ({ ...f, balance_usdt: parseFloat(e.target.value) }))} className={inp} /></div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">Account Tier</label>
                  <select value={editForm.account_tier ?? 0} onChange={e => setEditForm((f: any) => ({ ...f, account_tier: parseInt(e.target.value) }))} className={inp}>
                    <option value={0}>Tier 0 (Unverified)</option>
                    <option value={1}>Tier 1</option>
                    <option value={2}>Tier 2</option>
                    <option value={3}>Tier 3</option>
                  </select>
                </div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">KYC Status</label>
                  <select value={editForm.kyc_status ?? 'pending'} onChange={e => setEditForm((f: any) => ({ ...f, kyc_status: e.target.value }))} className={inp}>
                    <option value="pending">Pending</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="col-span-2"><label className="text-xs text-[#848e9c] mb-1 block">Subscription Plan</label>
                  <select value={editForm.subscription ?? 'free'} onChange={e => setEditForm((f: any) => ({ ...f, subscription: e.target.value }))} className={inp}>
                    <option value="free">Free</option>
                    <option value="pro">Pro — $500/mo</option>
                    <option value="elite">Elite — $1,000/mo</option>
                    <option value="elite+">Elite+ — $2,000/mo</option>
                    <option value="custom">Custom — Unlimited</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {[['is_active', 'Active'], ['is_banned', 'Banned'], ['is_admin', 'Admin'], ['profile_locked', 'Profile Locked']].map(([key, lbl]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-[#848e9c] cursor-pointer">
                    <input type="checkbox" checked={!!editForm[key]} onChange={e => setEditForm((f: any) => ({ ...f, [key]: e.target.checked }))} className="rounded" />
                    {lbl}
                  </label>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold py-2.5 rounded-xl text-sm transition">Save Changes</button>
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] rounded-xl text-sm transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Tier / KYC</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[#848e9c]">Loading...</td></tr>
                  : users.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[#848e9c]">No users</td></tr>
                  : users.map(u => (
                  <tr key={u.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.profile_photo ? <img src={u.profile_photo} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-[#f0b90b]">{u.email?.[0]?.toUpperCase()}</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#eaecef] truncate">{u.email}</p>
                          <p className="text-[10px] text-[#848e9c]">#{u.id} · {u.full_name || 'No name'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${tierColor(u.account_tier || 0)}`}>Tier {u.account_tier || 0}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${u.kyc_status === 'approved' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : u.kyc_status === 'submitted' ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'bg-[#2b3139] text-[#848e9c]'}`}>{u.kyc_status || 'pending'}</span>
                      <div className="mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          u.subscription === 'custom' ? 'bg-[#a78bfa]/10 text-[#a78bfa]' :
                          u.subscription === 'elite+' ? 'bg-[#38bdf8]/10 text-[#38bdf8]' :
                          u.subscription === 'elite'  ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                          u.subscription === 'pro'    ? 'bg-[#f0b90b]/10 text-[#f0b90b]' :
                                                        'bg-[#2b3139] text-[#848e9c]'
                        }`}>{(u.subscription || 'free').toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">${(u.balance_usdt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.is_admin && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]">Admin</span>}
                        {u.is_banned && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]">Banned</span>}
                        {!u.is_banned && u.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81]">Active</span>}
                        {u.profile_locked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#848e9c]/20 text-[#848e9c]">Locked</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditingUser(u); setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone, balance_usdt: u.balance_usdt, account_tier: u.account_tier, kyc_status: u.kyc_status, is_active: u.is_active, is_banned: u.is_banned, is_admin: u.is_admin, profile_locked: u.profile_locked, subscription: u.subscription || 'free' }) }}
                        className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#f0b90b]/10 transition">
                        <Edit3 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TRANSACTIONS */}
      {tab === 'transactions' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                  <th className="text-left px-4 py-3 font-medium">ID</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Date</th>
                  <th className="text-right px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[#848e9c]">No transactions</td></tr>
                  : transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                    <td className="px-4 py-3 font-mono text-xs text-[#848e9c]">#{tx.id}</td>
                    <td className="px-4 py-3 text-xs text-[#eaecef] truncate max-w-[140px]">{tx.user_email || '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#848e9c] capitalize">{(tx.tx_type || 'deposit').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">${(tx.amount_usdt || tx.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#848e9c] whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${tx.status === 'approved' || tx.status === 'completed' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : tx.status === 'rejected' ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'bg-[#f0b90b]/10 text-[#f0b90b]'}`}>
                        {tx.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => approve(tx.id)} className="p-1.5 rounded-lg text-[#0ecb81] hover:bg-[#0ecb81]/10 transition" title="Approve"><CheckCircle size={14} /></button>
                          <button onClick={() => reject(tx.id)} className="p-1.5 rounded-lg text-[#f6465d] hover:bg-[#f6465d]/10 transition" title="Reject"><XCircle size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WALLET CONFIG */}
      {tab === 'wallet-config' && (
        <div className="space-y-4">
          {/* Crypto addresses */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2">
              <span className="text-[#f7931a]">₿</span> Crypto Deposit Addresses
            </h2>
            <div className="space-y-3">
              {[
                { key: 'btc_address',  label: 'Bitcoin (BTC) Address' },
                { key: 'eth_address',  label: 'Ethereum (ETH) Address' },
                { key: 'usdt_trc20',   label: 'USDT TRC-20 Address' },
              ].map(field => {
                const existing = walletConfig.find((c: any) => c.key === field.key)
                const val = cfgEdits[field.key] !== undefined ? cfgEdits[field.key] : (existing?.value || '')
                return (
                  <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs text-[#848e9c] w-48 flex-shrink-0">{field.label}</label>
                    <input value={val} onChange={e => setCfgEdits(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition font-mono" />
                  </div>
                )
              })}
            </div>
            <button
              onClick={async () => {
                const cryptoKeys = ['btc_address', 'eth_address', 'usdt_trc20']
                let saved = 0
                for (const key of cryptoKeys) {
                  if (cfgEdits[key] !== undefined) { await saveWalletConfig(key); saved++ }
                }
                if (saved === 0) toast('No changes to save')
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-[#f7931a]/10 hover:bg-[#f7931a]/20 border border-[#f7931a]/30 text-[#f7931a] rounded-xl text-xs font-semibold transition">
              <Save size={12} /> Save All Crypto Addresses
            </button>
          </div>

          {/* Bank details */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2">
              <span className="text-[#848e9c]">🏦</span> Bank Transfer Details
            </h2>
            <div className="space-y-3">
              {[
                { key: 'bank_name',             label: 'Bank Name' },
                { key: 'bank_account',          label: 'Account Number / IBAN' },
                { key: 'bank_routing',          label: 'Routing / Sort Code' },
                { key: 'bank_swift',            label: 'SWIFT / BIC Code' },
                { key: 'bank_name_beneficiary', label: 'Beneficiary Name' },
              ].map(field => {
                const existing = walletConfig.find((c: any) => c.key === field.key)
                const val = cfgEdits[field.key] !== undefined ? cfgEdits[field.key] : (existing?.value || '')
                return (
                  <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs text-[#848e9c] w-48 flex-shrink-0">{field.label}</label>
                    <input value={val} onChange={e => setCfgEdits(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition font-mono" />
                  </div>
                )
              })}
            </div>
            <button
              onClick={async () => {
                const bankKeys = ['bank_name', 'bank_account', 'bank_routing', 'bank_swift', 'bank_name_beneficiary']
                let saved = 0
                for (const key of bankKeys) {
                  if (cfgEdits[key] !== undefined) { await saveWalletConfig(key); saved++ }
                }
                if (saved === 0) toast('No changes to save')
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 border border-[#0ecb81]/30 text-[#0ecb81] rounded-xl text-xs font-semibold transition">
              <Save size={12} /> Save All Bank Details
            </button>
          </div>
        </div>
      )}

      {/* API KEY USERS */}
      {tab === 'api-users' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2b3139]">
            <h2 className="text-sm font-semibold text-[#eaecef]">Users with Active API Keys</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Key Name</th>
                  <th className="text-left px-4 py-3 font-medium">Purpose</th>
                  <th className="text-right px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-4 py-3 font-medium">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {apiKeyUsers.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-[#848e9c]">No active API keys</td></tr>
                  : apiKeyUsers.map(k => (
                  <tr key={k.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                    <td className="px-4 py-3 text-xs text-[#eaecef]">{k.user_email}</td>
                    <td className="px-4 py-3 text-xs text-[#848e9c]">{k.key_name}</td>
                    <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] capitalize">{k.purpose || 'bot'}</span></td>
                    <td className="px-4 py-3 text-right text-xs text-[#848e9c]">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#848e9c]">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2"><Send size={14} className="text-[#f0b90b]" /> Push Notification</h2>
            <form onSubmit={sendNotification} className="space-y-3">
              <div><label className="text-xs text-[#848e9c] mb-1.5 block">Title</label>
                <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} required placeholder="Title..." className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition" /></div>
              <div><label className="text-xs text-[#848e9c] mb-1.5 block">Message</label>
                <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} required rows={3} placeholder="Message..." className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition resize-none" /></div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setNotifTarget('all')} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition ${notifTarget === 'all' ? 'bg-[#f0b90b] text-black border-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c]'}`}><Globe size={11} /> All Users</button>
                <button type="button" onClick={() => setNotifTarget('user')} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition ${notifTarget === 'user' ? 'bg-[#f0b90b] text-black border-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c]'}`}><User size={11} /> Specific</button>
              </div>
              {notifTarget === 'user' && <select value={notifUserId} onChange={e => setNotifUserId(e.target.value)} required className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b]"><option value="">Select user...</option>{users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}</select>}
              <button type="submit" disabled={sending} className="w-full flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl text-sm transition"><Send size={13} />{sending ? 'Sending...' : 'Send'}</button>
            </form>
          </div>
          <div className="lg:col-span-3 bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2b3139]"><h2 className="text-sm font-semibold text-[#eaecef]">Sent Notifications</h2></div>
            <div className="divide-y divide-[#2b3139]/50 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? <div className="py-12 text-center text-[#848e9c] text-sm">No notifications</div>
                : notifications.map(n => (
                <div key={n.id} className="px-4 py-3 hover:bg-[#1e2329] transition">
                  <p className="text-xs font-medium text-[#eaecef]">{n.title}</p>
                  <p className="text-xs text-[#848e9c] mt-0.5">{n.message}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${n.target_all ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f0b90b]/10 text-[#f0b90b]'}`}>{n.target_all ? 'All users' : `User #${n.target_user_id}`}</span>
                    <span className="text-[10px] text-[#4a5568]">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT */}
      {tab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 400 }}>
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#2b3139]"><p className="text-sm font-semibold text-[#eaecef]">Tickets ({tickets.length})</p></div>
            <div className="flex-1 overflow-y-auto">
              {tickets.length === 0 ? <div className="py-8 text-center text-[#848e9c] text-sm">No tickets</div>
                : tickets.map(t => (
                <button key={t.id} onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition ${selectedTicket?.id === t.id ? 'bg-[#1e2329]' : ''}`}>
                  <p className="text-xs font-medium text-[#eaecef] truncate">{t.subject}</p>
                  <p className="text-[10px] text-[#848e9c]">{t.user_email} · {t.message_count} msgs</p>
                  <div className="flex gap-1 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.status === 'open' ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : t.status === 'resolved' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'}`}>{t.status}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.priority === 'urgent' ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'bg-[#2b3139] text-[#848e9c]'}`}>{t.priority}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden flex flex-col">
            {selectedTicket ? (
              <>
                <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#eaecef] truncate">{selectedTicket.subject}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                      <button key={s} onClick={() => adminUpdateTicketStatus(selectedTicket.id, s).then(() => { toast.success(`Status: ${s}`); setSelectedTicket((t: any) => t ? { ...t, status: s } : t) }).catch(() => {})}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition capitalize ${selectedTicket.status === s ? 'border-[#f0b90b] text-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'}`}>
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                  {selectedTicket.messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.is_admin ? 'bg-[#f6465d]/10 border border-[#f6465d]/20' : 'bg-[#1e2329] border border-[#2b3139]'}`}>
                        <p className="text-xs text-[#eaecef]">{msg.message}</p>
                        <p className="text-[10px] text-[#848e9c] mt-1">{msg.is_admin ? 'Admin' : msg.sender_email} · {new Date(msg.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAdminReply} className="p-3 border-t border-[#2b3139] flex gap-2">
                  <input value={adminReply} onChange={e => setAdminReply(e.target.value)} required placeholder="Admin reply..."
                    className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition" />
                  <button type="submit" className="p-2.5 bg-[#f6465d] hover:bg-[#d93d51] text-white rounded-xl transition"><Send size={14} /></button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <MessageSquare size={32} className="text-[#2b3139] mx-auto mb-2" />
                  <p className="text-sm text-[#848e9c]">Select a ticket to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBSCRIPTIONS */}
      {tab === 'subscriptions' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2">
              <CreditCard size={14} className="text-[#f0b90b]" /> Subscription Requests
            </h2>
            <button onClick={() => adminGetSubscriptions().then(r => { const d = r.data; setSubscriptions(Array.isArray(d) ? d : (Array.isArray(d?.subscriptions) ? d.subscriptions : [])) })}
              className="text-xs text-[#848e9c] hover:text-[#eaecef] flex items-center gap-1 transition">
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[#848e9c] text-xs border-b border-[#2b3139] bg-[#0b0e11]">
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Period</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Method</th>
                  <th className="text-right px-4 py-3 font-medium">Date</th>
                  <th className="text-right px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-[#848e9c]">No subscription requests yet</td></tr>
                ) : subscriptions.map((s: any) => (
                  <tr key={s.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                    <td className="px-4 py-3 font-mono text-xs text-[#848e9c]">#{s.id}</td>
                    <td className="px-4 py-3 text-xs text-[#eaecef] truncate max-w-[150px]">{s.user_email || `User #${s.user_id}`}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-[#f0b90b] capitalize">{s.plan}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#848e9c] capitalize">{s.period || 'monthly'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">${(s.amount_usdt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-[#848e9c] capitalize">{(s.payment_method || 'wallet').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#848e9c] whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        s.status === 'approved' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                        s.status === 'rejected' ? 'bg-[#f6465d]/10 text-[#f6465d]' :
                        'bg-[#f0b90b]/10 text-[#f0b90b]'
                      }`}>{s.status || 'pending'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => approveSubscription(s.id)}
                            className="p-1.5 rounded-lg text-[#0ecb81] hover:bg-[#0ecb81]/10 transition" title="Approve">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => rejectSubscription(s.id)}
                            className="p-1.5 rounded-lg text-[#f6465d] hover:bg-[#f6465d]/10 transition" title="Reject">
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LIVE VISITORS */}
      {tab === 'visitors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Eye size={15} className="text-[#f0b90b]" />
            <h2 className="text-sm font-semibold text-[#eaecef]">Live Visitor Tracking</h2>
            <span className="text-xs text-[#848e9c]">Real-time session data · refreshes every 30s</span>
          </div>
          <AdminLiveVisitors />
        </div>
      )}

      {/* HEALTH */}
      {tab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[#eaecef]">API Health Monitor</h2>
            <button onClick={runHealthCheck} disabled={healthLoading}
              className="flex items-center gap-1.5 text-xs text-[#f0b90b] hover:text-[#d4a30a] transition">
              <RefreshCw size={12} className={healthLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {healthLoading && <div className="py-8 text-center text-[#848e9c]">Running health checks...</div>}
          {healthData && (
            <>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${healthData.overall === 'healthy' ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : 'bg-[#f0b90b]/5 border-[#f0b90b]/20'}`}>
                <Activity size={14} className={healthData.overall === 'healthy' ? 'text-[#0ecb81]' : 'text-[#f0b90b]'} />
                <span className="text-sm font-medium text-[#eaecef]">Overall: <span className={`capitalize ${healthData.overall === 'healthy' ? 'text-[#0ecb81]' : 'text-[#f0b90b]'}`}>{healthData.overall}</span></span>
                <span className="text-xs text-[#848e9c] ml-auto">{new Date(healthData.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(healthData.checks || {}).map(([name, check]: [string, any]) => (
                  <div key={name} className={`bg-[#161a1e] border rounded-xl p-4 ${check.status === 'healthy' ? 'border-[#0ecb81]/20' : check.status === 'error' ? 'border-[#f6465d]/20' : 'border-[#f0b90b]/20'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[#eaecef] capitalize">{name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${check.status === 'healthy' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : check.status === 'error' ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'bg-[#f0b90b]/10 text-[#f0b90b]'}`}>{check.status}</span>
                    </div>
                    {check.latency_ms !== undefined && <p className="text-xs text-[#848e9c]">Latency: {check.latency_ms}ms</p>}
                    {check.workers !== undefined && <p className="text-xs text-[#848e9c]">Workers: {check.workers}</p>}
                    {check.error && <p className="text-xs text-[#f6465d] truncate">{check.error}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
