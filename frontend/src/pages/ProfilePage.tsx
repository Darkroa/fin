import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, type User as UserProfile } from '../store/authStore'
import {
  updateProfile, uploadPhoto, sendVerifyEmail, verifyEmail,
  submitKYC, getMe, createApiKey, listApiKeys, revokeApiKey,
  connectExchange, disconnectExchange,
  changePassword, setTransferPin, requestDeleteAccount,
  generateWhatsAppCode, disconnectWhatsApp, disconnectTelegram, generateTelegramCode,
  getReferralStats, setup2fa, disable2fa,
} from '../lib/api'
import toast from 'react-hot-toast'
import {
  User, Camera, Shield, CheckCircle,
  Mail, Lock, Key, Zap, Plus, Trash2, Eye, EyeOff,
  Copy, AlertCircle, Send, MessageCircle, LogOut, ChevronDown,
  Wifi, RefreshCw, Gift, Share2, Users as UsersIcon, TrendingUp,
  ChevronLeft, ChevronRight, Settings, Smartphone,
} from 'lucide-react'

const TIERS = [
  { tier: 0, label: 'Unverified', color: 'text-[#848e9c]', bg: 'bg-[#2b3139]/30',    border: 'border-[#2b3139]',    limits: 'No withdrawals · No API keys' },
  { tier: 1, label: 'Tier 1',    color: 'text-[#f0b90b]', bg: 'bg-[#f0b90b]/8',      border: 'border-[#f0b90b]/20', limits: '$500/day withdraw · 1 API key' },
  { tier: 2, label: 'Tier 2',    color: 'text-[#0ecb81]', bg: 'bg-[#0ecb81]/8',      border: 'border-[#0ecb81]/20', limits: '$5,000/day withdraw · 5 API keys' },
  { tier: 3, label: 'Tier 3',    color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/8',      border: 'border-[#a78bfa]/20', limits: 'Unlimited · Priority support' },
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
type SubPage = 'personal' | 'finapi' | 'security' | 'referral' | null

const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition disabled:opacity-50 disabled:cursor-not-allowed'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#848e9c]">
        {label}{required && <span className="text-[#f0b90b] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#4a5568]">{label}</span>
      <div className="flex-1 h-px bg-[#2b3139]" />
    </div>
  )
}

function SubPageWrapper({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl bg-[#161a1e] border border-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition flex-shrink-0">
          <ChevronLeft size={16} />
        </button>
        <h1 className="text-xl font-bold text-[#eaecef]">{title}</h1>
      </div>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [subPage, setSubPage] = useState<SubPage>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file')
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB')
    setPhotoLoading(true)
    if (fileRef.current) fileRef.current.value = ''
    try {
      const uploadRes = await uploadPhoto(file)
      const photo = uploadRes.data?.profile_photo
      if (photo) {
        setUser({ ...useAuthStore.getState().user!, profile_photo: photo })
      } else {
        const res = await getMe()
        setUser(res.data)
      }
      toast.success('Photo updated!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to upload photo')
    } finally { setPhotoLoading(false) }
  }

  const tier = TIERS[user?.account_tier ?? 0] ?? TIERS[0]
  const prefs = (user?.notification_preferences as Record<string, any>) ?? {};
  const waVerified   = prefs.whatsapp_verified === true
  const tgVerified   = prefs.telegram_verified === true
  const emailVerified = user?.is_mail_verified === true
  const kycApproved  = user?.kyc_status === 'approved'
  const kycSubmitted = user?.kyc_status === 'submitted'

  if (subPage === 'personal') return (
    <SubPageWrapper title="Personal Information" onBack={() => setSubPage(null)}>
      <PersonalTab user={user} setUser={setUser} />
    </SubPageWrapper>
  )
  if (subPage === 'finapi') return (
    <SubPageWrapper title="FinAPI" onBack={() => setSubPage(null)}>
      <FinApiTab user={user} setUser={setUser} />
    </SubPageWrapper>
  )
  if (subPage === 'security') return (
    <SubPageWrapper title="Security" onBack={() => setSubPage(null)}>
      <SecurityTab user={user} />
    </SubPageWrapper>
  )
  if (subPage === 'referral') return (
    <SubPageWrapper title="Referral" onBack={() => setSubPage(null)}>
      <ReferralTab />
    </SubPageWrapper>
  )

  const firstName = user?.first_name || user?.email?.split('@')[0] || 'User'
  const lastName  = user?.last_name || ''
  const initial   = firstName[0]?.toUpperCase() ?? 'U'

  return (
    <div className="max-w-md mx-auto space-y-3">

      {/* ── Profile card ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-6 flex flex-col items-center gap-3">
        {/* Photo — tappable to upload */}
        <div className="relative">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={photoLoading}
            className="w-20 h-20 rounded-full bg-[#f0b90b] flex items-center justify-center text-black font-bold text-2xl overflow-hidden focus:outline-none ring-2 ring-transparent hover:ring-[#f0b90b]/40 transition"
            title="Tap to change photo"
          >
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="" className="w-full h-full object-cover" />
              : initial
            }
          </button>
          {/* Camera badge */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={photoLoading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#f0b90b] flex items-center justify-center shadow-lg hover:bg-[#d4a30a] transition disabled:opacity-60"
          >
            {photoLoading
              ? <div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />
              : <Camera size={12} className="text-black" />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Name + email */}
        <div className="text-center">
          <p className="text-base font-bold text-[#eaecef]">{firstName}{lastName ? ` ${lastName}` : ''}</p>
          <p className="text-xs text-[#848e9c] mt-0.5">{user?.email}</p>
        </div>

        {/* Tier badge — just label, no limits text */}
        <span className={`text-xs font-bold px-4 py-1.5 rounded-full border ${tier.bg} ${tier.color} ${tier.border}`}>
          {tier.label}
        </span>

        {/* Channel status icons — inline row */}
        <div className="flex items-center gap-5 mt-1">
          <div className={`flex flex-col items-center gap-1 ${emailVerified ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
            <Mail size={18} />
            <span className="text-[9px] font-medium">Email</span>
          </div>
          <div className={`flex flex-col items-center gap-1 ${waVerified ? 'text-[#25D366]' : 'text-[#848e9c]'}`}>
            <MessageCircle size={18} />
            <span className="text-[9px] font-medium">WhatsApp</span>
          </div>
          <div className={`flex flex-col items-center gap-1 ${tgVerified ? 'text-[#229ED9]' : 'text-[#848e9c]'}`}>
            <Send size={18} />
            <span className="text-[9px] font-medium">Telegram</span>
          </div>
          <div className={`flex flex-col items-center gap-1 ${kycApproved ? 'text-[#0ecb81]' : kycSubmitted ? 'text-[#f0b90b]' : 'text-[#848e9c]'}`}>
            <Shield size={18} />
            <span className="text-[9px] font-medium">KYC</span>
          </div>
        </div>
      </div>

      {/* ── Navigation list ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden divide-y divide-[#2b3139]">
        {([
          { label: 'Personal Information', sub: 'Update details & profile photo', page: 'personal' as SubPage, icon: User },
          { label: 'FinAPI',               sub: 'API keys & exchange connections', page: 'finapi'   as SubPage, icon: Key },
          { label: 'Referral',             sub: 'Invite friends & earn rewards',  page: 'referral' as SubPage, icon: Gift },
          { label: 'Settings',             sub: 'Notifications & preferences',    page: null,                  icon: Settings,  action: () => navigate('/app/settings') },
          { label: 'Security',             sub: 'Password, PIN & safety',         page: 'security' as SubPage, icon: Shield },
        ] as const).map(item => (
          <button key={item.label}
            onClick={() => 'action' in item && item.action ? item.action() : setSubPage(item.page!)}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1e2329] transition text-left">
            <div className="w-9 h-9 rounded-xl bg-[#0b0e11] flex items-center justify-center flex-shrink-0">
              <item.icon size={16} className="text-[#f0b90b]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#eaecef]">{item.label}</p>
              <p className="text-xs text-[#848e9c]">{item.sub}</p>
            </div>
            <ChevronRight size={16} className="text-[#848e9c] flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}


/* ─────────────────────────── REFERRAL TAB ─────────────────────────── */
function ReferralTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  useEffect(() => {
    getReferralStats()
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) return (
    <div className="py-16 text-center text-[#848e9c]">
      <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[#f0b90b]" />
      Loading referral data…
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Your Referrals', value: stats?.referred_count ?? 0, icon: UsersIcon, color: 'text-[#627eea]', bg: 'bg-[#627eea]/10' },
          { label: 'Total Earned', value: `$${(stats?.total_earned_usdt ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-[#0ecb81]', bg: 'bg-[#0ecb81]/10' },
          { label: 'Your Code', value: stats?.referral_code ?? '—', icon: Gift, color: 'text-[#f0b90b]', bg: 'bg-[#f0b90b]/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
            <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon size={13} className={s.color} />
            </div>
            <p className="text-xs text-[#848e9c] mb-0.5">{s.label}</p>
            <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Code + Link */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift size={14} className="text-[#f0b90b]" />
          <h3 className="text-sm font-semibold text-[#eaecef]">Your Referral Code</h3>
        </div>

        {/* Code */}
        <div>
          <label className="text-xs text-[#848e9c] mb-1.5 block">Share this code with friends</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-3 bg-[#0b0e11] border border-[#f0b90b]/30 rounded-xl px-4 py-3">
              <Gift size={14} className="text-[#f0b90b] flex-shrink-0" />
              <span className="font-mono font-bold text-[#f0b90b] text-lg tracking-[0.25em]">
                {stats?.referral_code ?? '—'}
              </span>
            </div>
            <button
              onClick={() => stats?.referral_code && copyToClipboard(stats.referral_code, 'code')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-[#f0b90b] text-xs font-semibold hover:bg-[#f0b90b]/20 transition">
              {copied === 'code' ? <CheckCircle size={13} /> : <Copy size={13} />}
              {copied === 'code' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Link */}
        {stats?.referral_code && (
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Or share your referral link</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 overflow-hidden">
                <Share2 size={12} className="text-[#848e9c] flex-shrink-0" />
                <span className="text-xs text-[#848e9c] truncate font-mono">
                  {`${window.location.origin}/login?ref=${stats.referral_code}`}
                </span>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    `${window.location.origin}/login?ref=${stats.referral_code}`,
                    'link'
                  )
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2b3139] text-[#eaecef] text-xs font-semibold hover:bg-[#3c4451] transition">
                {copied === 'link' ? <CheckCircle size={13} /> : <Copy size={13} />}
                {copied === 'link' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">
        <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide mb-4">How It Works</p>
        <div className="space-y-3">
          {[
            { step: '1', label: 'Share your code', desc: 'Send your referral code or link to friends who want to trade on FinAi.' },
            { step: '2', label: 'They sign up', desc: 'Your friend enters your code on the signup page and creates their account.' },
            { step: '3', label: 'You earn a bonus', desc: 'Once they sign up, your referral bonus is automatically credited to your wallet.' },
            { step: '4', label: 'Use it to trade', desc: 'Your bonus USDT is immediately available — use it to fund AI bot trades.' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#f0b90b]/15 border border-[#f0b90b]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-[#f0b90b]">{s.step}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#eaecef]">{s.label}</p>
                <p className="text-[11px] text-[#848e9c] mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referred users table */}
      {stats?.referred_users?.length > 0 && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2b3139]">
            <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide">People You Referred</p>
          </div>
          <div className="divide-y divide-[#2b3139]/50">
            {stats.referred_users.map((u: any, i: number) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#2b3139] flex items-center justify-center">
                    <UsersIcon size={10} className="text-[#848e9c]" />
                  </div>
                  <span className="text-[#eaecef]">{u.email}</span>
                </div>
                <span className="text-[#4a5568]">{u.joined_at ? new Date(u.joined_at).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── PERSONAL TAB ─────────────────────────── */
function PersonalTab({ user, setUser }: { user: UserProfile | null; setUser: (u: any) => void }) {
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
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

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
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    setPhotoLoading(true)
    if (fileRef.current) fileRef.current.value = ''
    try {
      const uploadRes = await uploadPhoto(file)
      const photo = uploadRes.data?.profile_photo
      if (photo) {
        setUser({ ...useAuthStore.getState().user!, profile_photo: photo })
      } else {
        const res = await getMe()
        setUser(res.data)
      }
      toast.success('Photo updated!')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to upload photo')
    } finally { setPhotoLoading(false) }
  }

  const handleSendCode = async () => {
    setSendingCode(true)
    try {
      await sendVerifyEmail()
      setShowVerify(true)
      toast.success('Verification code sent to your email')
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

  const fullName = [user?.first_name, user?.middle_name, user?.last_name].filter(Boolean).join(' ') || user?.email || ''
  const initials = user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'
  const tgConnected = !!(user as any)?.telegram_connected
  const waConnected = !!(user as any)?.whatsapp_connected

  return (
    <div className="space-y-3">

      {/* ── Unified profile card ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4">

            {/* Left: avatar */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#f0b90b]/10 border-2 border-[#f0b90b]/30 overflow-hidden flex items-center justify-center">
                  {user?.profile_photo
                    ? <img src={user.profile_photo} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-3xl sm:text-4xl font-bold text-[#f0b90b]">{initials}</span>
                  }
                </div>
                <button onClick={() => fileRef.current?.click()} disabled={photoLoading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#f0b90b] flex items-center justify-center shadow-lg hover:bg-[#d4a30a] transition">
                  {photoLoading
                    ? <div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />
                    : <Camera size={12} className="text-black" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
            </div>

            {/* Right: name, details, badges */}
            <div className="flex-1 min-w-0 space-y-2">

              {/* Name */}
              <div>
                <p className="font-bold text-base sm:text-lg text-[#eaecef] leading-tight truncate">{fullName}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span className="text-xs text-[#848e9c]">@{user?.username || 'no username'}</span>
                  {user?.dob && <><span className="text-[#3c4451]">·</span><span className="text-xs text-[#848e9c]">{user.dob}</span></>}
                  {user?.sex && <><span className="text-[#3c4451]">·</span><span className="text-xs text-[#848e9c]">{user.sex}</span></>}
                </div>
                <p className="text-[11px] text-[#4a5568] mt-0.5 truncate">{user?.email}</p>
              </div>

              {/* Connection status row — only show when actually connected */}
              {(tgConnected || waConnected) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {tgConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#0ecb81]/8 border-[#0ecb81]/25 text-[#0ecb81]">
                      <Send size={8} />Telegram
                    </span>
                  )}
                  {waConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#0ecb81]/8 border-[#0ecb81]/25 text-[#0ecb81]">
                      <MessageCircle size={8} />WhatsApp
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Verify email */}
      {!user?.is_mail_verified && (
        <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-2 flex-1">
              <Mail size={13} className="text-[#f6465d] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#eaecef]">Verify your email address</p>
                <p className="text-[11px] text-[#848e9c]">Required to create API keys and unlock features</p>
              </div>
            </div>
            {!showVerify ? (
              <button onClick={handleSendCode} disabled={sendingCode}
                className="self-start sm:self-auto flex items-center gap-1.5 text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-3 py-2 rounded-lg transition disabled:opacity-60">
                <Mail size={11}/>{sendingCode ? 'Sending…' : 'Send Code'}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-[#848e9c]">Check your email for the 6-digit code</p>
                <div className="flex items-center gap-2">
                  <input value={verifyCode} onChange={e => setVerifyCode(e.target.value)}
                    placeholder="6-digit code" maxLength={6}
                    className="w-28 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-xs text-center text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                  <button onClick={handleVerify} disabled={verifying}
                    className="text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-3 py-2 rounded-lg transition disabled:opacity-60">
                    {verifying ? '…' : 'Verify'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Profile locked */}
      {user?.profile_locked && (
        <div className="flex items-center gap-2 bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl px-4 py-3">
          <Lock size={13} className="text-[#f6465d] flex-shrink-0" />
          <p className="text-xs text-[#848e9c]">Your profile is locked by admin. Contact support to request changes.</p>
        </div>
      )}

      {/* KYC submit */}
      {user?.kyc_status === 'pending' && !user?.profile_locked && (
        <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#eaecef]">Complete KYC to unlock higher tiers</p>
            <p className="text-[11px] text-[#848e9c]">Fill all required fields then submit for admin review.</p>
          </div>
          <button onClick={handleSubmitKYC}
            className="text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-4 py-2 rounded-lg transition flex-shrink-0">
            Submit KYC
          </button>
        </div>
      )}

      {/* Personal info form */}
      <form onSubmit={handleSave} className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
          <User size={13} className="text-[#f0b90b]" />
          <span className="text-xs font-semibold text-[#eaecef]">Personal Information</span>
          {user?.profile_locked
            ? <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]">Locked</span>
            : <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]">Required for KYC</span>
          }
        </div>

        <div className="p-4 space-y-5">

          {/* ── Full Name ── */}
          <div className="space-y-3">
            <SectionHeader label="Full Name" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="First Name" required>
                <input value={form.first_name} onChange={set('first_name')}
                  disabled={!!user?.profile_locked} placeholder="First name" className={inp} />
              </Field>
              <Field label="Middle Name">
                <input value={form.middle_name} onChange={set('middle_name')}
                  disabled={!!user?.profile_locked} placeholder="Optional" className={inp} />
              </Field>
              <Field label="Last Name" required>
                <input value={form.last_name} onChange={set('last_name')}
                  disabled={!!user?.profile_locked} placeholder="Last name" className={inp} />
              </Field>
            </div>
          </div>

          {/* ── Account Details ── */}
          <div className="space-y-3">
            <SectionHeader label="Account Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Username">
                <input value={form.username} onChange={set('username')}
                  disabled={!!user?.profile_locked} placeholder="@username" className={inp} />
              </Field>
              <Field label="Email">
                <input value={user?.email || ''} disabled className={inp} />
              </Field>
            </div>
          </div>

          {/* ── Contact & Identity ── */}
          <div className="space-y-3">
            <SectionHeader label="Contact & Identity" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phone Number" required>
                <input value={form.phone} onChange={set('phone')}
                  disabled={!!user?.profile_locked} placeholder="+1 234 567 8900" className={inp} />
              </Field>
              <Field label="Date of Birth" required>
                <input type="date" value={form.dob} onChange={set('dob')}
                  disabled={!!user?.profile_locked} className={inp} />
              </Field>
              <Field label="Sex">
                <div className="relative">
                  <select value={form.sex} onChange={set('sex')}
                    disabled={!!user?.profile_locked}
                    className={`${inp} appearance-none pr-8`}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                </div>
              </Field>
              <Field label="Country" required>
                <input value={form.country} onChange={set('country')}
                  disabled={!!user?.profile_locked} placeholder="Country" className={inp} />
              </Field>
              <Field label="Street Address">
                <input value={form.address} onChange={set('address')}
                  disabled={!!user?.profile_locked} placeholder="Street address" className={`${inp} sm:col-span-2`} />
              </Field>
            </div>
          </div>

          {!user?.profile_locked && (
            <button type="submit" disabled={saving}
              className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-bold py-2.5 rounded-lg text-sm transition">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}


/* ─────────────────────────── FINAPI TAB ─────────────────────────── */
function FinApiTab({ user, setUser }: { user: UserProfile | null; setUser: (u: any) => void }) {
  const navigate = useNavigate()
  const isFreeUser = !user?.subscription || user.subscription === 'free'
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

  const prefs = (user?.notification_preferences as unknown as Record<string, unknown>) || {}
  // Telegram code flow
  const tgVerified = prefs.telegram_verified === true
  const tgLinkedName = (prefs.telegram_first_name as string) || ''
  const tgLinkedChatId = (prefs.telegram_chat_id as string) || ''
  const [tgCode, setTgCode]                 = useState<string | null>(null)
  const [generatingTgCode, setGeneratingTgCode] = useState(false)

  const waVerified = prefs.whatsapp_verified === true
  const waPhone    = (prefs.whatsapp_number as string) || ''
  const [waGenCode, setWaGenCode]           = useState<string | null>(null)
  const [waGenerating, setWaGenerating]     = useState(false)

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

  const handleGenerateTgCode = async () => {
    setGeneratingTgCode(true)
    try {
      const res = await generateTelegramCode()
      setTgCode(res.data.code)
      toast.success('Code generated — send it to @FinAitradebot!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to generate code')
    } finally { setGeneratingTgCode(false) }
  }

  const handleDisconnectTelegram = async () => {
    try {
      await disconnectTelegram()
      const res = await getMe()
      setUser(res.data)
      setTgCode(null)
      toast.success('Telegram disconnected')
    } catch { toast.error('Failed to disconnect') }
  }

  const handleGenerateWaCode = async () => {
    setWaGenerating(true)
    try {
      const res = await generateWhatsAppCode()
      setWaGenCode(res.data.code)
      toast.success('Code generated — send it to our WhatsApp number!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to generate code')
    } finally { setWaGenerating(false) }
  }

  const handleDisconnectWa = async () => {
    try {
      await disconnectWhatsApp()
      const res = await getMe()
      setUser(res.data)
      setWaGenCode(null)
      toast.success('WhatsApp disconnected')
    } catch { toast.error('Failed to disconnect') }
  }

  const canCreateKey = user?.is_mail_verified && (user?.account_tier ?? 0) >= 1

  return (
    <div className="space-y-4">

      {/* API Keys */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
          <Key size={13} className="text-[#f0b90b]" />
          <span className="text-xs font-semibold text-[#eaecef]">Your FinAPI Key</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-[#848e9c]">Your API key is required to activate and control your AI Trading Bot.</p>

          {!canCreateKey && (
            <div className="flex items-start gap-2 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={12} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#848e9c]">Requires email verification + KYC Tier 1 approval to create API keys.</p>
            </div>
          )}

          {createdKey && (
            <div className="bg-[#0ecb81]/5 border border-[#0ecb81]/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-[#0ecb81] mb-2">New API Key — copy now, won't be shown again!</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-[#eaecef] bg-[#0b0e11] px-2 py-1.5 rounded flex-1 truncate">{createdKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success('Copied!') }}
                  className="p-1.5 text-[#0ecb81] hover:bg-[#0ecb81]/10 rounded-lg transition flex-shrink-0">
                  <Copy size={13}/>
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="text-[10px] text-[#848e9c] mt-2 hover:text-[#eaecef]">Dismiss</button>
            </div>
          )}

          <form onSubmit={handleCreateKey} className="flex flex-wrap gap-2">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} required disabled={!canCreateKey}
              placeholder="Key name (e.g. My Bot)"
              className="flex-1 min-w-0 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition disabled:opacity-50" />
            <div className="relative">
              <select value={newKeyPurpose} onChange={e => setNewKeyPurpose(e.target.value)} disabled={!canCreateKey}
                className="bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-xs text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition disabled:opacity-50 appearance-none pr-8 cursor-pointer">
                <option value="bot">Bot</option>
                <option value="vps">VPS</option>
                <option value="asset">Asset</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
            </div>
            <button type="submit" disabled={creatingKey || !canCreateKey}
              className="flex items-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-3 py-2 rounded-lg text-xs transition">
              <Plus size={12}/>{creatingKey ? '…' : 'Create Key'}
            </button>
          </form>

          {keysLoaded && (
            <div className="space-y-2">
              {apiKeys.length === 0
                ? <p className="text-xs text-[#848e9c] text-center py-3">No API keys yet</p>
                : apiKeys.map(k => (
                  <div key={k.id} className="flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5">
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
                          <Trash2 size={11}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Exchange Connections */}
      {isFreeUser ? (
        <div className="relative rounded-xl overflow-hidden">
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden opacity-25 pointer-events-none select-none">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
              <Zap size={13} className="text-[#f0b90b]" />
              <span className="text-xs font-semibold text-[#eaecef]">Exchange Connections</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-9 bg-[#2b3139] rounded-lg" />)}
              </div>
              <div className="h-24 bg-[#2b3139]/60 rounded-xl" />
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
            <Lock size={16} className="text-[#f0b90b]" />
            <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
            <p className="text-[10px] text-[#848e9c] text-center px-4">Upgrade to connect exchange APIs</p>
            <button onClick={() => navigate('/app/pricing')}
              className="mt-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-[10px] px-4 py-1.5 rounded-lg transition">
              Upgrade Now
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
            <Zap size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">Exchange Connections</span>
          </div>
          <div className="p-4 space-y-4">
            {connections.length > 0 && (
              <div className="space-y-2">
                {connections.map(c => {
                  const exch = EXCHANGES.find(e => e.id === c.exchange)
                  return (
                    <div key={c.exchange} className="flex items-center justify-between bg-[#0b0e11] border border-[#0ecb81]/20 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {exch?.logo
                          ? <img src={exch.logo} alt={exch.label} className="w-6 h-6 rounded-full object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                          : <div className="w-6 h-6 rounded-full bg-[#2b3139] flex-shrink-0" />
                        }
                        <div>
                          <p className="text-xs font-medium text-[#eaecef]">{c.label || c.exchange}</p>
                          <p className="text-[10px] text-[#848e9c] font-mono">{c.api_key_masked}</p>
                        </div>
                        <CheckCircle size={12} className="text-[#0ecb81]" />
                      </div>
                      <button onClick={() => handleDisconnect(c.exchange)}
                        className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-[#848e9c] mb-2 block">Select Exchange</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXCHANGES.map(ex => (
                  <button key={ex.id} type="button" onClick={() => setSelExchange(selExchange === ex.id ? '' : ex.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition text-xs font-medium ${selExchange === ex.id ? 'border-[#f0b90b] bg-[#f0b90b]/10 text-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:border-[#3c4451] hover:text-[#eaecef]'}`}>
                    <img src={ex.logo} alt={ex.label} className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {selExchange && (
              <form onSubmit={handleConnect} className="space-y-3 border-t border-[#2b3139] pt-4">
                <Field label="API Key" required>
                  <input value={exchApiKey} onChange={e => setExchApiKey(e.target.value)} required placeholder="API key" className={inp} />
                </Field>
                <Field label="API Secret" required>
                  <div className="relative">
                    <input type={showSecret ? 'text' : 'password'} value={exchSecret}
                      onChange={e => setExchSecret(e.target.value)} required placeholder="API secret" className={`${inp} pr-10`} />
                    <button type="button" onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]">
                      {showSecret ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                </Field>
                {selectedExch?.hasPassphrase && (
                  <Field label="Passphrase">
                    <input type="password" value={exchPass} onChange={e => setExchPass(e.target.value)} placeholder="Passphrase" className={inp} />
                  </Field>
                )}
                <button type="submit" disabled={connecting}
                  className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-lg text-xs transition">
                  {connecting ? 'Connecting…' : `Connect ${selectedExch?.label}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Alert Webhooks */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
          <MessageCircle size={13} className="text-[#f0b90b]" />
          <span className="text-xs font-semibold text-[#eaecef]">Alert Channels</span>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-[11px] text-[#848e9c]">Connect Telegram and WhatsApp to receive real-time trade alerts and AI signals.</p>

          {/* Telegram — via @FinAitradebot */}
          {isFreeUser ? (
            <div className="relative rounded-xl overflow-hidden">
              <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3 opacity-25 pointer-events-none select-none">
                <div className="flex items-center gap-2">
                  <Send size={12} className="text-[#229ED9]" />
                  <span className="text-xs font-semibold text-[#eaecef]">Telegram (@FinAitradebot)</span>
                </div>
                <div className="h-16 bg-[#229ED9]/10 rounded-lg" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
                <Lock size={16} className="text-[#f0b90b]" />
                <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
                <p className="text-[10px] text-[#848e9c] text-center px-4">Upgrade to connect Telegram alerts</p>
                <button onClick={() => navigate('/app/pricing')}
                  className="mt-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-[10px] px-4 py-1.5 rounded-lg transition">
                  Upgrade Now
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send size={12} className="text-[#229ED9]" />
                  <span className="text-xs font-semibold text-[#eaecef]">Telegram (@FinAitradebot)</span>
                </div>
                {tgVerified && (
                  <span className="flex items-center gap-1 text-[10px] text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/20 px-2 py-0.5 rounded-full">
                    <Wifi size={9} /> Connected
                  </span>
                )}
              </div>

              {tgVerified ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#0ecb81]/8 border border-[#0ecb81]/15 rounded-lg px-3 py-2.5">
                    <CheckCircle size={13} className="text-[#0ecb81] flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#eaecef]">{tgLinkedName || 'Telegram User'}</p>
                      <p className="text-[10px] text-[#848e9c]">Chat ID: {tgLinkedChatId} · Alerts enabled</p>
                    </div>
                  </div>
                  <button onClick={handleDisconnectTelegram}
                    className="w-full border border-[#f6465d]/30 hover:bg-[#f6465d]/10 text-[#f6465d] font-medium py-2 rounded-lg text-xs transition">
                    Disconnect Telegram
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <ol className="text-[10px] text-[#848e9c] space-y-1 list-decimal list-inside">
                    <li>Open Telegram and search for <span className="text-[#229ED9] font-mono">@FinAitradebot</span></li>
                    <li>Click <span className="text-[#f0b90b]">Start</span> to begin a chat</li>
                    <li>Click <span className="text-[#f0b90b]">Generate Code</span> below and send the code to the bot</li>
                  </ol>
                  {tgCode ? (
                    <div className="space-y-2">
                      <div className="bg-[#229ED9]/10 border border-[#229ED9]/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-[#848e9c] mb-1">Send this code to @FinAitradebot:</p>
                        <div className="flex items-center justify-center gap-2">
                          <code className="text-lg font-mono font-bold text-[#229ED9] tracking-widest">{tgCode}</code>
                          <button onClick={() => { navigator.clipboard.writeText(tgCode); toast.success('Copied!') }}
                            className="p-1 text-[#229ED9] hover:bg-[#229ED9]/10 rounded-lg transition">
                            <Copy size={13}/>
                          </button>
                        </div>
                      </div>
                      <a href="https://t.me/FinAitradebot" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#229ED9] hover:bg-[#1a8bc4] text-white font-semibold py-2.5 rounded-lg text-xs transition">
                        <Send size={12}/> Open @FinAitradebot
                      </a>
                      <p className="text-[10px] text-[#4a5568] text-center">After sending the code, this page will update automatically on next refresh.</p>
                      <button onClick={() => setTgCode(null)} className="w-full text-xs text-[#848e9c] hover:text-[#eaecef] py-1 transition">
                        Generate new code
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleGenerateTgCode} disabled={generatingTgCode}
                      className="w-full bg-[#229ED9]/20 hover:bg-[#229ED9]/30 disabled:opacity-50 border border-[#229ED9]/30 text-[#229ED9] font-semibold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2">
                      {generatingTgCode ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Send size={12}/> Generate Telegram Code</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {isFreeUser ? (
            <div className="relative rounded-xl overflow-hidden">
              <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3 opacity-25 pointer-events-none select-none">
                <div className="flex items-center gap-2">
                  <MessageCircle size={12} className="text-[#25D366]" />
                  <span className="text-xs font-semibold text-[#eaecef]">WhatsApp (Twilio)</span>
                </div>
                <div className="h-16 bg-[#25D366]/10 rounded-lg" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
                <Lock size={16} className="text-[#f0b90b]" />
                <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
                <p className="text-[10px] text-[#848e9c] text-center px-4">Upgrade to connect WhatsApp alerts</p>
                <button onClick={() => navigate('/app/pricing')}
                  className="mt-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-[10px] px-4 py-1.5 rounded-lg transition">
                  Upgrade Now
                </button>
              </div>
            </div>
          ) : (
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={12} className="text-[#25D366]" />
                <span className="text-xs font-semibold text-[#eaecef]">WhatsApp (Twilio)</span>
              </div>
              {waVerified && (
                <span className="flex items-center gap-1 text-[10px] text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/20 px-2 py-0.5 rounded-full">
                  <CheckCircle size={9} /> Connected
                </span>
              )}
            </div>

            {waVerified ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-[#0ecb81]/8 border border-[#0ecb81]/15 rounded-lg px-3 py-2.5">
                  <CheckCircle size={13} className="text-[#0ecb81] flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[#eaecef]">{waPhone || 'WhatsApp connected'}</p>
                    <p className="text-[10px] text-[#848e9c]">Connected · Alerts enabled</p>
                  </div>
                </div>
                <button onClick={handleDisconnectWa}
                  className="w-full border border-[#f6465d]/30 hover:bg-[#f6465d]/10 text-[#f6465d] font-medium py-2 rounded-lg text-xs transition">
                  Disconnect WhatsApp
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-[#848e9c]">
                  Connect WhatsApp to receive trade alerts and signals. Click below to generate a one-time code, then send it to our WhatsApp number.
                </p>

                {!waGenCode ? (
                  <button onClick={handleGenerateWaCode} disabled={waGenerating}
                    className="w-full bg-[#25D366]/20 hover:bg-[#25D366]/30 disabled:opacity-50 border border-[#25D366]/30 text-[#25D366] font-semibold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2">
                    {waGenerating
                      ? <><RefreshCw size={12} className="animate-spin" /> Generating…</>
                      : <><Send size={12}/> Generate WhatsApp Code</>}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-[#25D366]/8 border border-[#25D366]/20 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] text-[#848e9c] font-semibold uppercase tracking-wider">Your code</p>
                      <div className="flex items-center gap-3">
                        <code className="text-xl font-mono font-bold text-[#25D366] tracking-widest">{waGenCode}</code>
                        <button onClick={() => { navigator.clipboard.writeText(waGenCode); toast.success('Code copied!') }}
                          className="text-[#848e9c] hover:text-[#25D366] transition">
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 space-y-1.5">
                      <p className="text-[10px] text-[#848e9c] font-semibold">How to connect:</p>
                      <ol className="text-[10px] text-[#848e9c] space-y-1 list-decimal list-inside">
                        <li>Open WhatsApp on your phone</li>
                        <li>Message <span className="text-[#25D366] font-mono font-semibold">+1 415 523 8886</span></li>
                        <li>Send the message: <span className="text-[#f0b90b] font-mono font-semibold">{waGenCode}</span></li>
                        <li>Wait for confirmation — your account links automatically</li>
                      </ol>
                    </div>
                    <button onClick={handleGenerateWaCode} disabled={waGenerating}
                      className="w-full border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] py-2 rounded-lg text-xs transition">
                      {waGenerating ? 'Generating…' : 'Generate a new code'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}



/* ─────────────────────────── SECURITY TAB ─────────────────────────── */
function TwoFactorSection({ user }: { user: UserProfile | null }) {
  const prefs = (user as any)?.notification_preferences || {}
  const [enabled, setEnabled]             = useState<boolean>(!!prefs.tfa_enabled)
  const [method, setMethod]               = useState<string>(prefs.tfa_method || 'telegram')
  const [recoveryEmail, setRecoveryEmail] = useState<string>(prefs.recovery_email || '')
  const [saving, setSaving]               = useState(false)

  const hasTelegram = !!(user as any)?.telegram_connected || !!prefs.telegram_chat_id

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (method === 'telegram' && !hasTelegram) {
      return toast.error('Connect your Telegram first in the FinAPI tab')
    }
    setSaving(true)
    try {
      await setup2fa({ tfa_method: method, recovery_email: recoveryEmail || undefined })
      setEnabled(true)
      toast.success('Two-factor authentication enabled')
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || 'Failed to enable 2FA')
    } finally { setSaving(false) }
  }

  const handleDisable = async () => {
    setSaving(true)
    try {
      await disable2fa()
      setEnabled(false)
      toast.success('Two-factor authentication disabled')
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || 'Failed to disable 2FA')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
        <Smartphone size={13} className="text-[#f0b90b]" />
        <span className="text-xs font-semibold text-[#eaecef]">Two-Factor Authentication (2FA)</span>
        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${enabled ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-[11px] text-[#848e9c] leading-relaxed">
          Add an extra layer of protection. When enabled, a verification code will be sent to your chosen channel every time you log in.
        </p>

        {enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-[#0ecb81]/8 border border-[#0ecb81]/20 rounded-lg px-3 py-2.5">
              <CheckCircle size={14} className="text-[#0ecb81] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#eaecef]">2FA is active</p>
                <p className="text-[10px] text-[#848e9c]">
                  Method: <span className="text-[#eaecef]">{method === 'telegram' ? '📱 Telegram' : '✉️ Email'}</span>
                  {recoveryEmail && <> · Recovery: <span className="text-[#eaecef]">{recoveryEmail}</span></>}
                </p>
              </div>
            </div>
            <button onClick={handleDisable} disabled={saving}
              className="text-xs bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/30 font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-60">
              {saving ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            {/* Method selector */}
            <div>
              <p className="text-[11px] font-semibold text-[#848e9c] mb-2">Verification method</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'telegram', label: '📱 Telegram', sub: 'Via your linked bot' },
                  { value: 'email',    label: '✉️ Email',    sub: 'Via your account email' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setMethod(opt.value)}
                    className={`text-left px-3 py-2.5 rounded-lg border transition text-xs ${method === opt.value ? 'border-[#f0b90b] bg-[#f0b90b]/8 text-[#eaecef]' : 'border-[#2b3139] text-[#848e9c] hover:border-[#3c4451]'}`}>
                    <p className="font-semibold">{opt.label}</p>
                    <p className="text-[10px] opacity-70">{opt.sub}</p>
                  </button>
                ))}
              </div>
              {method === 'telegram' && !hasTelegram && (
                <p className="text-[10px] text-[#f6465d] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={10} /> Connect Telegram first in the FinAPI tab
                </p>
              )}
            </div>

            {/* Recovery email */}
            <div>
              <label className="text-[11px] font-semibold text-[#848e9c] block mb-1.5">
                Recovery Email <span className="font-normal opacity-60">(optional)</span>
              </label>
              <input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)}
                placeholder="backup@example.com"
                className={inp} />
              <p className="text-[10px] text-[#848e9c] mt-1">Used for account recovery if you lose access to your 2FA method.</p>
            </div>

            <button type="submit" disabled={saving || (method === 'telegram' && !hasTelegram)}
              className="bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-5 py-2.5 rounded-lg text-xs transition">
              {saving ? 'Enabling…' : 'Enable 2FA'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}


function SecurityTab({ user }: { user: UserProfile | null }) {
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
    <div className="space-y-4">

      {/* Change Password */}
      <form onSubmit={handleChangePw} className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
          <Lock size={13} className="text-[#f0b90b]" />
          <span className="text-xs font-semibold text-[#eaecef]">Change Password</span>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Current Password">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={currentPw}
                onChange={e => setCurrentPw(e.target.value)} required placeholder="••••••••" className={`${inp} pr-10`} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]">
                {showPw ? <EyeOff size={13}/> : <Eye size={13}/>}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="New Password">
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required placeholder="Min 8 characters" className={inp} />
            </Field>
            <Field label="Confirm Password">
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required placeholder="Repeat new password" className={inp} />
            </Field>
          </div>
          <button type="submit" disabled={savingPw}
            className="bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-5 py-2.5 rounded-lg text-xs transition">
            {savingPw ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* Transfer PIN */}
      <form onSubmit={handleSetPin} className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
          <Shield size={13} className="text-[#f0b90b]" />
          <span className="text-xs font-semibold text-[#eaecef]">Transfer PIN</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-[#848e9c]">4–6 digit PIN required to authorise wallet transfers and withdrawals.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="PIN (4–6 digits)">
              <input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className={inp} />
            </Field>
            <Field label="Confirm PIN">
              <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className={inp} />
            </Field>
          </div>
          <button type="submit" disabled={savingPin}
            className="bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-5 py-2.5 rounded-lg text-xs transition">
            {savingPin ? 'Setting…' : 'Set Transfer PIN'}
          </button>
        </div>
      </form>

      {/* Two-Factor Authentication */}
      <TwoFactorSection user={user} />

      {/* Delete Account */}
      <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#f6465d]/10">
          <LogOut size={13} className="text-[#f6465d]" />
          <span className="text-xs font-semibold text-[#f6465d]">Delete My Account</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-[#848e9c]">
            Submitting this request notifies the admin. Your account and data will be permanently deleted after approval (24–48h). Any remaining balance will be processed per our policy.
          </p>
          {!showDelConfirm ? (
            <button onClick={() => setShowDelConfirm(true)}
              className="text-xs bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/30 font-semibold px-4 py-2.5 rounded-lg transition">
              Request Account Deletion
            </button>
          ) : (
            <div className="bg-[#0b0e11] border border-[#f6465d]/30 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-[#eaecef]">Are you sure? This cannot be undone.</p>
              <p className="text-[11px] text-[#848e9c]">Account: <span className="text-[#eaecef]">{user?.email}</span></p>
              <div className="flex gap-2">
                <button onClick={handleRequestDelete} disabled={deleting}
                  className="flex-1 bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-xs transition">
                  {deleting ? 'Submitting…' : 'Yes, Submit Request'}
                </button>
                <button onClick={() => setShowDelConfirm(false)}
                  className="flex-1 bg-[#2b3139] hover:bg-[#3c4451] text-[#eaecef] font-semibold py-2.5 rounded-lg text-xs transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
