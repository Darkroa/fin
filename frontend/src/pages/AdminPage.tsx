import { useEffect, useState } from 'react'
import {
  adminGetUsers, adminGetTransactions, adminApproveTransaction, adminRejectTransaction,
  adminPushNotification, adminGetNotifications, adminGetWalletConfig, adminUpdateWalletConfig,
  adminGetApiKeyUsers, adminGetSupportTickets, adminGetTicket, adminReplyTicket,
  adminUpdateTicketStatus, adminHealthCheck, adminUpdateUser,
  adminGetSubscriptions, adminApproveSubscription, adminRejectSubscription,
  getAdminBonuses, adminGrantBonus, toggleAdminBonus, deleteAdminBonus,
  adminGetBonusClaims, adminRevokeBonusClaim,
  getAdminReferrals, adminUpdateReferralCode, adminResetReferralCode,
  adminGetAds, adminCreateAd, adminUpdateAd, adminToggleAd, adminDeleteAd,
  adminGetUserDepositConfig, adminSetUserDepositConfig,
  adminSaveVpsPlans, adminSaveAssetProducts, adminSavePricingPlans,
  getVpsPlans, getAssetProducts, getPricingPlans,
  adminGetTestimonials, adminCreateTestimonial, adminUpdateTestimonial, adminToggleTestimonial, adminDeleteTestimonial,
  adminGetWalletStats,
  adminGetChatFeedback,
} from '../lib/api'
import { AdminLiveVisitors } from '../components/AdminLiveVisitors'
import toast from 'react-hot-toast'
import {
  Users, UserCheck, Receipt, ShieldCheck, CheckCircle, XCircle, Bell, Send, Globe, User,
  Key, MessageSquare, Activity, Wallet, Save, RefreshCw,
  Edit3, CreditCard, Eye, Gift, Trash2, ToggleLeft, ToggleRight,
  Share2, Copy, RotateCcw, Megaphone, Image, Plus, Link2, ExternalLink,
  Server, ShoppingBag, Package, DollarSign, X, Star, ChevronDown, Clock, Monitor, Download,
  BarChart2, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { adminGetUserActivity, adminClearUserActivity, getWhatsAppEvStatus, getWhatsAppQR } from '../lib/api'

type Tab = 'users' | 'transactions' | 'notifications' | 'wallet-config' | 'api-users' | 'support' | 'health' | 'subscriptions' | 'visitors' | 'bonuses' | 'referrals' | 'ads' | 'products' | 'testimonials' | 'activity' | 'platform-stats' | 'whatsapp-bot'

interface VpsPlan { id: number; name: string; price: number; specs: string; start_date?: string; end_date?: string; roi_percent?: number; description?: string }
interface AssetProduct { id: number; name: string; price: number; icon: string; start_date?: string; end_date?: string; roi_percent?: number; description?: string }
interface PricingPlan { name: string; price: number; period: string }

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
  const [referrals, setReferrals] = useState<any[]>([])
  const [refSearch, setRefSearch] = useState('')
  const [editingRef, setEditingRef] = useState<number | null>(null)
  const [editingRefCode, setEditingRefCode] = useState('')
  const [refLoading, setRefLoading] = useState(false)
  const [copiedRefId, setCopiedRefId] = useState<number | null>(null)

  const [bonuses, setBonuses] = useState<any[]>([])
  const [bonusForm, setBonusForm] = useState({
    title: '', bonus_type: 'manual_grant', amount_usdt: 10,
    target: 'all', target_user_email: '', tier_required: 3,
    note: '', task_description: '', require_claim: false, grant_now: true,
  })
  const [bonusLoading, setBonusLoading] = useState(false)
  const [bonusClaims, setBonusClaims] = useState<any[]>([])
  const [expandedBonus, setExpandedBonus] = useState<number | null>(null)
  const [claimsLoading, setClaimsLoading] = useState(false)

  // Activity log
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Ads
  const [ads, setAds] = useState<any[]>([])
  const [adForm, setAdForm] = useState({ title: '', description: '', ad_type: 'banner', image_base64: '', link_url: '', is_active: true })
  const [adImageName, setAdImageName] = useState('')
  const [adLoading, setAdLoading] = useState(false)
  const [editingAd, setEditingAd] = useState<any>(null)
  const [editingAdForm, setEditingAdForm] = useState<any>({})

  // Per-user deposit config
  const [userDepUser, setUserDepUser] = useState<any>(null)
  const [userDepSearch, setUserDepSearch] = useState('')
  const [userDepCfg, setUserDepCfg] = useState<Record<string, string>>({})
  const [userDepLoading, setUserDepLoading] = useState(false)
  const [userDepSaving, setUserDepSaving] = useState(false)
  const [viewProofTx, setViewProofTx] = useState<any>(null)

  // Testimonials
  const [testimonials, setTestimonials] = useState<any[]>([])
  const [testimonialForm, setTestimonialForm] = useState({ name: '', role: '', content: '', rating: 5, avatar_color: '#f0b90b' })
  const [editingTestimonial, setEditingTestimonial] = useState<any>(null)
  const [testimonialLoading, setTestimonialLoading] = useState(false)

  // Products management
  const [vpsPlans, setVpsPlans] = useState<VpsPlan[]>([])
  const [assetProducts, setAssetProducts] = useState<AssetProduct[]>([])
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [editingVps, setEditingVps] = useState<VpsPlan | null>(null)
  const [editingAsset, setEditingAsset] = useState<AssetProduct | null>(null)
  const [newVps, setNewVps] = useState({ name: '', price: 0, specs: '', start_date: '', end_date: '', roi_percent: 0, description: '' })
  const [newAsset, setNewAsset] = useState({ name: '', price: 0, icon: '₿', start_date: '', end_date: '', roi_percent: 0, description: '' })
  const [showAddVps, setShowAddVps] = useState(false)
  const [showAddAsset, setShowAddAsset] = useState(false)
  // Bank logo
  const [bankLogoPreview, setBankLogoPreview] = useState('')

  // Platform wallet stats
  const [walletStats, setWalletStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  // Chat feedback stats
  const [feedbackStats, setFeedbackStats] = useState<{ likes: number; dislikes: number; total: number } | null>(null)
  // WhatsApp Bot
  const [evStatus, setEvStatus] = useState<any>(null)
  const [evQr, setEvQr] = useState<any>(null)
  const [evStatusLoading, setEvStatusLoading] = useState(false)
  const [evQrLoading, setEvQrLoading] = useState(false)

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
    if (t === 'bonuses') {
      const [bRes, cRes] = await Promise.all([
        getAdminBonuses().catch(() => null),
        adminGetBonusClaims().catch(() => null),
      ])
      if (bRes) setBonuses(Array.isArray(bRes.data) ? bRes.data : [])
      if (cRes) setBonusClaims(Array.isArray(cRes.data) ? cRes.data : [])
    }
    if (t === 'referrals') {
      const res = await getAdminReferrals().catch(() => null)
      if (res) setReferrals(Array.isArray(res.data) ? res.data : [])
    }
    if (t === 'ads') {
      const res = await adminGetAds().catch(() => null)
      if (res) setAds(Array.isArray(res.data) ? res.data : [])
    }
    if (t === 'testimonials') {
      const res = await adminGetTestimonials().catch(() => null)
      if (res) setTestimonials(Array.isArray(res.data) ? res.data : [])
    }
    if (t === 'activity') {
      setActivityLoading(true)
      try {
        const res = await adminGetUserActivity()
        setActivityLogs(Array.isArray(res.data) ? res.data : [])
      } catch { /* ignore */ } finally { setActivityLoading(false) }
    }
    if (t === 'products') {
      setProductsLoading(true)
      try {
        const [vpsRes, assetRes, pricingRes] = await Promise.all([
          getVpsPlans().catch(() => null),
          getAssetProducts().catch(() => null),
          getPricingPlans().catch(() => null),
        ])
        if (vpsRes?.data && Array.isArray(vpsRes.data)) setVpsPlans(vpsRes.data)
        if (assetRes?.data && Array.isArray(assetRes.data)) setAssetProducts(assetRes.data)
        if (pricingRes?.data && Array.isArray(pricingRes.data)) setPricingPlans(pricingRes.data)
      } finally { setProductsLoading(false) }
    }
    if (t === 'platform-stats') {
      setStatsLoading(true)
      try {
        const [statsRes, fbRes] = await Promise.all([
          adminGetWalletStats(),
          adminGetChatFeedback().catch(() => null),
        ])
        setWalletStats(statsRes.data)
        if (fbRes?.data) setFeedbackStats(fbRes.data)
      } catch { toast.error('Failed to load platform stats') }
      finally { setStatsLoading(false) }
    }
    if (t === 'whatsapp-bot') {
      setEvStatusLoading(true)
      try {
        const res = await getWhatsAppEvStatus()
        setEvStatus(res.data)
      } catch { setEvStatus(null) }
      finally { setEvStatusLoading(false) }
    }
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
    { id: 'platform-stats', label: 'Platform', icon: BarChart2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'referrals', label: 'Referrals', icon: Share2 },
    { id: 'bonuses', label: 'Bonuses', icon: Gift },
    { id: 'wallet-config', label: 'Wallet Config', icon: Wallet },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'api-users', label: 'API Users', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'support', label: 'Support', icon: MessageSquare },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'visitors', label: 'Live Visitors', icon: Eye },
    { id: 'ads', label: 'Ads', icon: Megaphone },
    { id: 'testimonials', label: 'Reviews', icon: Star },
    { id: 'activity', label: 'Activity Log', icon: Clock },
    { id: 'whatsapp-bot', label: 'WhatsApp Bot', icon: MessageSquare },
  ] as const

  const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'
  const sel = inp + ' appearance-none pr-9 cursor-pointer'

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

      {/* Tabs — grid layout */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-1.5">
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => loadTabData(id as Tab)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition ${tab === id ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]/50'}`}>
              <Icon size={13} />
              <span className="leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
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
                  <div className="relative">
                    <select value={editForm.account_tier ?? 0} onChange={e => setEditForm((f: any) => ({ ...f, account_tier: parseInt(e.target.value) }))} className={sel}>
                      <option value={0}>Tier 0 (Unverified)</option>
                      <option value={1}>Tier 1</option>
                      <option value={2}>Tier 2</option>
                      <option value={3}>Tier 3</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                  </div>
                </div>
                <div><label className="text-xs text-[#848e9c] mb-1 block">KYC Status</label>
                  <div className="relative">
                    <select value={editForm.kyc_status ?? 'pending'} onChange={e => setEditForm((f: any) => ({ ...f, kyc_status: e.target.value }))} className={sel}>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                  </div>
                </div>
                <div className="col-span-2"><label className="text-xs text-[#848e9c] mb-1 block">Subscription Plan</label>
                  <div className="relative">
                    <select value={editForm.subscription ?? 'free'} onChange={e => setEditForm((f: any) => ({ ...f, subscription: e.target.value }))} className={sel}>
                      <option value="free">Free</option>
                      <option value="pro">Pro — $500/mo</option>
                      <option value="elite">Elite — $1,000/mo</option>
                      <option value="elite+">Elite+ — $2,000/mo</option>
                      <option value="custom">Custom — Unlimited</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                  </div>
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
              {/* Manual email verification */}
              <div className="flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-[#eaecef]">Email Verified</p>
                  <p className="text-[10px] text-[#848e9c]">Manually verify or unverify email (backup override)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm((f: any) => ({ ...f, is_mail_verified: !f.is_mail_verified }))}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 ${editForm.is_mail_verified ? 'bg-[#0ecb81]' : 'bg-[#2b3139]'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${editForm.is_mail_verified ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                </button>
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
                      <button onClick={() => { setEditingUser(u); setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone, balance_usdt: u.balance_usdt, account_tier: u.account_tier, kyc_status: u.kyc_status, is_active: u.is_active, is_banned: u.is_banned, is_admin: u.is_admin, profile_locked: u.profile_locked, subscription: u.subscription || 'free', is_mail_verified: u.is_mail_verified }) }}
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
                      <div className="flex justify-end gap-1">
                        {tx.payment_proof && (
                          <button onClick={() => setViewProofTx(tx)} className="p-1.5 rounded-lg text-[#f0b90b] hover:bg-[#f0b90b]/10 transition" title="View payment proof">
                            <Image size={14} />
                          </button>
                        )}
                        {tx.status === 'pending' && (
                          <>
                            <button onClick={() => approve(tx.id)} className="p-1.5 rounded-lg text-[#0ecb81] hover:bg-[#0ecb81]/10 transition" title="Approve"><CheckCircle size={14} /></button>
                            <button onClick={() => reject(tx.id)} className="p-1.5 rounded-lg text-[#f6465d] hover:bg-[#f6465d]/10 transition" title="Reject"><XCircle size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment proof viewer modal */}
      {viewProofTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setViewProofTx(null)}>
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5 max-w-lg w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#eaecef]">Payment Proof — TX #{viewProofTx.id}</h3>
              <button onClick={() => setViewProofTx(null)} className="text-xs text-[#848e9c] hover:text-[#eaecef]">Close</button>
            </div>
            <p className="text-xs text-[#848e9c]">{viewProofTx.user_email} · ${(viewProofTx.amount_usdt || 0).toFixed(2)} USDT</p>
            <img src={viewProofTx.payment_proof} alt="payment proof" className="w-full rounded-xl object-contain max-h-96 border border-[#2b3139]" />
            <div className="flex gap-2">
              {viewProofTx.status === 'pending' && (
                <>
                  <button onClick={() => { approve(viewProofTx.id); setViewProofTx(null) }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/30 hover:bg-[#0ecb81]/20 transition"><CheckCircle size={12} />Approve</button>
                  <button onClick={() => { reject(viewProofTx.id); setViewProofTx(null) }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-[#f6465d]/10 text-[#f6465d] border border-[#f6465d]/30 hover:bg-[#f6465d]/20 transition"><XCircle size={12} />Reject</button>
                </>
              )}
            </div>
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

          {/* Bank Logo Upload */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2">
              <Image size={14} className="text-[#f0b90b]" /> Bank Logo (Circular)
            </h2>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-16 h-16 rounded-full border-2 border-[#2b3139] flex items-center justify-center overflow-hidden bg-[#0b0e11] flex-shrink-0">
                {bankLogoPreview || walletConfig.find((c: any) => c.key === 'bank_logo')?.value ? (
                  <img
                    src={bankLogoPreview || walletConfig.find((c: any) => c.key === 'bank_logo')?.value}
                    alt="Bank logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl text-[#848e9c]">B</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="border border-dashed border-[#2b3139] rounded-xl p-3 text-center hover:border-[#f0b90b]/40 transition cursor-pointer"
                  onClick={() => document.getElementById('bank-logo-upload')?.click()}>
                  <input id="bank-logo-upload" type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { toast.error('File too large — max 2MB'); return }
                      const reader = new FileReader()
                      reader.onload = async ev => {
                        const b64 = ev.target?.result as string
                        setBankLogoPreview(b64)
                        try {
                          await adminUpdateWalletConfig({ key: 'bank_logo', value: b64, label: 'Bank Logo' })
                          toast.success('Bank logo saved!')
                        } catch { toast.error('Failed to save logo') }
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                  <p className="text-xs text-[#848e9c]">Click to upload bank logo</p>
                  <p className="text-[10px] text-[#4a5568] mt-0.5">PNG, JPG — max 2MB · shown as circle</p>
                </div>
                {(bankLogoPreview || walletConfig.find((c: any) => c.key === 'bank_logo')?.value) && (
                  <button onClick={async () => {
                    setBankLogoPreview('')
                    try {
                      await adminUpdateWalletConfig({ key: 'bank_logo', value: '', label: 'Bank Logo' })
                      toast.success('Bank logo removed')
                    } catch { toast.error('Failed to remove logo') }
                  }} className="flex items-center gap-1 text-[10px] text-[#f6465d] hover:underline">
                    <X size={10} /> Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bank details */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2">
              Bank Transfer Details
            </h2>
            <div className="space-y-3">
              {[
                { key: 'bank_name',             label: 'Bank Name' },
                { key: 'bank_address',          label: 'Bank Address' },
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
                const bankKeys = ['bank_name', 'bank_address', 'bank_account', 'bank_routing', 'bank_swift', 'bank_name_beneficiary']
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

          {/* Deposit Note */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-1 flex items-center gap-2">
              <MessageSquare size={14} className="text-[#f0b90b]" /> Deposit Instructions / Note
            </h2>
            <p className="text-[11px] text-[#848e9c] mb-3">This note is shown to users on the deposit confirmation screen. Use it for important instructions, warnings, or minimum deposit info.</p>
            <textarea
              value={cfgEdits['deposit_note'] !== undefined ? cfgEdits['deposit_note'] : (walletConfig.find((c: any) => c.key === 'deposit_note')?.value || '')}
              onChange={e => setCfgEdits(p => ({ ...p, deposit_note: e.target.value }))}
              placeholder="e.g. Minimum deposit $10 · Allow 1-3 business days for bank transfers · Always include your User ID as reference..."
              rows={3}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition resize-none"
            />
            <button
              onClick={() => saveWalletConfig('deposit_note')}
              disabled={cfgEdits['deposit_note'] === undefined}
              className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-xl text-xs font-semibold transition disabled:opacity-40">
              <Save size={12} /> Save Note
            </button>
          </div>

          {/* Per-User Deposit Config */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-1 flex items-center gap-2">
              <Users size={14} className="text-[#f0b90b]" /> Per-User Deposit Details
            </h2>
            <p className="text-[11px] text-[#848e9c] mb-4">Override deposit account numbers for a specific user. They will see these details instead of the global ones.</p>

            {/* User search */}
            <div className="mb-3">
              <label className="text-xs text-[#848e9c] mb-1.5 block">Search user by email</label>
              <div className="flex gap-2">
                <input
                  value={userDepSearch}
                  onChange={e => setUserDepSearch(e.target.value)}
                  placeholder="user@example.com"
                  className={`${inp} flex-1`}
                />
                <button
                  onClick={async () => {
                    const found = users.find(u => u.email?.toLowerCase().includes(userDepSearch.toLowerCase()))
                    if (!found) return toast.error('User not found')
                    setUserDepUser(found)
                    setUserDepLoading(true)
                    try {
                      const res = await adminGetUserDepositConfig(found.id)
                      setUserDepCfg(res.data || {})
                    } catch { setUserDepCfg({}) }
                    finally { setUserDepLoading(false) }
                  }}
                  className="px-4 py-2 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-xl text-xs font-semibold transition flex-shrink-0">
                  Load
                </button>
              </div>
              {users.filter(u => userDepSearch && u.email?.toLowerCase().includes(userDepSearch.toLowerCase())).slice(0, 4).map(u => (
                <button key={u.id} onClick={async () => {
                  setUserDepSearch(u.email)
                  setUserDepUser(u)
                  setUserDepLoading(true)
                  try {
                    const res = await adminGetUserDepositConfig(u.id)
                    setUserDepCfg(res.data || {})
                  } catch { setUserDepCfg({}) }
                  finally { setUserDepLoading(false) }
                }}
                  className="mt-1 w-full text-left px-3 py-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139] text-xs text-[#eaecef] hover:border-[#f0b90b]/30 transition block">
                  {u.email} <span className="text-[#4a5568] ml-1">#{u.id}</span>
                </button>
              ))}
            </div>

            {userDepUser && (
              <div className="mt-3 space-y-3 border-t border-[#2b3139] pt-3">
                <p className="text-xs text-[#f0b90b] font-medium flex items-center gap-1.5">
                  <UserCheck size={12} /> Configuring: {userDepUser.email}
                  {userDepLoading && <span className="text-[#848e9c]"> — loading...</span>}
                </p>
                <p className="text-[10px] text-[#4a5568]">Leave any field blank to fall back to the global default. Only filled fields are saved.</p>
                {[
                  { key: 'bank_name',             label: 'Bank Name' },
                  { key: 'bank_address',          label: 'Bank Address' },
                  { key: 'bank_account',          label: 'Account Number / IBAN' },
                  { key: 'bank_routing',          label: 'Routing / Sort Code' },
                  { key: 'bank_swift',            label: 'SWIFT / BIC Code' },
                  { key: 'bank_name_beneficiary', label: 'Beneficiary Name' },
                  { key: 'btc_address',           label: 'Bitcoin (BTC) Address' },
                  { key: 'eth_address',           label: 'Ethereum (ETH) Address' },
                  { key: 'usdt_trc20',            label: 'USDT TRC-20 Address' },
                  { key: 'note',                  label: 'Note (shown to user)' },
                ].map(field => (
                  <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs text-[#848e9c] w-48 flex-shrink-0">{field.label}</label>
                    <input
                      value={userDepCfg[field.key] || ''}
                      onChange={e => setUserDepCfg(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Override ${field.label.toLowerCase()}...`}
                      className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition font-mono"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    disabled={userDepSaving}
                    onClick={async () => {
                      setUserDepSaving(true)
                      try {
                        const payload = Object.fromEntries(Object.entries(userDepCfg).filter(([, v]) => v?.trim()))
                        await adminSetUserDepositConfig(userDepUser.id, payload)
                        toast.success(`Deposit config saved for ${userDepUser.email}`)
                      } catch { toast.error('Failed to save') }
                      finally { setUserDepSaving(false) }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-xl text-xs font-semibold transition disabled:opacity-60">
                    <Save size={12} /> {userDepSaving ? 'Saving...' : 'Save for This User'}
                  </button>
                  <button
                    onClick={async () => {
                      setUserDepSaving(true)
                      try {
                        await adminSetUserDepositConfig(userDepUser.id, {})
                        setUserDepCfg({})
                        toast.success('Config cleared — user will see global defaults')
                      } catch { toast.error('Failed to clear') }
                      finally { setUserDepSaving(false) }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#f6465d]/10 hover:bg-[#f6465d]/20 border border-[#f6465d]/30 text-[#f6465d] rounded-xl text-xs font-semibold transition disabled:opacity-60">
                    <X size={12} /> Reset to Global
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADS MANAGEMENT */}
      {tab === 'ads' && (
        <div className="space-y-4">
          {/* Create new ad */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2"><Plus size={14} className="text-[#f0b90b]" /> Create New Ad</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Ad Title *</label>
                <input value={adForm.title} onChange={e => setAdForm(f => ({ ...f, title: e.target.value }))} placeholder="Ad title..." className={inp} />
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Description / Note (optional)</label>
                <textarea value={adForm.description} onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))} placeholder="Short note or caption shown under the ad..." rows={2}
                  className={`${inp} resize-none`} />
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Ad Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['banner', 'popup', 'sidebar', 'notification', 'ticker', 'more-banner'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setAdForm(f => ({ ...f, ad_type: t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition ${adForm.ad_type === t ? 'bg-[#f0b90b]/15 border-[#f0b90b]/50 text-[#f0b90b]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/30'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Link URL (optional)</label>
                <div className="relative">
                  <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
                  <input value={adForm.link_url} onChange={e => setAdForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." className={`${inp} pl-8`} />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Ad Image (optional)</label>
                <div className="border border-dashed border-[#2b3139] rounded-xl p-4 text-center hover:border-[#f0b90b]/40 transition cursor-pointer"
                  onClick={() => document.getElementById('ad-img-upload')?.click()}>
                  <input id="ad-img-upload" type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 5 * 1024 * 1024) { toast.error('File too large — max 5MB'); return }
                      setAdImageName(file.name)
                      const reader = new FileReader()
                      reader.onload = ev => setAdForm(f => ({ ...f, image_base64: ev.target?.result as string }))
                      reader.readAsDataURL(file)
                    }}
                  />
                  {adForm.image_base64 ? (
                    <div className="space-y-2">
                      <img src={adForm.image_base64} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                      <p className="text-[10px] text-[#0ecb81]">{adImageName}</p>
                      <button type="button" onClick={e => { e.stopPropagation(); setAdForm(f => ({ ...f, image_base64: '' })); setAdImageName('') }}
                        className="text-[10px] text-[#f6465d] hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div>
                      <Image size={20} className="mx-auto text-[#4a5568] mb-1" />
                      <p className="text-xs text-[#848e9c]">Click to upload ad image</p>
                      <p className="text-[10px] text-[#4a5568] mt-0.5">PNG, JPG (max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#848e9c]">Active immediately</label>
                <button type="button"
                  onClick={() => setAdForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative flex-shrink-0 w-10 h-5 rounded-full overflow-hidden transition-colors duration-200 ${adForm.is_active ? 'bg-[#0ecb81]' : 'bg-[#2b3139]'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${adForm.is_active ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </button>
                <span className={`text-xs font-medium ${adForm.is_active ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                  {adForm.is_active ? 'On' : 'Off'}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!adForm.title.trim()) return toast.error('Title is required')
                  setAdLoading(true)
                  try {
                    await adminCreateAd({ title: adForm.title, description: adForm.description || undefined, ad_type: adForm.ad_type, image_base64: adForm.image_base64 || undefined, link_url: adForm.link_url || undefined, is_active: adForm.is_active })
                    toast.success('Ad created!')
                    setAdForm({ title: '', description: '', ad_type: 'banner', image_base64: '', link_url: '', is_active: true }); setAdImageName('')
                    const res = await adminGetAds(); setAds(Array.isArray(res.data) ? res.data : [])
                  } catch { toast.error('Failed to create ad') }
                  finally { setAdLoading(false) }
                }}
                disabled={adLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-xl text-xs font-semibold transition disabled:opacity-60">
                <Plus size={12} /> {adLoading ? 'Creating...' : 'Create Ad'}
              </button>
            </div>
          </div>

          {/* Existing ads list */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2b3139]">
              <h2 className="text-sm font-semibold text-[#eaecef]">All Ads ({ads.length})</h2>
            </div>
            {ads.length === 0 ? (
              <div className="py-12 text-center text-[#848e9c] text-sm">No ads yet — create one above</div>
            ) : (
              <div className="divide-y divide-[#2b3139]/50">
                {ads.map(ad => (
                  <div key={ad.id} className="p-4 hover:bg-[#1e2329] transition">
                    {/* Ad row — thumbnail + info + action buttons all on one row */}
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      {ad.image_base64 ? (
                        <img src={ad.image_base64} alt={ad.title} className="w-16 h-12 rounded-lg object-cover flex-shrink-0 border border-[#2b3139]" />
                      ) : (
                        <div className="w-16 h-12 rounded-lg bg-[#0b0e11] border border-[#2b3139] flex items-center justify-center flex-shrink-0">
                          <Image size={14} className="text-[#4a5568]" />
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#eaecef] truncate">{ad.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] capitalize border border-[#f0b90b]/20">{ad.ad_type || 'banner'}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ad.is_active ? 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                                {ad.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          {/* Action buttons — always in a clean row on the right */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Edit */}
                            <button
                              onClick={() => { setEditingAd(editingAd?.id === ad.id ? null : ad); setEditingAdForm({ title: ad.title, description: ad.description || '', link_url: ad.link_url || '', ad_type: ad.ad_type || 'banner', image_base64: '' }) }}
                              className={`p-1.5 rounded-lg transition ${editingAd?.id === ad.id ? 'bg-[#f0b90b]/20 text-[#f0b90b]' : 'text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#f0b90b]/10'}`}
                              title="Edit"
                            ><Edit3 size={13} /></button>
                            {/* Toggle active */}
                            <button
                              onClick={async () => {
                                try {
                                  await adminToggleAd(ad.id)
                                  setAds(as => as.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a))
                                  toast.success(ad.is_active ? 'Ad deactivated' : 'Ad activated')
                                } catch { toast.error('Failed to toggle') }
                              }}
                              className="p-1.5 rounded-lg transition text-[#848e9c] hover:text-[#0ecb81] hover:bg-[#0ecb81]/10"
                              title={ad.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {ad.is_active ? <ToggleRight size={16} className="text-[#0ecb81]" /> : <ToggleLeft size={16} />}
                            </button>
                            {/* Delete */}
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this ad?')) return
                                try {
                                  await adminDeleteAd(ad.id)
                                  setAds(as => as.filter(a => a.id !== ad.id))
                                  if (editingAd?.id === ad.id) setEditingAd(null)
                                  toast.success('Ad deleted')
                                } catch { toast.error('Failed to delete') }
                              }}
                              className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition"
                              title="Delete"
                            ><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {ad.description && <p className="text-[11px] text-[#848e9c] mt-1 line-clamp-1">{ad.description}</p>}
                        {ad.link_url && (
                          <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#f0b90b] hover:underline flex items-center gap-0.5 mt-0.5">
                            <ExternalLink size={9} /> {ad.link_url.slice(0, 45)}{ad.link_url.length > 45 ? '…' : ''}
                          </a>
                        )}
                        <p className="text-[10px] text-[#4a5568] mt-0.5">{new Date(ad.created_at).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Inline edit form — shown when this ad is being edited */}
                    {editingAd?.id === ad.id && (
                      <div className="mt-3 pt-3 border-t border-[#2b3139] space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#848e9c] mb-1 block">Title</label>
                            <input value={editingAdForm.title} onChange={e => setEditingAdForm((f: any) => ({ ...f, title: e.target.value }))}
                              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-xs text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#848e9c] mb-1 block">Type</label>
                            <select value={editingAdForm.ad_type} onChange={e => setEditingAdForm((f: any) => ({ ...f, ad_type: e.target.value }))}
                              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-xs text-[#eaecef] focus:outline-none focus:border-[#f0b90b]">
                              {['banner','popup','sidebar','notification','ticker','more-banner'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#848e9c] mb-1 block">Description</label>
                          <textarea value={editingAdForm.description} onChange={e => setEditingAdForm((f: any) => ({ ...f, description: e.target.value }))}
                            rows={2} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-xs text-[#eaecef] focus:outline-none focus:border-[#f0b90b] resize-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#848e9c] mb-1 block">Link URL</label>
                          <input value={editingAdForm.link_url} onChange={e => setEditingAdForm((f: any) => ({ ...f, link_url: e.target.value }))}
                            placeholder="https://..." className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-xs text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#848e9c] mb-1 block">Image (click to replace)</label>
                          <div className="border border-dashed border-[#2b3139] rounded-xl p-3 text-center hover:border-[#f0b90b]/40 transition cursor-pointer"
                            onClick={() => document.getElementById(`ad-edit-img-${ad.id}`)?.click()}>
                            <input id={`ad-edit-img-${ad.id}`} type="file" accept="image/*" className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return }
                                const reader = new FileReader()
                                reader.onload = ev => setEditingAdForm((f: any) => ({ ...f, image_base64: ev.target?.result as string }))
                                reader.readAsDataURL(file)
                              }}
                            />
                            {editingAdForm.image_base64 ? (
                              <img src={editingAdForm.image_base64} alt="preview" className="max-h-24 mx-auto rounded-lg object-contain" />
                            ) : ad.image_base64 ? (
                              <img src={ad.image_base64} alt="current" className="max-h-24 mx-auto rounded-lg object-contain opacity-50" />
                            ) : (
                              <p className="text-[10px] text-[#848e9c]">Click to upload image (PNG, JPG max 5MB)</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={async () => {
                              if (!editingAdForm.title?.trim()) { toast.error('Title required'); return }
                              setAdLoading(true)
                              try {
                                await adminUpdateAd(ad.id, {
                                  title: editingAdForm.title,
                                  description: editingAdForm.description || undefined,
                                  ad_type: editingAdForm.ad_type,
                                  link_url: editingAdForm.link_url || undefined,
                                  ...(editingAdForm.image_base64 ? { image_base64: editingAdForm.image_base64 } : {}),
                                })
                                toast.success('Ad updated!')
                                const res = await adminGetAds(); setAds(Array.isArray(res.data) ? res.data : [])
                                setEditingAd(null)
                              } catch { toast.error('Failed to update ad') }
                              finally { setAdLoading(false) }
                            }}
                            disabled={adLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg text-xs font-semibold transition disabled:opacity-60">
                            <Save size={11} /> {adLoading ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingAd(null)}
                            className="px-3 py-1.5 border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] rounded-lg text-xs transition">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              {notifTarget === 'user' && (
                <div className="relative">
                  <select value={notifUserId} onChange={e => setNotifUserId(e.target.value)} required className={sel}>
                    <option value="">Select user...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                </div>
              )}
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

      {/* REFERRALS */}
      {tab === 'referrals' && (() => {
        const filtered = referrals.filter(r =>
          !refSearch ||
          r.email?.toLowerCase().includes(refSearch.toLowerCase()) ||
          r.referral_code?.toLowerCase().includes(refSearch.toLowerCase()) ||
          r.username?.toLowerCase().includes(refSearch.toLowerCase())
        )
        const totalReferrals = referrals.reduce((s: number, r: any) => s + (r.referred_count || 0), 0)
        const topReferrer = [...referrals].sort((a, b) => b.referred_count - a.referred_count)[0]
        return (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Users with Codes', value: referrals.length, color: 'text-[#627eea]' },
                { label: 'Total Referrals Made', value: totalReferrals, color: 'text-[#0ecb81]' },
                { label: 'Top Referrer', value: topReferrer ? `${topReferrer.referral_code} (${topReferrer.referred_count})` : '—', color: 'text-[#f0b90b]' },
              ].map(s => (
                <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
                  <p className="text-xs text-[#848e9c] mb-1">{s.label}</p>
                  <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2b3139] flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Share2 size={14} className="text-[#f0b90b]" />
                  <h2 className="text-sm font-semibold text-[#eaecef]">All Referral Codes</h2>
                </div>
                <input
                  value={refSearch}
                  onChange={e => setRefSearch(e.target.value)}
                  placeholder="Search email, code, username…"
                  className="bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-1.5 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition w-56"
                />
                <button
                  onClick={async () => { const r = await getAdminReferrals().catch(() => null); if (r) setReferrals(Array.isArray(r.data) ? r.data : []) }}
                  className="flex items-center gap-1 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[750px]">
                  <thead>
                    <tr className="text-[#848e9c] border-b border-[#2b3139] bg-[#0b0e11]">
                      <th className="text-left px-4 py-3 font-medium">#</th>
                      <th className="text-left px-4 py-3 font-medium">User</th>
                      <th className="text-left px-4 py-3 font-medium">Tier</th>
                      <th className="text-left px-4 py-3 font-medium">Referral Code</th>
                      <th className="text-right px-4 py-3 font-medium">Referred</th>
                      <th className="text-left px-4 py-3 font-medium">Link</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-[#848e9c]">No referral codes found</td></tr>
                    ) : filtered.map((r: any) => (
                      <tr key={r.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                        <td className="px-4 py-3 font-mono text-[#848e9c]">#{r.id}</td>
                        <td className="px-4 py-3">
                          <p className="text-[#eaecef] truncate max-w-[160px]">{r.email}</p>
                          {r.username && <p className="text-[10px] text-[#848e9c]">@{r.username}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.account_tier === 3 ? 'bg-[#a855f7]/10 text-[#a855f7]' :
                            r.account_tier === 2 ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                            r.account_tier === 1 ? 'bg-[#f0b90b]/10 text-[#f0b90b]' :
                            'bg-[#2b3139] text-[#848e9c]'
                          }`}>T{r.account_tier}</span>
                        </td>
                        <td className="px-4 py-3">
                          {editingRef === r.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editingRefCode}
                                onChange={e => setEditingRefCode(e.target.value.toUpperCase())}
                                className="bg-[#0b0e11] border border-[#f0b90b] rounded px-2 py-1 text-xs font-mono text-[#f0b90b] w-28 focus:outline-none"
                                maxLength={20}
                                autoFocus
                              />
                              <button
                                disabled={refLoading}
                                onClick={async () => {
                                  setRefLoading(true)
                                  try {
                                    const res = await adminUpdateReferralCode(r.id, editingRefCode)
                                    setReferrals(rs => rs.map(x => x.id === r.id ? { ...x, referral_code: res.data.referral_code, referral_link: res.data.referral_link, referred_count: res.data.referred_count } : x))
                                    toast.success('Code updated')
                                    setEditingRef(null)
                                  } catch (e: any) {
                                    toast.error(e?.response?.data?.detail || 'Failed to update code')
                                  } finally { setRefLoading(false) }
                                }}
                                className="text-[#0ecb81] hover:text-[#0ecb81]/80 p-1 rounded transition">
                                <CheckCircle size={13} />
                              </button>
                              <button onClick={() => setEditingRef(null)}
                                className="text-[#848e9c] hover:text-[#f6465d] p-1 rounded transition">
                                <XCircle size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-[#f0b90b] tracking-wider">{r.referral_code}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono font-bold ${r.referred_count > 0 ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                            {r.referred_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          {r.referral_link ? (
                            <div className="flex items-center gap-1.5 group">
                              <span className="text-[#4a5568] truncate font-mono text-[10px] max-w-[130px]">{r.referral_link}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(r.referral_link)
                                  setCopiedRefId(r.id)
                                  setTimeout(() => setCopiedRefId(null), 2000)
                                }}
                                className="text-[#848e9c] hover:text-[#f0b90b] transition flex-shrink-0"
                                title="Copy link">
                                {copiedRefId === r.id ? <CheckCircle size={11} className="text-[#0ecb81]" /> : <Copy size={11} />}
                              </button>
                            </div>
                          ) : <span className="text-[#4a5568]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              title="Edit code"
                              onClick={() => { setEditingRef(r.id); setEditingRefCode(r.referral_code || '') }}
                              className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#f0b90b]/10 transition">
                              <Edit3 size={12} />
                            </button>
                            <button
                              title="Reset to random code"
                              onClick={async () => {
                                if (!confirm(`Reset referral code for ${r.email}? Their current code will be replaced.`)) return
                                setRefLoading(true)
                                try {
                                  const res = await adminResetReferralCode(r.id)
                                  setReferrals(rs => rs.map(x => x.id === r.id ? { ...x, referral_code: res.data.referral_code, referral_link: res.data.referral_link } : x))
                                  toast.success('Code regenerated')
                                } catch { toast.error('Failed to reset') } finally { setRefLoading(false) }
                              }}
                              className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#627eea] hover:bg-[#627eea]/10 transition">
                              <RotateCcw size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* BONUSES */}
      {tab === 'bonuses' && (
        <div className="space-y-5">
          {/* Grant Bonus Form */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b3139] flex items-center gap-2">
              <Gift size={14} className="text-[#f0b90b]" />
              <h2 className="text-sm font-semibold text-[#eaecef]">Create Bonus / Token</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Title</label>
                  <input value={bonusForm.title} onChange={e => setBonusForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Tier 3 Welcome Bonus"
                    className={inp} />
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Bonus Type</label>
                  <div className="relative">
                    <select value={bonusForm.bonus_type} onChange={e => setBonusForm(f => ({ ...f, bonus_type: e.target.value }))}
                      className={sel}>
                      <option value="manual_grant">Manual Grant (credit now)</option>
                      <option value="tier_achievement">Tier Achievement (auto on tier up)</option>
                      <option value="referral_signup">Referral Signup (auto on referral)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Amount (USDT)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#848e9c]">$</span>
                    <input type="number" min={0.01} step={0.01} value={bonusForm.amount_usdt}
                      onChange={e => setBonusForm(f => ({ ...f, amount_usdt: Number(e.target.value) }))}
                      className={inp + ' pl-6'} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Target Recipients</label>
                  <div className="relative">
                    <select value={bonusForm.target} onChange={e => setBonusForm(f => ({ ...f, target: e.target.value }))}
                      className={sel}>
                      <option value="all">All Users</option>
                      <option value="new_users">New Users (last 30 days)</option>
                      <option value="specific">Specific User</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                  </div>
                </div>
                {bonusForm.target === 'specific' && (
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">User Email</label>
                    <input value={bonusForm.target_user_email}
                      onChange={e => setBonusForm(f => ({ ...f, target_user_email: e.target.value }))}
                      placeholder="user@example.com"
                      className={inp} />
                  </div>
                )}
                {bonusForm.bonus_type === 'tier_achievement' && (
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Trigger at Tier</label>
                    <div className="relative">
                      <select value={bonusForm.tier_required}
                        onChange={e => setBonusForm(f => ({ ...f, tier_required: Number(e.target.value) }))}
                        className={sel}>
                        <option value={1}>Tier 1</option>
                        <option value={2}>Tier 2</option>
                        <option value={3}>Tier 3</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Note / Message to User</label>
                  <input value={bonusForm.note}
                    onChange={e => setBonusForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Congratulations on reaching Tier 3!"
                    className={inp} />
                </div>
              </div>
              {bonusForm.bonus_type === 'manual_grant' && (
                <div className="space-y-3 border-t border-[#2b3139] pt-3">
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Task Description (shown to user)</label>
                    <textarea value={bonusForm.task_description}
                      onChange={e => setBonusForm(f => ({ ...f, task_description: e.target.value }))}
                      placeholder="Describe what the user needs to do to earn this bonus..."
                      rows={2} className={`${inp} resize-none`} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                      <input type="checkbox" checked={bonusForm.require_claim}
                        onChange={e => setBonusForm(f => ({ ...f, require_claim: e.target.checked, grant_now: e.target.checked ? false : f.grant_now }))}
                        className="accent-[#f0b90b]" />
                      <span className="text-xs text-[#eaecef] font-medium">Require user to claim (Task mode)</span>
                    </label>
                    <p className="text-[10px] text-[#4a5568] -mt-1 ml-5">User gets a notification + a Claim button. Balance is only credited when they click Claim.</p>
                    {!bonusForm.require_claim && (
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" checked={bonusForm.grant_now}
                          onChange={e => setBonusForm(f => ({ ...f, grant_now: e.target.checked }))}
                          className="accent-[#f0b90b]" />
                        <span className="text-xs text-[#848e9c]">Credit users immediately when created</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
              <button disabled={bonusLoading || !bonusForm.title || !bonusForm.amount_usdt}
                onClick={async () => {
                  setBonusLoading(true)
                  try {
                    const res = await adminGrantBonus({
                      title: bonusForm.title,
                      bonus_type: bonusForm.bonus_type,
                      amount_usdt: bonusForm.amount_usdt,
                      target: bonusForm.target,
                      target_user_email: bonusForm.target === 'specific' ? bonusForm.target_user_email : undefined,
                      tier_required: bonusForm.bonus_type === 'tier_achievement' ? bonusForm.tier_required : undefined,
                      note: bonusForm.note || undefined,
                      task_description: bonusForm.task_description || undefined,
                      require_claim: bonusForm.require_claim,
                      grant_now: bonusForm.grant_now,
                    })
                    const msg = res.data.require_claim
                      ? `Task created — ${res.data.credited} user(s) notified`
                      : `Bonus created — ${res.data.credited} user(s) credited`
                    toast.success(msg)
                    setBonusForm({ title: '', bonus_type: 'manual_grant', amount_usdt: 10, target: 'all', target_user_email: '', tier_required: 3, note: '', task_description: '', require_claim: false, grant_now: true })
                    const r2 = await getAdminBonuses().catch(() => null)
                    if (r2) setBonuses(Array.isArray(r2.data) ? r2.data : [])
                  } catch (e: any) {
                    toast.error(e?.response?.data?.detail || 'Failed to create bonus')
                  } finally { setBonusLoading(false) }
                }}
                className="flex items-center gap-2 px-5 py-2 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-50 text-black rounded-xl text-xs font-bold transition">
                <Gift size={13} /> {bonusLoading ? 'Creating…' : bonusForm.require_claim ? 'Create Task' : 'Create & Grant Bonus'}
              </button>
            </div>
          </div>

          {/* Bonus History */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#eaecef]">Bonus History</h2>
              <button onClick={async () => { const r = await getAdminBonuses().catch(() => null); if (r) setBonuses(Array.isArray(r.data) ? r.data : []) }}
                className="flex items-center gap-1 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            {bonuses.length === 0 ? (
              <div className="py-10 text-center text-[#848e9c] text-sm">No bonuses created yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[700px]">
                  <thead>
                    <tr className="text-[#848e9c] border-b border-[#2b3139] bg-[#0b0e11]">
                      <th className="text-left px-4 py-3 font-medium">#</th>
                      <th className="text-left px-4 py-3 font-medium">Title</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium">Target</th>
                      <th className="text-right px-4 py-3 font-medium">Credited</th>
                      <th className="text-left px-4 py-3 font-medium">Note</th>
                      <th className="text-right px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b: any) => (
                      <tr key={b.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                        <td className="px-4 py-3 font-mono text-[#848e9c]">#{b.id}</td>
                        <td className="px-4 py-3 font-medium text-[#eaecef]">{b.title}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            b.bonus_type === 'manual_grant' ? 'bg-[#627eea]/10 text-[#627eea]' :
                            b.bonus_type === 'tier_achievement' ? 'bg-[#a855f7]/10 text-[#a855f7]' :
                            'bg-[#0ecb81]/10 text-[#0ecb81]'
                          }`}>
                            {b.bonus_type === 'manual_grant' ? 'Manual' : b.bonus_type === 'tier_achievement' ? `Tier ${b.tier_required}` : 'Referral'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#f0b90b] font-bold">${b.amount_usdt?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[#848e9c] capitalize">
                          {b.target === 'specific' ? b.target_user_email || `User #${b.target_user_id}` : b.target?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#eaecef]">{b.granted_count ?? 0}</td>
                        <td className="px-4 py-3 text-[#848e9c] max-w-[150px] truncate">{b.note || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.active ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                            {b.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button title={b.active ? 'Deactivate' : 'Activate'}
                              onClick={async () => { await toggleAdminBonus(b.id); setBonuses(bs => bs.map(x => x.id === b.id ? { ...x, active: !x.active } : x)) }}
                              className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#f0b90b]/10 transition">
                              {b.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            </button>
                            <button title="Delete"
                              onClick={async () => { if (!confirm('Delete this bonus?')) return; await deleteAdminBonus(b.id); setBonuses(bs => bs.filter(x => x.id !== b.id)) }}
                              className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Completion Tracker */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-[#0ecb81]" />
                <h2 className="text-sm font-semibold text-[#eaecef]">Task Completion Tracker</h2>
                <span className="text-[10px] text-[#848e9c]">— claimable bonuses only</span>
              </div>
              <button
                onClick={async () => {
                  setClaimsLoading(true)
                  const r = await adminGetBonusClaims().catch(() => null)
                  if (r) setBonusClaims(Array.isArray(r.data) ? r.data : [])
                  setClaimsLoading(false)
                }}
                className="flex items-center gap-1 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
                <RefreshCw size={11} className={claimsLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            {bonusClaims.length === 0 ? (
              <div className="py-10 text-center text-[#848e9c] text-sm">
                No claimable tasks found — create a bonus with "Require user to claim" enabled
              </div>
            ) : (
              <div className="divide-y divide-[#2b3139]/60">
                {bonusClaims.map((b: any) => (
                  <div key={b.bonus_id} className="px-5 py-3">
                    <button
                      onClick={() => setExpandedBonus(expandedBonus === b.bonus_id ? null : b.bonus_id)}
                      className="w-full flex items-center justify-between text-left group">
                      <div className="flex items-center gap-3">
                        <Gift size={13} className="text-[#f0b90b] shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-[#eaecef]">{b.title}</p>
                          <p className="text-[10px] text-[#848e9c]">${b.amount_usdt?.toFixed(2)} USDT · {b.total_claims} assigned</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex gap-2 text-[10px]">
                          <span className="px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81] font-semibold">
                            ✓ {b.claimed_count} claimed
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-semibold">
                            ⏳ {b.pending_count} pending
                          </span>
                          {b.total_claims - b.claimed_count - b.pending_count > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-[#2b3139] text-[#848e9c] font-semibold">
                              {b.total_claims - b.claimed_count - b.pending_count} unclaimed
                            </span>
                          )}
                        </div>
                        <ChevronDown size={13} className={`text-[#848e9c] transition-transform ${expandedBonus === b.bonus_id ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {expandedBonus === b.bonus_id && (
                      <div className="mt-3 rounded-lg border border-[#2b3139] overflow-hidden">
                        {b.claims.length === 0 ? (
                          <p className="text-xs text-[#848e9c] py-3 px-4">No claims yet</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#0b0e11] text-[#848e9c] border-b border-[#2b3139]">
                                <th className="text-left px-4 py-2 font-medium">User</th>
                                <th className="text-left px-4 py-2 font-medium">Assigned</th>
                                <th className="text-left px-4 py-2 font-medium">Claimed</th>
                                <th className="text-right px-4 py-2 font-medium">Status</th>
                                <th className="text-right px-4 py-2 font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.claims.map((c: any) => (
                                <tr key={c.claim_id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                                  <td className="px-4 py-2">
                                    <p className="font-medium text-[#eaecef]">{c.user_name}</p>
                                    <p className="text-[10px] text-[#848e9c]">{c.user_email}</p>
                                  </td>
                                  <td className="px-4 py-2 text-[#848e9c]">
                                    {c.assigned_at ? new Date(c.assigned_at).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-[#848e9c]">
                                    {c.claimed_at ? new Date(c.claimed_at).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      c.status === 'claimed'
                                        ? 'bg-[#0ecb81]/10 text-[#0ecb81]'
                                        : 'bg-[#f0b90b]/10 text-[#f0b90b]'
                                    }`}>
                                      {c.status === 'claimed' ? '✓ Claimed' : '⏳ Pending'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {c.status === 'pending' ? (
                                      <button
                                        title="Revoke this pending claim"
                                        onClick={async () => {
                                          if (!confirm(`Revoke task for ${c.user_email}?`)) return
                                          try {
                                            await adminRevokeBonusClaim(c.claim_id)
                                            toast.success('Claim revoked')
                                            const r = await adminGetBonusClaims().catch(() => null)
                                            if (r) setBonusClaims(Array.isArray(r.data) ? r.data : [])
                                          } catch { toast.error('Failed to revoke') }
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[#f6465d] border border-[#f6465d]/30 hover:bg-[#f6465d]/10 transition ml-auto">
                                        <XCircle size={10} /> Revoke
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-[#4a5568]">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick presets */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide mb-3">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Tier 3 → $10 AI Bot', type: 'tier_achievement', amount: 10, tier: 3, note: 'Congratulations on reaching Tier 3! Use this $10 to trade with AI bots.' },
                { label: 'Tier 2 → $5 Bonus', type: 'tier_achievement', amount: 5, tier: 2, note: 'Tier 2 achievement reward.' },
                { label: 'Referral → $15', type: 'referral_signup', amount: 15, note: 'Earned when someone signs up using your referral link.' },
                { label: 'Welcome All → $5', type: 'manual_grant', amount: 5, note: 'Welcome bonus for all current users.' },
              ].map(p => (
                <button key={p.label} onClick={() => setBonusForm(f => ({
                  ...f, title: p.label, bonus_type: p.type, amount_usdt: p.amount,
                  tier_required: p.tier ?? 3, note: p.note,
                  target: p.type === 'manual_grant' ? 'all' : p.type === 'referral_signup' ? 'all' : 'all',
                }))}
                  className="px-3 py-1.5 rounded-lg bg-[#f0b90b]/8 border border-[#f0b90b]/20 text-[#f0b90b] text-xs hover:bg-[#f0b90b]/15 transition">
                  {p.label}
                </button>
              ))}
            </div>
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

      {/* PRODUCTS */}
      {tab === 'products' && (
        <div className="space-y-5">
          {productsLoading && <div className="py-8 text-center text-[#848e9c]">Loading products…</div>}

          {/* VPS Plans */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2"><Server size={14} className="text-[#f0b90b]" /> VPS Plans</h2>
              <button onClick={() => setShowAddVps(v => !v)}
                className="flex items-center gap-1.5 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] px-3 py-1.5 rounded-lg transition">
                <Plus size={11} /> Add Plan
              </button>
            </div>

            {showAddVps && (
              <div className="p-4 border-b border-[#2b3139] bg-[#0b0e11] space-y-3">
                <p className="text-xs text-[#848e9c] font-semibold">New VPS Plan</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Provider Name</label>
                    <input value={newVps.name} onChange={e => setNewVps(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. DigitalOcean" className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Price ($/mo)</label>
                    <input type="number" min={0} step={0.01} value={newVps.price}
                      onChange={e => setNewVps(p => ({ ...p, price: Number(e.target.value) }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Specs</label>
                    <input value={newVps.specs} onChange={e => setNewVps(p => ({ ...p, specs: e.target.value }))}
                      placeholder="1 vCPU · 1GB RAM · 25GB SSD" className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Start Date</label>
                    <input type="date" value={newVps.start_date} onChange={e => setNewVps(p => ({ ...p, start_date: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">End Date</label>
                    <input type="date" value={newVps.end_date} onChange={e => setNewVps(p => ({ ...p, end_date: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">ROI %</label>
                    <input type="number" min={0} max={9999} step={0.1} value={newVps.roi_percent}
                      onChange={e => setNewVps(p => ({ ...p, roi_percent: Number(e.target.value) }))}
                      placeholder="e.g. 12.5" className={inp} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs text-[#848e9c] mb-1 block">Description Note</label>
                    <input value={newVps.description} onChange={e => setNewVps(p => ({ ...p, description: e.target.value }))}
                      placeholder="Short note shown to users below the plan" className={inp} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!newVps.name.trim()) return toast.error('Name required')
                    const updated = [...vpsPlans, { ...newVps, id: Date.now() }]
                    setVpsPlans(updated)
                    await adminSaveVpsPlans(updated)
                    setNewVps({ name: '', price: 0, specs: '', start_date: '', end_date: '', roi_percent: 0, description: '' })
                    setShowAddVps(false)
                    toast.success('VPS plan added!')
                  }} className="px-4 py-1.5 bg-[#f0b90b] text-black rounded-lg text-xs font-bold">Save</button>
                  <button onClick={() => setShowAddVps(false)} className="px-4 py-1.5 border border-[#2b3139] text-[#848e9c] rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-[#2b3139]/50">
              {vpsPlans.length === 0 && <p className="px-5 py-6 text-xs text-[#848e9c]">No VPS plans. Add one above.</p>}
              {vpsPlans.map(plan => (
                <div key={plan.id} className="px-5 py-3">
                  {editingVps?.id === plan.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input value={editingVps.name} onChange={e => setEditingVps(p => p ? { ...p, name: e.target.value } : p)}
                        className={inp} placeholder="Name" />
                      <input type="number" value={editingVps.price}
                        onChange={e => setEditingVps(p => p ? { ...p, price: Number(e.target.value) } : p)}
                        className={inp} />
                      <input value={editingVps.specs} onChange={e => setEditingVps(p => p ? { ...p, specs: e.target.value } : p)}
                        className={inp} placeholder="Specs" />
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1 block">Start Date</label>
                        <input type="date" value={editingVps.start_date || ''} onChange={e => setEditingVps(p => p ? { ...p, start_date: e.target.value } : p)} className={inp} />
                      </div>
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1 block">End Date</label>
                        <input type="date" value={editingVps.end_date || ''} onChange={e => setEditingVps(p => p ? { ...p, end_date: e.target.value } : p)} className={inp} />
                      </div>
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1 block">ROI %</label>
                        <input type="number" min={0} step={0.1} value={editingVps.roi_percent || 0} onChange={e => setEditingVps(p => p ? { ...p, roi_percent: Number(e.target.value) } : p)} className={inp} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs text-[#848e9c] mb-1 block">Description Note</label>
                        <input value={editingVps.description || ''} onChange={e => setEditingVps(p => p ? { ...p, description: e.target.value } : p)} className={inp} placeholder="Short note" />
                      </div>
                      <div className="flex gap-2 sm:col-span-3">
                        <button onClick={async () => {
                          const updated = vpsPlans.map(p => p.id === editingVps.id ? editingVps : p)
                          setVpsPlans(updated)
                          await adminSaveVpsPlans(updated)
                          setEditingVps(null)
                          toast.success('VPS plan updated!')
                        }} className="px-4 py-1.5 bg-[#0ecb81] text-black rounded-lg text-xs font-bold">Save</button>
                        <button onClick={() => setEditingVps(null)} className="px-4 py-1.5 border border-[#2b3139] text-[#848e9c] rounded-lg text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#eaecef]">{plan.name}</p>
                        <p className="text-xs text-[#848e9c]">{plan.specs}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-base font-bold text-[#f0b90b] font-mono">${plan.price}<span className="text-xs text-[#848e9c]">/mo</span></span>
                        <button onClick={() => setEditingVps(plan)}
                          className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#f0b90b]/10 transition">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${plan.name}"?`)) return
                          const updated = vpsPlans.filter(p => p.id !== plan.id)
                          setVpsPlans(updated)
                          await adminSaveVpsPlans(updated)
                          toast.success('Plan deleted')
                        }} className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Asset Products */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2"><ShoppingBag size={14} className="text-[#627eea]" /> Asset Products (Buy Asset)</h2>
              <button onClick={() => setShowAddAsset(v => !v)}
                className="flex items-center gap-1.5 text-xs bg-[#627eea]/10 hover:bg-[#627eea]/20 text-[#627eea] px-3 py-1.5 rounded-lg transition">
                <Plus size={11} /> Add Asset
              </button>
            </div>

            {showAddAsset && (
              <div className="p-4 border-b border-[#2b3139] bg-[#0b0e11] space-y-3">
                <p className="text-xs text-[#848e9c] font-semibold">New Asset Product</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Asset Name</label>
                    <input value={newAsset.name} onChange={e => setNewAsset(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Bitcoin (BTC)" className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Price ($ per unit)</label>
                    <input type="number" min={0} step={0.01} value={newAsset.price}
                      onChange={e => setNewAsset(p => ({ ...p, price: Number(e.target.value) }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Icon symbol</label>
                    <input value={newAsset.icon} onChange={e => setNewAsset(p => ({ ...p, icon: e.target.value }))}
                      placeholder="₿" maxLength={4} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">Start Date</label>
                    <input type="date" value={newAsset.start_date} onChange={e => setNewAsset(p => ({ ...p, start_date: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">End Date</label>
                    <input type="date" value={newAsset.end_date} onChange={e => setNewAsset(p => ({ ...p, end_date: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1 block">ROI %</label>
                    <input type="number" min={0} step={0.1} value={newAsset.roi_percent}
                      onChange={e => setNewAsset(p => ({ ...p, roi_percent: Number(e.target.value) }))}
                      placeholder="e.g. 8.5" className={inp} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs text-[#848e9c] mb-1 block">Description Note</label>
                    <input value={newAsset.description} onChange={e => setNewAsset(p => ({ ...p, description: e.target.value }))}
                      placeholder="Short note shown to users" className={inp} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!newAsset.name.trim()) return toast.error('Name required')
                    const updated = [...assetProducts, { ...newAsset, id: Date.now() }]
                    setAssetProducts(updated)
                    await adminSaveAssetProducts(updated)
                    setNewAsset({ name: '', price: 0, icon: '₿', start_date: '', end_date: '', roi_percent: 0, description: '' })
                    setShowAddAsset(false)
                    toast.success('Asset product added!')
                  }} className="px-4 py-1.5 bg-[#627eea] text-white rounded-lg text-xs font-bold">Save</button>
                  <button onClick={() => setShowAddAsset(false)} className="px-4 py-1.5 border border-[#2b3139] text-[#848e9c] rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-[#2b3139]/50">
              {assetProducts.length === 0 && <p className="px-5 py-6 text-xs text-[#848e9c]">No asset products. Add one above.</p>}
              {assetProducts.map(asset => (
                <div key={asset.id} className="px-5 py-3">
                  {editingAsset?.id === asset.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input value={editingAsset.name} onChange={e => setEditingAsset(p => p ? { ...p, name: e.target.value } : p)}
                        className={inp} placeholder="Name" />
                      <input type="number" value={editingAsset.price}
                        onChange={e => setEditingAsset(p => p ? { ...p, price: Number(e.target.value) } : p)}
                        className={inp} />
                      <input value={editingAsset.icon} onChange={e => setEditingAsset(p => p ? { ...p, icon: e.target.value } : p)}
                        className={inp} placeholder="Icon" maxLength={4} />
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1 block">Start Date</label>
                        <input type="date" value={editingAsset.start_date || ''} onChange={e => setEditingAsset(p => p ? { ...p, start_date: e.target.value } : p)} className={inp} />
                      </div>
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1 block">End Date</label>
                        <input type="date" value={editingAsset.end_date || ''} onChange={e => setEditingAsset(p => p ? { ...p, end_date: e.target.value } : p)} className={inp} />
                      </div>
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1 block">ROI %</label>
                        <input type="number" min={0} step={0.1} value={editingAsset.roi_percent || 0} onChange={e => setEditingAsset(p => p ? { ...p, roi_percent: Number(e.target.value) } : p)} className={inp} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs text-[#848e9c] mb-1 block">Description Note</label>
                        <input value={editingAsset.description || ''} onChange={e => setEditingAsset(p => p ? { ...p, description: e.target.value } : p)} className={inp} placeholder="Short note" />
                      </div>
                      <div className="flex gap-2 sm:col-span-3">
                        <button onClick={async () => {
                          const updated = assetProducts.map(a => a.id === editingAsset.id ? editingAsset : a)
                          setAssetProducts(updated)
                          await adminSaveAssetProducts(updated)
                          setEditingAsset(null)
                          toast.success('Asset updated!')
                        }} className="px-4 py-1.5 bg-[#0ecb81] text-black rounded-lg text-xs font-bold">Save</button>
                        <button onClick={() => setEditingAsset(null)} className="px-4 py-1.5 border border-[#2b3139] text-[#848e9c] rounded-lg text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#627eea]/10 flex items-center justify-center text-[#627eea] font-bold text-sm">{asset.icon}</div>
                        <div>
                          <p className="text-sm font-medium text-[#eaecef]">{asset.name}</p>
                          <p className="text-xs text-[#848e9c]">${Number(asset.price).toLocaleString()} / unit</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setEditingAsset(asset)}
                          className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#627eea] hover:bg-[#627eea]/10 transition">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${asset.name}"?`)) return
                          const updated = assetProducts.filter(a => a.id !== asset.id)
                          setAssetProducts(updated)
                          await adminSaveAssetProducts(updated)
                          toast.success('Asset deleted')
                        }} className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Pricing */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b3139]">
              <h2 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2"><DollarSign size={14} className="text-[#0ecb81]" /> Subscription Pricing Plans</h2>
              <p className="text-xs text-[#848e9c] mt-0.5">Edit the displayed prices shown on the pricing/landing pages</p>
            </div>
            <div className="p-5 space-y-4">
              {(pricingPlans.length === 0 ? [
                { name: 'Free',    price: 0,   period: 'forever' },
                { name: 'Pro',     price: 49,  period: 'month'   },
                { name: 'Elite',   price: 99,  period: 'month'   },
                { name: 'Elite+',  price: 199, period: 'month'   },
              ] : pricingPlans).map((plan, idx) => (
                <div key={plan.name} className="flex items-center gap-4">
                  <div className="w-20 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      plan.name === 'Free'   ? 'bg-[#2b3139] text-[#848e9c]' :
                      plan.name === 'Pro'    ? 'bg-[#627eea]/10 text-[#627eea]' :
                      plan.name === 'Elite'  ? 'bg-[#f0b90b]/10 text-[#f0b90b]' :
                      'bg-[#0ecb81]/10 text-[#0ecb81]'
                    }`}>{plan.name}</span>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c] text-xs">$</span>
                      <input type="number" min={0} step={0.01}
                        value={plan.price}
                        onChange={e => {
                          const updated = (pricingPlans.length === 0 ? [
                            { name: 'Free', price: 0, period: 'forever' },
                            { name: 'Pro', price: 49, period: 'month' },
                            { name: 'Elite', price: 99, period: 'month' },
                            { name: 'Elite+', price: 199, period: 'month' },
                          ] : [...pricingPlans])
                          updated[idx] = { ...updated[idx], price: Number(e.target.value) }
                          setPricingPlans(updated)
                        }}
                        className={`${inp} pl-6`}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-[#848e9c] w-16 flex-shrink-0">/ {plan.period}</span>
                </div>
              ))}
              <button onClick={async () => {
                const plans = pricingPlans.length === 0 ? [
                  { name: 'Free', price: 0, period: 'forever' },
                  { name: 'Pro', price: 49, period: 'month' },
                  { name: 'Elite', price: 99, period: 'month' },
                  { name: 'Elite+', price: 199, period: 'month' },
                ] : pricingPlans
                await adminSavePricingPlans(plans)
                toast.success('Pricing plans saved!')
              }} className="flex items-center gap-2 px-4 py-2.5 bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 border border-[#0ecb81]/30 text-[#0ecb81] rounded-xl text-xs font-semibold transition">
                <Save size={12} /> Save Pricing Plans
              </button>
            </div>
          </div>
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

      {/* TESTIMONIALS MANAGEMENT */}
      {tab === 'testimonials' && (
        <div className="space-y-4">
          {/* Create / Edit form */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4 flex items-center gap-2">
              <Plus size={14} className="text-[#f0b90b]" />
              {editingTestimonial ? 'Edit Review' : 'Add New Review'}
            </h2>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Name *</label>
                  <input value={testimonialForm.name}
                    onChange={e => setTestimonialForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Sarah M." className={inp} />
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Role / Location</label>
                  <input value={testimonialForm.role}
                    onChange={e => setTestimonialForm(f => ({ ...f, role: e.target.value }))}
                    placeholder="e.g. Day Trader · London" className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Review Content *</label>
                <textarea rows={3} value={testimonialForm.content}
                  onChange={e => setTestimonialForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write the testimonial content..." className={`${inp} resize-none`} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Rating (1–5 stars)</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={() => setTestimonialForm(f => ({ ...f, rating: s }))}>
                        <Star size={20} className={s <= testimonialForm.rating ? 'text-[#f0b90b] fill-[#f0b90b]' : 'text-[#2b3139]'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Avatar Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#f0b90b','#627eea','#0ecb81','#f6465d','#a78bfa','#06b6d4'].map(c => (
                      <button key={c} type="button" onClick={() => setTestimonialForm(f => ({ ...f, avatar_color: c }))}
                        className={`w-7 h-7 rounded-full transition ${testimonialForm.avatar_color === c ? 'ring-2 ring-[#eaecef] ring-offset-1 ring-offset-[#0b0e11]' : ''}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    if (!testimonialForm.name.trim() || !testimonialForm.content.trim()) return toast.error('Name and content required')
                    setTestimonialLoading(true)
                    try {
                      const data = {
                        name: testimonialForm.name,
                        role: testimonialForm.role || undefined,
                        content: testimonialForm.content,
                        rating: testimonialForm.rating,
                        avatar_color: testimonialForm.avatar_color,
                        avatar_initials: testimonialForm.name.slice(0,2).toUpperCase(),
                      }
                      if (editingTestimonial) {
                        await adminUpdateTestimonial(editingTestimonial.id, data)
                        toast.success('Review updated')
                        setTestimonials(ts => ts.map(t => t.id === editingTestimonial.id ? { ...t, ...data } : t))
                        setEditingTestimonial(null)
                      } else {
                        const res = await adminCreateTestimonial(data)
                        toast.success('Review added')
                        setTestimonials(ts => [...ts, { ...data, id: res.data.id, is_active: true }])
                      }
                      setTestimonialForm({ name: '', role: '', content: '', rating: 5, avatar_color: '#f0b90b' })
                    } catch { toast.error('Failed to save review') }
                    finally { setTestimonialLoading(false) }
                  }}
                  className="flex items-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-bold text-xs px-4 py-2 rounded-xl transition">
                  {testimonialLoading ? 'Saving…' : editingTestimonial ? 'Save Changes' : 'Add Review'}
                </button>
                {editingTestimonial && (
                  <button onClick={() => { setEditingTestimonial(null); setTestimonialForm({ name: '', role: '', content: '', rating: 5, avatar_color: '#f0b90b' }) }}
                    className="text-xs border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] px-4 py-2 rounded-xl transition">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reviews list */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#eaecef] mb-4">All Reviews ({testimonials.length})</h2>
            {testimonials.length === 0 ? (
              <p className="text-sm text-[#848e9c] text-center py-6">No reviews yet. Add the first one above.</p>
            ) : (
              <div className="space-y-3">
                {testimonials.map(t => (
                  <div key={t.id} className={`border rounded-xl p-4 ${t.is_active ? 'border-[#2b3139]' : 'border-[#2b3139] opacity-50'}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0"
                        style={{ background: t.avatar_color || '#f0b90b' }}>
                        {(t.avatar_initials || t.name?.slice(0,2) || '??').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-[#eaecef]">{t.name}</span>
                          {t.role && <span className="text-xs text-[#848e9c]">{t.role}</span>}
                          <div className="flex gap-0.5 ml-auto">
                            {[1,2,3,4,5].map(s => <Star key={s} size={10} className={s <= t.rating ? 'text-[#f0b90b] fill-[#f0b90b]' : 'text-[#2b3139]'} />)}
                          </div>
                        </div>
                        <p className="text-xs text-[#848e9c] leading-relaxed">{t.content}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button title="Edit" onClick={() => { setEditingTestimonial(t); setTestimonialForm({ name: t.name, role: t.role || '', content: t.content, rating: t.rating, avatar_color: t.avatar_color || '#f0b90b' }) }}
                          className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#2b3139] transition">
                          <Edit3 size={12} />
                        </button>
                        <button title={t.is_active ? 'Deactivate' : 'Activate'} onClick={async () => {
                          await adminToggleTestimonial(t.id).catch(() => null)
                          setTestimonials(ts => ts.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
                        }} className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f0b90b] hover:bg-[#2b3139] transition">
                          {t.is_active ? <ToggleRight size={12} className="text-[#0ecb81]" /> : <ToggleLeft size={12} />}
                        </button>
                        <button title="Delete" onClick={async () => {
                          if (!confirm('Delete this review?')) return
                          await adminDeleteTestimonial(t.id).catch(() => null)
                          setTestimonials(ts => ts.filter(x => x.id !== t.id))
                          toast.success('Review deleted')
                        }} className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#2b3139] transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVITY LOG */}
      {tab === 'activity' && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2">
                <Clock size={14} className="text-[#f0b90b]" /> User Activity Log
              </h2>
              <p className="text-xs text-[#848e9c] mt-0.5">
                {activityLogs.length} entries — login events, IPs, and actions. Alerts sent to admin Telegram on every login.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={async () => {
                  setActivityLoading(true)
                  try {
                    const res = await adminGetUserActivity()
                    setActivityLogs(Array.isArray(res.data) ? res.data : [])
                  } catch { /* ignore */ } finally { setActivityLoading(false) }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139] rounded-xl transition"
              >
                <RefreshCw size={12} className={activityLoading ? 'animate-spin' : ''} /> Refresh
              </button>
              {activityLogs.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const headers = ['ID', 'User Email', 'User ID', 'Action', 'IP Address', 'Device / User-Agent', 'Details', 'Timestamp (UTC)']
                      const rows = activityLogs.map(l => [
                        l.id,
                        l.user_email ?? '',
                        l.user_id,
                        l.action,
                        l.ip_address ?? '',
                        (l.user_agent ?? '').replace(/"/g, "'"),
                        (l.details ?? '').replace(/"/g, "'"),
                        l.created_at ?? '',
                      ])
                      const csv = [headers, ...rows]
                        .map(r => r.map(v => `"${v}"`).join(','))
                        .join('\n')
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `finai-activity-log-${new Date().toISOString().slice(0, 10)}.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#0ecb81] hover:text-white hover:bg-[#0ecb81] border border-[#0ecb81]/30 hover:border-[#0ecb81] rounded-xl transition font-medium"
                  >
                    <Download size={12} /> Export CSV
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Clear all ${activityLogs.length} activity log entries? This cannot be undone.`)) return
                      try {
                        await adminClearUserActivity()
                        setActivityLogs([])
                        toast.success('Activity log cleared')
                      } catch { toast.error('Failed to clear activity log') }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#f6465d] hover:text-white hover:bg-[#f6465d] border border-[#f6465d]/30 hover:border-[#f6465d] rounded-xl transition font-medium"
                  >
                    <Trash2 size={12} /> Clear All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Telegram notice */}
          <div className="flex items-start gap-2.5 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-4 py-3">
            <Monitor size={14} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#848e9c] leading-relaxed">
              Every login event is automatically sent to admin Telegram (if <span className="text-[#eaecef] font-mono">TELEGRAM_BOT_TOKEN</span> is set). Set <span className="text-[#eaecef] font-mono">TELEGRAM_ADMIN_CHAT_ID</span> in Replit Secrets to receive alerts.
            </p>
          </div>

          {/* Table */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            {activityLoading ? (
              <div className="py-12 text-center text-[#848e9c] text-sm animate-pulse">Loading activity log…</div>
            ) : activityLogs.length === 0 ? (
              <div className="py-12 text-center text-[#848e9c] text-sm">No activity logged yet — logins will appear here automatically.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                      <th className="text-left px-4 py-3 font-medium">User</th>
                      <th className="text-left px-4 py-3 font-medium">Action</th>
                      <th className="text-left px-4 py-3 font-medium">IP Address</th>
                      <th className="text-left px-4 py-3 font-medium">Device / UA</th>
                      <th className="text-right px-4 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map(log => (
                      <tr key={log.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-[#eaecef] truncate max-w-[160px]">{log.user_email || `#${log.user_id}`}</p>
                          {log.details && <p className="text-[10px] text-[#848e9c] mt-0.5 truncate max-w-[160px]">{log.details}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                            log.action === 'login' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                            log.action === 'logout' ? 'bg-[#848e9c]/20 text-[#848e9c]' :
                            'bg-[#f0b90b]/10 text-[#f0b90b]'
                          }`}>{log.action}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#eaecef]">{log.ip_address || '—'}</td>
                        <td className="px-4 py-3 text-xs text-[#848e9c] max-w-[180px] truncate">{log.user_agent ? log.user_agent.slice(0, 60) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-[#848e9c] whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLATFORM STATS TAB ── */}
      {tab === 'platform-stats' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#eaecef]">Platform Statistics</h2>
            <button onClick={() => loadTabData('platform-stats')}
              className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] bg-[#1e2329] border border-[#2b3139] px-3 py-1.5 rounded-lg transition">
              <RefreshCw size={11} className={statsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-[#161a1e] border border-[#2b3139] animate-pulse" />)}
            </div>
          ) : walletStats ? (
            <div className="space-y-4">
              {/* User Overview */}
              <div>
                <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide mb-2">Users</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Users', value: walletStats.total_users?.toLocaleString(), icon: <Users size={14} className="text-[#f0b90b]" /> },
                    { label: 'Verified (KYC)', value: walletStats.verified_users?.toLocaleString(), icon: <UserCheck size={14} className="text-[#0ecb81]" /> },
                    { label: 'Active Bots', value: walletStats.active_bots?.toLocaleString(), icon: <Activity size={14} className="text-[#f0b90b]" /> },
                    { label: 'Open Positions', value: walletStats.open_positions?.toLocaleString(), icon: <BarChart2 size={14} className="text-[#627eea]" /> },
                  ].map(s => (
                    <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-wide">{s.label}</p></div>
                      <p className="text-lg font-bold font-mono text-[#eaecef]">{s.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance & Flows */}
              <div>
                <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide mb-2">Platform Balances & Flows</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Total User Balances', value: `$${(walletStats.total_balance_usdt ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: 'text-[#eaecef]' },
                    { label: 'Total Deposited', value: `$${(walletStats.total_deposits_usdt ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: 'text-[#0ecb81]' },
                    { label: 'Total Withdrawn', value: `$${(walletStats.total_withdrawals_usdt ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: 'text-[#f6465d]' },
                    { label: 'Pending Deposits', value: walletStats.pending_deposits?.toLocaleString(), color: 'text-[#f0b90b]' },
                    { label: 'Pending Withdrawals', value: walletStats.pending_withdrawals?.toLocaleString(), color: 'text-[#f0b90b]' },
                    { label: 'Total Trades', value: walletStats.total_trades?.toLocaleString(), color: 'text-[#eaecef]' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
                      <p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-wide mb-1.5">{s.label}</p>
                      <p className={`text-base font-bold font-mono ${s.color}`}>{s.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products */}
              <div>
                <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide mb-2">Product Revenue</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Subscriptions', value: walletStats.total_subscriptions?.toLocaleString(), icon: <CreditCard size={14} className="text-[#627eea]" /> },
                    { label: 'Active Subscriptions', value: walletStats.active_subscriptions?.toLocaleString(), icon: <CheckCircle size={14} className="text-[#0ecb81]" /> },
                    { label: 'VPS Purchases', value: walletStats.total_vps?.toLocaleString(), icon: <Server size={14} className="text-[#f0b90b]" /> },
                    { label: 'Asset Purchases', value: walletStats.total_assets?.toLocaleString(), icon: <ShoppingBag size={14} className="text-[#f6465d]" /> },
                  ].map(s => (
                    <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-wide">{s.label}</p></div>
                      <p className="text-lg font-bold font-mono text-[#eaecef]">{s.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Fin Feedback */}
              {feedbackStats && (
                <div>
                  <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide mb-2">Chat Fin Feedback</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#161a1e] border border-[#0ecb81]/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ThumbsUp size={14} className="text-[#0ecb81]" />
                        <p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-wide">Helpful</p>
                      </div>
                      <p className="text-2xl font-bold font-mono text-[#0ecb81]">{feedbackStats.likes.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#161a1e] border border-[#f6465d]/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ThumbsDown size={14} className="text-[#f6465d]" />
                        <p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-wide">Not Helpful</p>
                      </div>
                      <p className="text-2xl font-bold font-mono text-[#f6465d]">{feedbackStats.dislikes.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare size={14} className="text-[#f0b90b]" />
                        <p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-wide">Total Rated</p>
                      </div>
                      <p className="text-2xl font-bold font-mono text-[#eaecef]">{feedbackStats.total.toLocaleString()}</p>
                      {feedbackStats.total > 0 && (
                        <p className="text-[10px] text-[#848e9c] mt-1">
                          {Math.round((feedbackStats.likes / feedbackStats.total) * 100)}% positive
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center">
              <BarChart2 size={32} className="text-[#2b3139] mx-auto mb-3" />
              <p className="text-sm text-[#848e9c]">Click Refresh to load platform statistics</p>
            </div>
          )}
        </div>
      )}

      {/* ── WhatsApp Bot Tab ── */}
      {tab === 'whatsapp-bot' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#25d366]/10 flex items-center justify-center">
                <MessageSquare size={16} className="text-[#25d366]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#eaecef]">WhatsApp Bot</h2>
                <p className="text-[10px] text-[#848e9c]">Evolution API v2 — Instance: FinAiEvobots</p>
              </div>
            </div>
            <button
              onClick={async () => {
                setEvStatusLoading(true)
                try { const res = await getWhatsAppEvStatus(); setEvStatus(res.data) }
                catch { setEvStatus(null) }
                finally { setEvStatusLoading(false) }
              }}
              disabled={evStatusLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2b3139] hover:bg-[#363c45] text-[#eaecef] text-xs font-medium transition disabled:opacity-50"
            >
              <Activity size={12} className={evStatusLoading ? 'animate-spin' : ''} />
              {evStatusLoading ? 'Checking…' : 'Refresh Status'}
            </button>
          </div>

          {/* Status Card */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5">
            <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide mb-4">Instance Status</p>
            {evStatusLoading ? (
              <div className="py-8 text-center text-xs text-[#848e9c]">Loading…</div>
            ) : evStatus ? (
              <div className="space-y-3">
                {[
                  { label: 'Instance', value: evStatus.instance ?? evStatus.instanceName ?? 'FinAiEvobots' },
                  { label: 'State', value: evStatus.state ?? evStatus.connectionStatus ?? '—' },
                  { label: 'Phone', value: evStatus.ownerJid?.split('@')[0] ?? evStatus.profileName ?? '—' },
                  { label: 'Profile Name', value: evStatus.profileName ?? evStatus.name ?? '—' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-[#2b3139]/50">
                    <span className="text-xs text-[#848e9c]">{row.label}</span>
                    <span className={`text-xs font-mono font-semibold ${
                      String(row.value).toLowerCase().includes('open') || String(row.value).toLowerCase() === 'connected'
                        ? 'text-[#0ecb81]'
                        : String(row.value) === '—' ? 'text-[#4a5568]' : 'text-[#eaecef]'
                    }`}>{String(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-3">
                  <span className={`w-2 h-2 rounded-full ${
                    (evStatus.state ?? evStatus.connectionStatus ?? '').toLowerCase().includes('open') ||
                    (evStatus.state ?? evStatus.connectionStatus ?? '').toLowerCase() === 'connected'
                      ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#f6465d]'
                  }`} />
                  <span className="text-xs text-[#848e9c]">
                    {(evStatus.state ?? evStatus.connectionStatus ?? '').toLowerCase().includes('open') ||
                     (evStatus.state ?? evStatus.connectionStatus ?? '').toLowerCase() === 'connected'
                      ? 'Bot is connected and running'
                      : 'Bot is not connected — scan QR code to connect'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#848e9c]">
                No status data. Click Refresh Status to check the bot.
              </div>
            )}
          </div>

          {/* QR Code Card */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide">QR Code</p>
              <button
                onClick={async () => {
                  setEvQrLoading(true)
                  try { const res = await getWhatsAppQR(); setEvQr(res.data) }
                  catch { setEvQr({ error: 'Failed to fetch QR code' }) }
                  finally { setEvQrLoading(false) }
                }}
                disabled={evQrLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] text-xs font-medium transition disabled:opacity-50"
              >
                <Download size={11} className={evQrLoading ? 'animate-spin' : ''} />
                {evQrLoading ? 'Generating…' : 'Get QR Code'}
              </button>
            </div>
            {evQr ? (
              evQr.error ? (
                <div className="py-6 text-center text-xs text-[#f6465d]">{evQr.error}</div>
              ) : evQr.qrcode || evQr.base64 ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={evQr.qrcode ?? evQr.base64}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 rounded-xl border border-[#2b3139] bg-white p-2"
                  />
                  <p className="text-[10px] text-[#848e9c] text-center">
                    Open WhatsApp → Settings → Linked Devices → Link a Device, then scan this code.
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#0ecb81]">
                  Bot already connected — no QR code needed.
                </div>
              )
            ) : (
              <div className="py-8 text-center text-xs text-[#848e9c]">
                Click Get QR Code to link your WhatsApp number to the bot.
              </div>
            )}
          </div>

          {/* Config Summary */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wide">Bot Configuration</p>
              <span className="text-[9px] text-[#848e9c] bg-[#2b3139] px-2 py-0.5 rounded-full">Values read from Replit secrets</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'API URL', secret: 'EVOLUTION_API_URL', note: 'e.g. http://localhost:8080', fromStatus: evStatus?.api_url },
                { label: 'Instance Name', secret: 'EVOLUTION_INSTANCE', note: 'e.g. FinAiEvobots', fromStatus: evStatus?.instance ?? evStatus?.instanceName },
                { label: 'API Key', secret: 'EVOLUTION_API_KEY', note: 'Stored as Replit secret', fromStatus: evStatus?.api_key_set ? '✓ Set' : undefined },
                { label: 'Webhook Path', secret: null, note: '/api/users/whatsapp-webhook', fromStatus: null },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-start py-2 border-b border-[#2b3139]/50 gap-3">
                  <div>
                    <p className="text-xs text-[#848e9c]">{row.label}</p>
                    {row.secret && (
                      <p className="text-[9px] font-mono text-[#4a5568] mt-0.5">${'{'}{ row.secret }{'}'}</p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-right shrink-0 text-[#eaecef]">
                    {row.fromStatus ?? row.note}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-[#4a5568] mt-4">
              Set or update these values in the Replit Secrets panel. The QR code and status calls will only work once all three Evolution API secrets are configured.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
