import { useEffect, useState } from 'react'
import {
  adminGetUsers, adminGetTransactions,
  adminApproveTransaction, adminRejectTransaction,
  adminPushNotification, adminGetNotifications
} from '../lib/api'
import toast from 'react-hot-toast'
import { Users, Receipt, ShieldCheck, CheckCircle, XCircle, Trash2, Bell, Send, Globe, User } from 'lucide-react'

type Tab = 'users' | 'transactions' | 'notifications'

interface AdminNotification {
  id: number
  title: string
  message: string
  target_all: boolean
  target_user_id: number | null
  created_at: string
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<{ id: number; email: string; is_admin: boolean; is_active: boolean }[]>([])
  const [transactions, setTransactions] = useState<{ id: number; user_email: string; amount: number; status: string; created_at: string }[]>([])
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)

  // Notification form
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifTarget, setNotifTarget] = useState<'all' | 'user'>('all')
  const [notifUserId, setNotifUserId] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([adminGetUsers(), adminGetTransactions(), adminGetNotifications()])
      .then(([u, t, n]) => {
        setUsers(u.data)
        setTransactions(t.data)
        setNotifications(Array.isArray(n.data) ? n.data : [])
      })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false))
  }, [])

  const approve = async (txId: number) => {
    try {
      await adminApproveTransaction(String(txId))
      toast.success('Transaction approved')
      setTransactions(ts => ts.map(t => t.id === txId ? { ...t, status: 'approved' } : t))
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
      const payload = {
        title: notifTitle,
        message: notifMessage,
        target_all: notifTarget === 'all',
        target_user_id: notifTarget === 'user' && notifUserId ? parseInt(notifUserId) : null,
      }
      const res = await adminPushNotification(payload)
      toast.success('Notification sent!')
      setNotifications(ns => [res.data, ...ns])
      setNotifTitle('')
      setNotifMessage('')
      setNotifUserId('')
    } catch {
      toast.error('Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f6465d]/10 flex items-center justify-center">
          <ShieldCheck size={16} className="text-[#f6465d]" />
        </div>
        <h1 className="text-xl font-bold text-[#eaecef]">Admin Panel</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d] font-medium">Admin Only</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'text-[#f0b90b]' },
          { label: 'Active Users', value: users.filter(u => u.is_active).length, color: 'text-[#0ecb81]' },
          { label: 'Pending Txns', value: transactions.filter(t => t.status === 'pending').length, color: 'text-[#f0b90b]' },
          { label: 'Notifications Sent', value: notifications.length, color: 'text-[#848e9c]' },
        ].map(s => (
          <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
            <p className="text-xs text-[#848e9c] mb-2">{s.label}</p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === id ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Users */}
      {tab === 'users' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">ID</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#848e9c] text-sm">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#848e9c] text-sm">No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#f0b90b]/10 flex items-center justify-center text-xs font-bold text-[#f0b90b]">
                        {u.email?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-[#eaecef] text-sm">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_admin ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#848e9c] font-mono">#{u.id}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toast('Delete user (coming soon)')}
                      className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Date</th>
                <th className="text-right px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#848e9c] text-sm">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#848e9c] text-sm">No transactions found</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                  <td className="px-4 py-3 font-mono text-xs text-[#848e9c]">#{tx.id}</td>
                  <td className="px-4 py-3 text-[#eaecef] text-sm">{tx.user_email ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#eaecef]">${tx.amount ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-xs text-[#848e9c]">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.status === 'approved' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                      tx.status === 'rejected' ? 'bg-[#f6465d]/10 text-[#f6465d]' :
                      'bg-[#f0b90b]/10 text-[#f0b90b]'
                    }`}>{tx.status ?? 'pending'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(!tx.status || tx.status === 'pending') && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => approve(tx.id)}
                          className="p-1.5 rounded-lg text-[#0ecb81] hover:bg-[#0ecb81]/10 transition" title="Approve">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => reject(tx.id)}
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
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="grid grid-cols-5 gap-4">
          {/* Compose form */}
          <div className="col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2">
              <Send size={14} className="text-[#f0b90b]" />
              Push Notification
            </h2>
            <form onSubmit={sendNotification} className="space-y-4">
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Title</label>
                <input
                  value={notifTitle}
                  onChange={e => setNotifTitle(e.target.value)}
                  required
                  placeholder="Notification title..."
                  className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition"
                />
              </div>

              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Message</label>
                <textarea
                  value={notifMessage}
                  onChange={e => setNotifMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Write your notification message..."
                  className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Recipients</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button type="button" onClick={() => setNotifTarget('all')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition ${notifTarget === 'all' ? 'bg-[#f0b90b] text-black border-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'}`}>
                    <Globe size={12} /> All Users
                  </button>
                  <button type="button" onClick={() => setNotifTarget('user')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition ${notifTarget === 'user' ? 'bg-[#f0b90b] text-black border-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'}`}>
                    <User size={12} /> Specific User
                  </button>
                </div>
                {notifTarget === 'user' && (
                  <select
                    value={notifUserId}
                    onChange={e => setNotifUserId(e.target.value)}
                    required
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition"
                  >
                    <option value="">Select user...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                )}
              </div>

              <button type="submit" disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-3 rounded-xl text-sm transition">
                <Send size={14} />
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </form>
          </div>

          {/* Sent notifications list */}
          <div className="col-span-3 bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2b3139]">
              <h2 className="text-sm font-semibold text-[#eaecef]">Sent Notifications</h2>
            </div>
            <div className="divide-y divide-[#2b3139]/50">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <Bell size={28} className="text-[#2b3139]" />
                  <p className="text-sm text-[#848e9c]">No notifications sent yet</p>
                  <p className="text-xs text-[#4a5568]">Use the form to push a notification to users</p>
                </div>
              ) : notifications.map(n => (
                <div key={n.id} className="px-4 py-4 hover:bg-[#1e2329] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#eaecef]">{n.title}</p>
                      <p className="text-xs text-[#848e9c] mt-1 leading-relaxed">{n.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${n.target_all ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f0b90b]/10 text-[#f0b90b]'}`}>
                        {n.target_all ? 'All users' : `User #${n.target_user_id}`}
                      </span>
                      <span className="text-[10px] text-[#4a5568]">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
