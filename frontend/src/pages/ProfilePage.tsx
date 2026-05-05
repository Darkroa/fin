import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  updateProfile, uploadPhoto, sendVerifyEmail, verifyEmail,
  submitKYC, getMe, createApiKey, listApiKeys, revokeApiKey,
  connectExchange, disconnectExchange,
  changePassword, setTransferPin, requestDeleteAccount, saveWebhookSettings
} from '../lib/api'
import toast from 'react-hot-toast'
import {
  User, Camera, Shield, CheckCircle, Clock, XCircle,
  Mail, Lock, Key, Zap, Plus, Trash2, Eye, EyeOff,
  Copy, AlertCircle, Star, Send, MessageCircle, LogOut
} from 'lucide-react'

const TIERS = [
  { tier: 0, label: 'Unverified',  color: 'text-[#848e9c]', bg: 'bg-[#2b3139]',        limits: 'No withdrawals · No API keys' },
  { tier: 1, label: 'Tier 1',      color: 'text-[#f0b90b]', bg: 'bg-[#f0b90b]/10',      limits: '$500/day withdraw · 1 API key' },
  { tier: 2, label: 'Tier 2',      color: 'text-[#0ecb81]', bg: 'bg-[#0ecb81]/10',      limits: '$5,000/day withdraw · 5 API keys' },
  { tier: 3, label: 'Tier 3',      color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10',      limits: 'Unlimited · Priority support' },
]

const EXCHANGES = [
  { id: 'binance',  label: 'Binance',  logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg',  hasPassphrase: false },
  { id: 'bybit',    label: 'Bybit',    logo: 'https://assets.coingecko.com/markets/images/698/small/bybit_spot.jpg', hasPassphrase: false },
  { id: 'okx',      label: 'OKX',      logo: 'https://assets.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png', hasPassphrase: true  },
  { id: 'kucoin',   label: 'KuCoin',   logo: 'https://assets.coingecko.com/markets/images/61/small/kucoin.jpg',   hasPassphrase: true  },
  { id: 'kraken',   label: 'Kraken',   logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg',   hasPassphrase: false },
  { id: 'coinbase', label: 'Coinbase', logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png', hasPassphrase: false },
]

interface ApiKey { id: number; key_name: string; purpose: string; created_at: string; expires_at: string; is_active: boolean; last_used_at: string }
type Tab = 'personal' | 'finapi' | 'security'

const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition disabled:opacity-50'

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [tab, setTab] = useState<Tab>('personal')

  const tier = TIERS[user?.account_tier ?? 0]

  const kycBadge = () => {
    switch (user?.kyc_status) {
      case 'approved':  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81]"><CheckCircle size={10}/>Approved</span>
      case 'submitted': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]"><Clock size={10}/>Under Review</span>
      case 'rejected':  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]"><XCircle size={10}/>Rejected</span>
      default:          return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#2b3139] text-[#848e9c]"><Clock size={10}/>Pending</span>
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-bold text-[#eaecef]">My Profile</h1>

      {/* ── Tier banner ── */}
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${tier.bg} border-current/10`}>
        <Star size={16} className={tier.color} />
        <div className="flex-1">
          <span className={`font-bold text-sm ${tier.color}`}>{tier.label}</span>
          <span className="text-xs text-[#848e9c] ml-3">{tier.limits}</span>
        </div>
        {kycBadge()}
        {user?.is_mail_verified
          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81]"><CheckCircle size={10}/>Email verified</span>
          : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]">Email unverified</span>
        }
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-2xl p-1">
        {([
          ['personal', 'Personal',  User],
          ['finapi',   'FinAPI',    Key],
          ['security', 'Security',  Shield],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === id ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'personal' && <PersonalTab user={user} setUser={setUser} kycBadge={kycBadge} />}
      {tab === 'finapi'   && <FinApiTab   user={user} setUser={setUser} />}
      {tab === 'security' && <SecurityTab user={user} />}
    </div>
  )
}


/* ─────────────────────────── PERSONAL TAB ─────────────────────────── */
function PersonalTab({ user, setUser, kycBadge }: { user: ReturnType<typeof useAuthStore>['user']; setUser: (u: unknown) => void; kycBadge: () => React.ReactNode }) {
  const [form, setForm] = useState({
    first_name:  user?.first_name  || '',
    middle_name: user?.middle_name || '',
    last_name:   user?.last_name   || '',
    username:    user?.username    || '',
    phone:       user?.phone       || '',
    dob:         user?.dob         || '',
    sex:         user?.sex         || '',
    address:     user?.address     || '',
    country:     user?.country     || '',
  })
  const [saving, setSaving]           = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [showVerify, setShowVerify]   = useState(false)
  const [verifyCode, setVerifyCode]   = useState('')
  const [verifying, setVerifying]     = useState(false)
  const [devCode, setDevCode]         = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (user?.profile_locked) return toast.error('Profile is locked by admin')
    setSaving(true)
    try {
      const res = await updateProfile(form as Record<string, unknown>)
      setUser(res.data)
      toast.success('Profile updated')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to update')
    } finally { setSaving(false) }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      await uploadPhoto(file)
      const res = await getMe()
      setUser(res.data)
      toast.success('Photo updated')
    } catch { toast.error('Failed to upload photo') }
    finally { setPhotoLoading(false) }
  }

  const handleSendCode = async () => {
    setSendingCode(true)
    try {
      const res = await sendVerifyEmail()
      setDevCode(res.data.dev_code || null)
      setShowVerify(true)
      toast.success('Verification code sent')
    } catch { toast.error('Failed to send code') }
    finally { setSendingCode(false) }
  }

  const handleVerify = async () => {
    if (!verifyCode.trim()) return
    setVerifying(true)
    try {
      await verifyEmail(verifyCode.trim())
      const res = await getMe()
      setUser(res.data)
      toast.success('Email verified!')
      setShowVerify(false)
    } catch { toast.error('Invalid or expired code') }
    finally { setVerifying(false) }
  }

  const handleSubmitKYC = async () => {
    try {
      await submitKYC()
      const res = await getMe()
      setUser(res.data)
      toast.success('KYC submitted for admin review')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Complete all required fields first')
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Email verification (top) ── */}
      {!user?.is_mail_verified && (
        <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Mail size={14} className="text-[#f6465d] flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#eaecef]">Verify your email address</p>
                <p className="text-xs text-[#848e9c]">Required to create API keys and unlock features</p>
              </div>
            </div>
            {!showVerify ? (
              <button onClick={handleSendCode} disabled={sendingCode}
                className="flex items-center gap-1.5 text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-4 py-2 rounded-xl transition flex-shrink-0 disabled:opacity-60">
                <Mail size={12}/>{sendingCode ? 'Sending...' : 'Send Code'}
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                {devCode && <span className="text-[10px] text-[#848e9c]">Code: <span className="text-[#f0b90b]">{devCode}</span></span>}
                <input value={verifyCode} onChange={e => setVerifyCode(e.target.value)}
                  placeholder="6-digit code" maxLength={6}
                  className="w-28 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-center text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                <button onClick={handleVerify} disabled={verifying}
                  className="text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-3 py-2 rounded-xl transition disabled:opacity-60">
                  {verifying ? '...' : 'Verify'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Photo + name ── */}
      <div className="bg-gradient-to-br from-[#1e2329] to-[#161a1e] border border-[#2b3139] rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-[#f0b90b]/10 border-2 border-[#f0b90b]/30 overflow-hidden flex items-center justify-center">
              {user?.profile_photo
                ? <img src={user.profile_photo} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-[#f0b90b]">{user?.email?.[0]?.toUpperCase() ?? 'U'}</span>
              }
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={photoLoading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#f0b90b] flex items-center justify-center shadow-lg hover:bg-[#d4a30a] transition">
              {photoLoading ? <div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" /> : <Camera size={12} className="text-black" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-[#eaecef]">{user?.full_name || user?.email}</h2>
            <p className="text-[#848e9c] text-sm">@{user?.username || 'no username set'}</p>
            <p className="text-xs text-[#848e9c] mt-1">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* ── Profile locked ── */}
      {user?.profile_locked && (
        <div className="flex items-center gap-2 bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl px-4 py-3">
          <Lock size={14} className="text-[#f6465d] flex-shrink-0" />
          <p className="text-xs text-[#848e9c]">Your profile is locked by admin. Contact support to request changes.</p>
        </div>
      )}

      {/* ── KYC submit ── */}
      {user?.kyc_status === 'pending' && !user?.profile_locked && (
        <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#eaecef]">Complete KYC to unlock higher tiers</p>
            <p className="text-xs text-[#848e9c]">Fill all required fields then submit for admin review.</p>
          </div>
          <button onClick={handleSubmitKYC}
            className="text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-4 py-2 rounded-xl transition flex-shrink-0">
            Submit KYC
          </button>
        </div>
      )}

      {/* ── Personal info form ── */}
      <form onSubmit={handleSave} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <User size={15} className="text-[#f0b90b]" />
          <h2 className="text-sm font-semibold text-[#eaecef]">Personal Information</h2>
          <span className="text-xs text-[#848e9c] ml-auto">{user?.profile_locked ? 'Locked by admin' : 'Required for KYC *'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">First Name *</label>
            <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="First name" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Middle Name</label>
            <input value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="Middle name (optional)" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Last Name *</label>
            <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="Last name" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="@username" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Email</label>
            <input value={user?.email || ''} disabled className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Phone Number *</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="+1 234 567 8900" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Date of Birth *</label>
            <input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
              disabled={!!user?.profile_locked} className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Sex</label>
            <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
              disabled={!!user?.profile_locked} className={inp}>
              <option value="">Select</option>
              <option>Male</option><option>Female</option>
              <option>Other</option><option>Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Country *</label>
            <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="Country" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              disabled={!!user?.profile_locked} placeholder="Street address" className={inp} />
          </div>
        </div>
        {!user?.profile_locked && (
          <button type="submit" disabled={saving}
            className="mt-5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition">
            {saving ? 'Saving...' : 'Update Info'}
          </button>
        )}
      </form>
    </div>
  )
}


/* ─────────────────────────── FINAPI TAB ─────────────────────────── */
function FinApiTab({ user, setUser }: { user: ReturnType<typeof useAuthStore>['user']; setUser: (u: unknown) => void }) {
  const [apiKeys, setApiKeys]         = useState<ApiKey[]>([])
  const [keysLoaded, setKeysLoaded]   = useState(false)
  const [newKeyName, setNewKeyName]   = useState('')
  const [newKeyPurpose, setNewKeyPurpose] = useState('bot')
  const [createdKey, setCreatedKey]   = useState<string | null>(null)
  const [creatingKey, setCreatingKey] = useState(false)

  const [selExchange, setSelExchange] = useState('')
  const [exchApiKey, setExchApiKey]   = useState('')
  const [exchSecret, setExchSecret]   = useState('')
  const [exchPass, setExchPass]       = useState('')
  const [showSecret, setShowSecret]   = useState(false)
  const [connecting, setConnecting]   = useState(false)

  const [tgToken, setTgToken]         = useState((user?.notification_preferences as Record<string, string>)?.telegram_bot_token || '')
  const [tgChatId, setTgChatId]       = useState((user?.notification_preferences as Record<string, string>)?.telegram_chat_id || '')
  const [waNumber, setWaNumber]       = useState((user?.notification_preferences as Record<string, string>)?.whatsapp_number || '')
  const [savingWebhook, setSavingWebhook] = useState(false)

  const selectedExch = EXCHANGES.find(e => e.id === selExchange)
  const connections  = (user?.exchange_connections as { exchange: string; label?: string; api_key_masked?: string }[]) || []

  useEffect(() => { loadApiKeys() }, [])

  const loadApiKeys = async () => {
    try {
      const res = await listApiKeys()
      setApiKeys(Array.isArray(res.data) ? res.data : [])
      setKeysLoaded(true)
    } catch { /* silent */ }
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreatingKey(true)
    try {
      const res = await createApiKey(newKeyName.trim(), newKeyPurpose)
      setCreatedKey(res.data.api_key)
      toast.success('API key created — copy it now!')
      setNewKeyName('')
      await loadApiKeys()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to create key')
    } finally { setCreatingKey(false) }
  }

  const handleRevokeKey = async (id: number) => {
    try {
      await revokeApiKey(id)
      toast.success('Key revoked')
      await loadApiKeys()
    } catch { toast.error('Failed to revoke') }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selExchange || !exchApiKey || !exchSecret) return toast.error('Fill all fields')
    setConnecting(true)
    try {
      await connectExchange({ exchange: selExchange, api_key: exchApiKey, api_secret: exchSecret, passphrase: exchPass || undefined, label: selectedExch?.label })
      const res = await getMe()
      setUser(res.data)
      toast.success(`${selectedExch?.label} connected!`)
      setExchApiKey(''); setExchSecret(''); setExchPass(''); setSelExchange('')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to connect')
    } finally { setConnecting(false) }
  }

  const handleDisconnect = async (exchange: string) => {
    try {
      await disconnectExchange(exchange)
      const res = await getMe()
      setUser(res.data)
      toast.success(`${exchange} disconnected`)
    } catch { toast.error('Failed to disconnect') }
  }

  const handleSaveWebhook = async () => {
    setSavingWebhook(true)
    try {
      await saveWebhookSettings({ telegram_bot_token: tgToken, telegram_chat_id: tgChatId, whatsapp_number: waNumber })
      toast.success('Webhook settings saved')
    } catch { toast.error('Failed to save settings') }
    finally { setSavingWebhook(false) }
  }

  const canCreateKey = user?.is_mail_verified && (user?.account_tier ?? 0) >= 1

  return (
    <div className="space-y-5">

      {/* ── API Keys ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Key size={15} className="text-[#f0b90b]" />
          <h2 className="text-sm font-semibold text-[#eaecef]">Your FinAPI Key</h2>
        </div>
        <p className="text-xs text-[#848e9c] mb-4">Your API key is required to activate and control your AI Trading Bot.</p>

        {!canCreateKey && (
          <div className="flex items-start gap-2 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-3 py-2.5 mb-4">
            <AlertCircle size={13} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#848e9c]">Requires email verification + KYC Tier 1 approval to create API keys.</p>
          </div>
        )}

        {createdKey && (
          <div className="bg-[#0ecb81]/5 border border-[#0ecb81]/20 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-[#0ecb81] mb-1.5">New API Key — Copy now, won't be shown again!</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-[#eaecef] bg-[#0b0e11] px-2 py-1 rounded flex-1 truncate">{createdKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success('Copied!') }}
                className="p-1.5 text-[#0ecb81] hover:bg-[#0ecb81]/10 rounded-lg transition flex-shrink-0">
                <Copy size={13}/>
              </button>
            </div>
            <button onClick={() => setCreatedKey(null)} className="text-[10px] text-[#848e9c] mt-2 hover:text-[#eaecef]">Dismiss</button>
          </div>
        )}

        <form onSubmit={handleCreateKey} className="flex flex-wrap gap-2 mb-4">
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} required disabled={!canCreateKey}
            placeholder="Key name (e.g. My Bot)"
            className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition min-w-0 disabled:opacity-50" />
          <select value={newKeyPurpose} onChange={e => setNewKeyPurpose(e.target.value)} disabled={!canCreateKey}
            className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition disabled:opacity-50">
            <option value="bot">Bot</option>
            <option value="vps">VPS</option>
            <option value="asset">Asset</option>
          </select>
          <button type="submit" disabled={creatingKey || !canCreateKey}
            className="flex items-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-4 py-2 rounded-xl text-sm transition">
            <Plus size={13}/>{creatingKey ? '...' : 'Get API Key'}
          </button>
        </form>

        {keysLoaded && (
          <div className="space-y-2">
            {apiKeys.length === 0
              ? <p className="text-sm text-[#848e9c] text-center py-3">No API keys yet</p>
              : apiKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-[#eaecef]">{k.key_name}</p>
                    <p className="text-[10px] text-[#848e9c]">
                      {k.purpose} · {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${k.is_active ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                    {k.is_active && (
                      <button onClick={() => handleRevokeKey(k.id)} className="p-1.5 text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 rounded-lg transition">
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* ── Exchange Connections ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={15} className="text-[#f0b90b]" />
          <h2 className="text-sm font-semibold text-[#eaecef]">Exchange Connections</h2>
        </div>

        {connections.length > 0 && (
          <div className="mb-4 space-y-2">
            {connections.map((c) => {
              const exch = EXCHANGES.find(e => e.id === c.exchange)
              return (
                <div key={c.exchange} className="flex items-center justify-between bg-[#0b0e11] border border-[#0ecb81]/20 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {exch?.logo
                      ? <img src={exch.logo} alt={exch.label} className="w-7 h-7 rounded-full object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                      : <div className="w-7 h-7 rounded-full bg-[#2b3139] flex-shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium text-[#eaecef]">{c.label || c.exchange}</p>
                      <p className="text-[10px] text-[#848e9c] font-mono">{c.api_key_masked}</p>
                    </div>
                    <CheckCircle size={13} className="text-[#0ecb81]" />
                  </div>
                  <button onClick={() => handleDisconnect(c.exchange)}
                    className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                    <Trash2 size={13}/>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs text-[#848e9c] mb-2 block">Select Exchange</label>
          <div className="grid grid-cols-3 gap-2">
            {EXCHANGES.map(ex => (
              <button key={ex.id} type="button" onClick={() => setSelExchange(ex.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition text-xs font-medium ${selExchange === ex.id ? 'border-[#f0b90b] bg-[#f0b90b]/10 text-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:border-[#3c4451] hover:text-[#eaecef]'}`}>
                <img src={ex.logo} alt={ex.label}
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {selExchange && (
          <form onSubmit={handleConnect} className="space-y-3 mt-4">
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">API Key *</label>
              <input value={exchApiKey} onChange={e => setExchApiKey(e.target.value)} required placeholder="API key" className={inp} />
            </div>
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">API Secret *</label>
              <div className="relative">
                <input type={showSecret ? 'text' : 'password'} value={exchSecret} onChange={e => setExchSecret(e.target.value)} required placeholder="API secret" className={`${inp} pr-10`} />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]">
                  {showSecret ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
            {selectedExch?.hasPassphrase && (
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Passphrase</label>
                <input type="password" value={exchPass} onChange={e => setExchPass(e.target.value)} placeholder="Passphrase" className={inp} />
              </div>
            )}
            <button type="submit" disabled={connecting}
              className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl text-sm transition">
              {connecting ? 'Connecting...' : `Connect ${selectedExch?.label}`}
            </button>
          </form>
        )}
      </div>

      {/* ── Telegram & WhatsApp Webhooks ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <MessageCircle size={15} className="text-[#f0b90b]" />
          <h2 className="text-sm font-semibold text-[#eaecef]">Alert Webhooks</h2>
        </div>
        <p className="text-xs text-[#848e9c] mb-4">Connect Telegram and WhatsApp to receive real-time trade alerts and AI signals.</p>

        <div className="space-y-4">
          {/* Telegram */}
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Send size={13} className="text-[#0ecb81]" />
              <span className="text-xs font-semibold text-[#eaecef]">Telegram Bot</span>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-[#848e9c] mb-1 block">Bot Token</label>
                <input value={tgToken} onChange={e => setTgToken(e.target.value)}
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className={inp} />
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1 block">Chat ID</label>
                <input value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className={inp} />
              </div>
              <p className="text-[10px] text-[#848e9c]">
                Webhook: <code className="text-[#f0b90b] text-[10px]">POST /api/webhooks/telegram</code>
              </p>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle size={13} className="text-[#25D366]" />
              <span className="text-xs font-semibold text-[#eaecef]">WhatsApp (via Twilio)</span>
            </div>
            <div>
              <label className="text-xs text-[#848e9c] mb-1 block">Your WhatsApp Number</label>
              <input value={waNumber} onChange={e => setWaNumber(e.target.value)}
                placeholder="+1 234 567 8900"
                className={inp} />
            </div>
            <p className="text-[10px] text-[#848e9c] mt-2">
              Webhook: <code className="text-[#f0b90b] text-[10px]">POST /api/webhooks/whatsapp</code>
            </p>
          </div>

          <button onClick={handleSaveWebhook} disabled={savingWebhook}
            className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl text-sm transition">
            {savingWebhook ? 'Saving...' : 'Save Webhook Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}


/* ─────────────────────────── SECURITY TAB ─────────────────────────── */
function SecurityTab({ user }: { user: ReturnType<typeof useAuthStore>['user'] }) {
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [savingPw, setSavingPw]     = useState(false)

  const [pin, setPin]               = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [savingPin, setSavingPin]   = useState(false)

  const [deleting, setDeleting]     = useState(false)
  const [showDelConfirm, setShowDelConfirm] = useState(false)

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) return toast.error('Passwords do not match')
    if (newPw.length < 8) return toast.error('Password must be at least 8 characters')
    setSavingPw(true)
    try {
      await changePassword(currentPw, newPw)
      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to change password')
    } finally { setSavingPw(false) }
  }

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin !== confirmPin) return toast.error('PINs do not match')
    if (!/^\d{4,6}$/.test(pin)) return toast.error('PIN must be 4–6 digits')
    setSavingPin(true)
    try {
      await setTransferPin(pin)
      toast.success('Transfer PIN set')
      setPin(''); setConfirmPin('')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to set PIN')
    } finally { setSavingPin(false) }
  }

  const handleRequestDelete = async () => {
    setDeleting(true)
    try {
      await requestDeleteAccount()
      toast.success('Deletion request submitted. Admin will review within 24–48 hours.')
      setShowDelConfirm(false)
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to submit request')
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">

      {/* ── Change Password ── */}
      <form onSubmit={handleChangePw} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={15} className="text-[#f0b90b]" />
          <h2 className="text-sm font-semibold text-[#eaecef]">Change Password</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Current Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={currentPw}
                onChange={e => setCurrentPw(e.target.value)} required placeholder="••••••••" className={`${inp} pr-10`} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]">
                {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">New Password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required placeholder="Min 8 characters" className={inp} />
            </div>
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Confirm Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required placeholder="Repeat new password" className={inp} />
            </div>
          </div>
          <button type="submit" disabled={savingPw}
            className="bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition">
            {savingPw ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* ── Transfer PIN ── */}
      <form onSubmit={handleSetPin} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={15} className="text-[#f0b90b]" />
          <h2 className="text-sm font-semibold text-[#eaecef]">Transfer PIN</h2>
        </div>
        <p className="text-xs text-[#848e9c] mb-4">4–6 digit PIN required to authorise wallet transfers and withdrawals.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">PIN (4–6 digits)</label>
            <input type="password" inputMode="numeric" maxLength={6} value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className={inp} />
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Confirm PIN</label>
            <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className={inp} />
          </div>
        </div>
        <button type="submit" disabled={savingPin}
          className="mt-4 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition">
          {savingPin ? 'Setting...' : 'Set Transfer PIN'}
        </button>
      </form>

      {/* ── Delete Account ── */}
      <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <LogOut size={15} className="text-[#f6465d]" />
          <h2 className="text-sm font-semibold text-[#f6465d]">Delete My Account</h2>
        </div>
        <p className="text-xs text-[#848e9c] mb-4">
          Submitting this request will notify the admin. Your account and data will be permanently deleted after admin approval (24–48 hours). Any remaining balance will be processed per our policy.
        </p>
        {!showDelConfirm ? (
          <button onClick={() => setShowDelConfirm(true)}
            className="text-xs bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/30 font-semibold px-5 py-2.5 rounded-xl transition">
            Request Account Deletion
          </button>
        ) : (
          <div className="bg-[#0b0e11] border border-[#f6465d]/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-[#eaecef]">Are you sure? This cannot be undone.</p>
            <p className="text-xs text-[#848e9c]">Account: <span className="text-[#eaecef]">{user?.email}</span></p>
            <div className="flex gap-3">
              <button onClick={handleRequestDelete} disabled={deleting}
                className="flex-1 bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition">
                {deleting ? 'Submitting...' : 'Yes, Submit Request'}
              </button>
              <button onClick={() => setShowDelConfirm(false)}
                className="flex-1 bg-[#2b3139] hover:bg-[#3c4451] text-[#eaecef] font-semibold py-2.5 rounded-xl text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
