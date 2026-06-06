import { useState, useEffect } from 'react'
import { Bell, BellOff, CheckCheck, Info, AlertTriangle, TrendingUp, Bot, Crown } from 'lucide-react'
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/api'

interface AppNotification {
  id: number
  title: string
  message: string
  is_read: boolean
  target_all: boolean
  created_at: string
}

function getNotifIcon(title: string) {
  const t = title.toLowerCase()
  if (t.includes('bot') || t.includes('trade')) return <Bot size={14} className="text-[#f0b90b]" />
  if (t.includes('alert') || t.includes('warning') || t.includes('warn')) return <AlertTriangle size={14} className="text-[#f0b90b]" />
  if (t.includes('market') || t.includes('price') || t.includes('signal')) return <TrendingUp size={14} className="text-[#0ecb81]" />
  if (t.includes('subscription') || t.includes('plan') || t.includes('upgrade')) return <Crown size={14} className="text-[#a855f7]" />
  return <Info size={14} className="text-[#848e9c]" />
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    loadNotifications(true)
    const iv = setInterval(() => loadNotifications(false), 15000)
    return () => clearInterval(iv)
  }, [])

  const loadNotifications = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await getUserNotifications()
      setNotifications(res.data)
    } catch {
      // ignore
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id)
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {
      // ignore
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
    } catch {
      // ignore
    }
  }

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications
  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-5 pb-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#eaecef]">Notifications</h1>
          <p className="text-xs text-[#848e9c] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs text-[#f0b90b] hover:text-[#d4a30a] bg-[#f0b90b]/8 hover:bg-[#f0b90b]/15 border border-[#f0b90b]/20 rounded-xl px-3 py-2 transition-all font-medium"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl p-1 w-fit">
        {(['all', 'unread'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={[
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
              filter === tab
                ? 'bg-[#f0b90b] text-black shadow'
                : 'text-[#848e9c] hover:text-[#eaecef]',
            ].join(' ')}
          >
            {tab}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 bg-[#f6465d] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2b3139]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[#2b3139] rounded w-2/3" />
                  <div className="h-2.5 bg-[#2b3139] rounded w-full" />
                  <div className="h-2 bg-[#2b3139] rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-full bg-[#0b0e11] flex items-center justify-center">
            <BellOff size={20} className="text-[#2b3139]" />
          </div>
          <p className="text-sm text-[#848e9c]">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          {filter === 'unread' && (
            <button onClick={() => setFilter('all')} className="text-xs text-[#f0b90b] hover:underline">
              View all notifications
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && handleMarkRead(n.id)}
              className={[
                'group bg-[#161a1e] border rounded-xl p-4 transition-all',
                !n.is_read
                  ? 'border-[#f0b90b]/25 bg-[#f0b90b]/3 cursor-pointer hover:bg-[#f0b90b]/6'
                  : 'border-[#2b3139] hover:border-[#3c4451]',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={[
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                  !n.is_read ? 'bg-[#f0b90b]/10' : 'bg-[#1e2329]',
                ].join(' ')}>
                  {getNotifIcon(n.title)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium truncate ${!n.is_read ? 'text-[#eaecef]' : 'text-[#848e9c]'}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#f0b90b] flex-shrink-0" />
                      )}
                      <span className="text-[10px] text-[#4a5568] whitespace-nowrap">{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#848e9c] mt-1 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {n.target_all && (
                      <span className="text-[10px] text-[#4a5568] bg-[#1e2329] rounded-md px-1.5 py-0.5">
                        Broadcast
                      </span>
                    )}
                    {!n.is_read && (
                      <span className="text-[10px] text-[#f0b90b]">
                        Click to mark as read
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info footer */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-[#4a5568] border-t border-[#2b3139] pt-4">
          <Bell size={10} />
          <span>Showing last {notifications.length} notifications · Auto-refreshes every 15 seconds</span>
        </div>
      )}
    </div>
  )
}
