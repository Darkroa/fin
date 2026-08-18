import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  createApiKey, listApiKeys, revokeApiKey,
  connectExchange, disconnectExchange, getMe,
  disconnectWhatsApp, disconnectTelegram, generateTelegramCode,
  sendWhatsAppCode, verifyWhatsApp,
} from '../lib/api'
import toast from 'react-hot-toast'
import {
  Key, Plus, Trash2, Eye, EyeOff, Copy, AlertCircle, Send, MessageCircle,
  RefreshCw, CheckCircle, Zap, Lock, ChevronLeft,
} from 'lucide-react'

interface ApiKey { id: number; key_name: string; purpose: string; api_key: string; is_active: boolean; created_at: string; last_used_at?: string }
const EXCHANGES = [
  { id: 'binance',  label: 'Binance',  logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg',   hasPassphrase: false },
  { id: 'bybit',    label: 'Bybit',    logo: 'https://assets.coingecko.com/markets/images/698/small/bybit_spot.jpg', hasPassphrase: false },
  { id: 'kucoin',   label: 'KuCoin',   logo: 'https://assets.coingecko.com/markets/images/61/small/kucoin.jpg',     hasPassphrase: true  },
  { id: 'okx',      label: 'OKX',      logo: 'https://assets.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png', hasPassphrase: true },
  { id: 'kraken',   label: 'Kraken',   logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg',     hasPassphrase: false },
  { id: 'coinbase', label: 'Coinbase', logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png', hasPassphrase: false },
]

const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'

export default function FinApiPage() {
  const navigate  = useNavigate()
  const { user, setUser } = useAuthStore()
  const isFreeUser = !user?.subscription || user.subscription === 'free'

  const [apiKeys, setApiKeys]         = useState<ApiKey[]>([])
  const [keysLoaded, setKeysLoaded]   = useState(false)
  const [newKeyName, setNewKeyName]   = useState('')
  const [createdKey, setCreatedKey]   = useState<string | null>(null)
  const [creatingKey, setCreatingKey] = useState(false)

  const [selExchange, setSelExchange] = useState('')
  const [exchApiKey, setExchApiKey]   = useState('')
  const [exchSecret, setExchSecret]   = useState('')
  const [exchPass, setExchPass]       = useState('')
  const [exchIsDemo, setExchIsDemo]   = useState(false)
  const [showSecret, setShowSecret]   = useState(false)
  const [connecting, setConnecting]   = useState(false)

  const prefs = (user?.notification_preferences as unknown as Record<string, unknown>) || {}
  const tgVerified     = prefs.telegram_verified === true
  const tgLinkedName   = (prefs.telegram_first_name as string) || ''
  const tgLinkedChatId = (prefs.telegram_chat_id as string) || ''
  const [tgCode, setTgCode] = useState<string | null>(null)
  const [generatingTgCode, setGeneratingTgCode] = useState(false)

  const waVerified = prefs.whatsapp_verified === true
  const waPhone    = (prefs.whatsapp_number as string) || ''
  const [waPhoneInput, setWaPhoneInput]   = useState('')
  const [waOtpInput, setWaOtpInput]       = useState('')
  const [waSending, setWaSending]         = useState(false)
  const [waVerifying, setWaVerifying]     = useState(false)
  const [waCodeSent, setWaCodeSent]       = useState(false)

  const selectedExch = EXCHANGES.find(e => e.id === selExchange)
  const connections  = (user?.exchange_connections as {
    exchange: string; label?: string; api_key_masked?: string; broker?: string;
    server?: string; status?: string; is_demo?: boolean; allow_live_trading?: boolean
  }[]) || []
  const canCreateKey = user?.is_mail_verified && (user?.account_tier ?? 0) >= 1

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
      const res = await createApiKey(newKeyName.trim(), 'bot')
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
      await connectExchange({ exchange: selExchange, api_key: exchApiKey, api_secret: exchSecret, passphrase: exchPass || undefined, label: selectedExch?.label, is_demo: exchIsDemo })
      const res = await getMe()
      setUser(res.data)
      toast.success(`${selectedExch?.label} connected${exchIsDemo ? ' (Demo/Testnet)' : ''}!`)
      setExchApiKey(''); setExchSecret(''); setExchPass(''); setSelExchange(''); setExchIsDemo(false)
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to connect')
    } finally { setConnecting(false) }
  }

  const handleDisconnect = async (exchange: string, label?: string) => {
    try {
      await disconnectExchange(exchange, label)
      const res = await getMe()
      setUser(res.data)
      toast.success(`${label || exchange} disconnected`)
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

  const handleSendWaCode = async () => {
    const phone = waPhoneInput.trim()
    if (!phone) return toast.error('Enter your phone number with country code (e.g. +15551234567)')
    setWaSending(true)
    try {
      await sendWhatsAppCode(phone)
      setWaCodeSent(true)
      toast.success('Verification code sent to your WhatsApp!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to send code')
    } finally { setWaSending(false) }
  }

  const handleVerifyWaCode = async () => {
    const code = waOtpInput.trim()
    if (!code) return toast.error('Enter the 6-digit code')
    setWaVerifying(true)
    try {
      await verifyWhatsApp(code)
      const res = await getMe()
      setUser(res.data)
      setWaCodeSent(false)
      setWaOtpInput('')
      setWaPhoneInput('')
      toast.success('WhatsApp connected!')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Invalid or expired code')
    } finally { setWaVerifying(false) }
  }

  const handleDisconnectWa = async () => {
    try {
      await disconnectWhatsApp()
      const res = await getMe()
      setUser(res.data)
      setWaCodeSent(false)
      setWaPhoneInput('')
      setWaOtpInput('')
      toast.success('WhatsApp disconnected')
    } catch { toast.error('Failed to disconnect') }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-[#161a1e] border border-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition">
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">FinAPI</h1>
          <p className="text-xs text-[#848e9c]">API keys, exchange connections &amp; alert channels</p>
        </div>
      </div>

      {/* ── API Keys ── */}
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
                  <Copy size={13} />
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="text-[10px] text-[#848e9c] mt-2 hover:text-[#eaecef]">Dismiss</button>
            </div>
          )}

          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} required disabled={!canCreateKey}
              placeholder="Bot name (e.g. My Trading Bot)"
              className="flex-1 min-w-0 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition disabled:opacity-50" />
            <button type="submit" disabled={creatingKey || !canCreateKey}
              className="flex items-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-4 py-2 rounded-lg text-xs transition whitespace-nowrap">
              <Plus size={12} />{creatingKey ? 'Creating…' : 'Create Key'}
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
                          <Trash2 size={11} />
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

      {/* ── Exchange Connections ── */}
      {isFreeUser ? (
        <div className="relative rounded-xl overflow-hidden">
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden opacity-25 pointer-events-none select-none">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
              <Zap size={13} className="text-[#f0b90b]" />
              <span className="text-xs font-semibold text-[#eaecef]">Exchange Connections</span>
            </div>
            <div className="p-4"><div className="h-24 bg-[#2b3139]/60 rounded-xl" /></div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
            <Lock size={16} className="text-[#f0b90b]" />
            <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
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
                    <div key={`${c.exchange}:${c.label}`} className="flex items-center justify-between bg-[#0b0e11] border border-[#0ecb81]/20 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {exch?.logo
                          ? <img src={exch.logo} alt={exch.label} className="w-6 h-6 rounded-full object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          : <div className="w-6 h-6 rounded-full bg-[#2b3139] flex-shrink-0" />}
                        <div>
                          <p className="text-xs font-medium text-[#eaecef]">{c.label || c.exchange}</p>
                          <p className="text-[10px] text-[#848e9c] font-mono">
                            {c.exchange.toLowerCase() === 'mt5' ? `${c.broker || 'MT5'} · ${c.server || 'server pending'}` : c.api_key_masked}
                          </p>
                        </div>
                        <CheckCircle size={12} className="text-[#0ecb81]" />
                      </div>
                      <button onClick={() => handleDisconnect(c.exchange, c.label)}
                        className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                        <Trash2 size={12} />
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
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            {selExchange && (
              <form onSubmit={handleConnect} className="space-y-3 border-t border-[#2b3139] pt-4">
                <div>
                  <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">API Key *</label>
                  <input value={exchApiKey} onChange={e => setExchApiKey(e.target.value)} required placeholder="API key" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">API Secret *</label>
                  <div className="relative">
                    <input type={showSecret ? 'text' : 'password'} value={exchSecret}
                      onChange={e => setExchSecret(e.target.value)} required placeholder="API secret" className={`${inp} pr-10`} />
                    <button type="button" onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]">
                      {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                {selectedExch?.hasPassphrase && (
                  <div>
                    <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">Passphrase</label>
                    <input type="password" value={exchPass} onChange={e => setExchPass(e.target.value)} placeholder="Passphrase" className={inp} />
                  </div>
                )}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={exchIsDemo} onChange={e => setExchIsDemo(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#f0b90b] cursor-pointer" />
                  <span className="text-xs text-[#848e9c]">Demo / Testnet keys <span className="text-[#f0b90b]">(sandbox)</span></span>
                </label>
                <button type="submit" disabled={connecting}
                  className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-lg text-xs transition">
                  {connecting ? 'Connecting…' : `Connect ${selectedExch?.label}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MT5 dashboard moved to /app/mt-dashboard.
      {isFreeUser ? (
        <div className="relative rounded-xl overflow-hidden">
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden opacity-25 pointer-events-none select-none">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
              <BarChart3 size={13} className="text-[#f0b90b]" />
              <span className="text-xs font-semibold text-[#eaecef]">MT5 Broker Accounts</span>
            </div>
            <div className="p-4"><div className="h-24 bg-[#2b3139]/60 rounded-xl" /></div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
            <Lock size={16} className="text-[#f0b90b]" />
            <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
            <button onClick={() => navigate('/app/pricing')}
              className="mt-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-[10px] px-4 py-1.5 rounded-lg transition">
              Upgrade Now
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
            <BarChart3 size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">MT5 Broker Accounts</span>
            <span className="ml-auto text-[10px] text-[#848e9c]">FBS · Octa · Exness · more</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-2 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-lg px-3 py-2.5">
              <ShieldAlert size={13} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#848e9c]">
                Use your MT5 account number, exact broker server, and trading password. We never ask for your broker website password.
                Live orders stay disabled until you explicitly enable them.
              </p>
            </div>

            {mt5Connections.length > 0 && (
              <div className="space-y-2">
                {mt5Connections.map(c => (
                  <div key={c.label} className={`bg-[#0b0e11] rounded-lg px-3 py-2.5 space-y-2 border ${c.label === activeMt5Connection?.label ? 'border-[#f0b90b]/50' : 'border-[#0ecb81]/20'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => { setMt5ActiveLabel(c.label || ''); setMt5AccountData(null); setMt5Markets([]); setMt5SelectedSymbol('') }}
                        className="flex items-center gap-2.5 min-w-0 text-left">
                        <div className="w-7 h-7 rounded-full bg-[#f0b90b]/15 flex items-center justify-center flex-shrink-0">
                          <BarChart3 size={13} className="text-[#f0b90b]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#eaecef] truncate">{c.label || c.broker || 'MT5 account'}</p>
                          <p className="text-[10px] text-[#848e9c] font-mono truncate">
                            {c.broker || 'MT5'} · {c.server || 'server pending'} · {c.is_demo ? 'Demo' : 'Live'}
                          </p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${c.status === 'pending_bridge' ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'bg-[#0ecb81]/10 text-[#0ecb81]'}`}>
                          {c.status === 'pending_bridge' ? 'Bridge pending' : 'Saved'}
                        </span>
                        {c.label === activeMt5Connection?.label && <span className="text-[9px] text-[#f0b90b]">Active</span>}
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => c.label && handleLoadMt5Account(c.label)} disabled={mt5LoadingAccount}
                          className="flex items-center gap-1 text-[10px] text-[#0ecb81] hover:bg-[#0ecb81]/10 px-2 py-1.5 rounded-lg transition disabled:opacity-50">
                          <RefreshCw size={10} className={mt5LoadingAccount ? 'animate-spin' : ''} /> Sync
                        </button>
                        <button onClick={() => handleDisconnect('mt5', c.label)}
                          className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleMt5Connect} className="space-y-3 border-t border-[#2b3139] pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">Broker *</label>
                  <select value={mt5Broker} onChange={e => setMt5Broker(e.target.value)} className={inp}>
                    {MT5_BROKERS.map(broker => <option key={broker} value={broker}>{broker}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">Connection name</label>
                  <input value={mt5Label} onChange={e => setMt5Label(e.target.value)} placeholder="e.g. Exness main" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">MT5 account number *</label>
                  <input value={mt5Account} onChange={e => setMt5Account(e.target.value)} inputMode="numeric" required placeholder="e.g. 12345678" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">MT5 server *</label>
                  <input value={mt5Server} onChange={e => setMt5Server(e.target.value)} required placeholder="e.g. Exness-MT5Real" className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#848e9c] mb-1.5 block">MT5 trading password *</label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={mt5Password} onChange={e => setMt5Password(e.target.value)} required
                    placeholder="Trading password (not investor password)" className={`${inp} pr-10`} />
                  <button type="button" onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]">
                    {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-[#848e9c] cursor-pointer">
                  <input type="checkbox" checked={mt5Demo} onChange={e => { setMt5Demo(e.target.checked); if (e.target.checked) setMt5LiveTrading(false) }}
                    className="w-4 h-4 rounded accent-[#f0b90b]" />
                  Demo account
                </label>
                <label className={`flex items-center gap-2 text-xs cursor-pointer ${mt5Demo ? 'text-[#4a5568]' : 'text-[#f6465d]'}`}>
                  <input type="checkbox" checked={mt5LiveTrading} disabled={mt5Demo} onChange={e => setMt5LiveTrading(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#f6465d]" />
                  Enable live trading
                </label>
              </div>
              <button type="submit" disabled={mt5Connecting}
                className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-lg text-xs transition">
                {mt5Connecting ? 'Saving MT5 connection…' : 'Save MT5 Broker Connection'}
              </button>
            </form>

            {mt5Connections.length > 0 && (
              <div className="border-t border-[#2b3139] pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <WalletCards size={13} className="text-[#0ecb81]" />
                  <span className="text-xs font-semibold text-[#eaecef]">MT5 dashboard</span>
                  <span className="text-[10px] text-[#848e9c]">{activeMt5Connection?.label || 'Select an account'} · balance · markets · AI · orders</span>
                </div>
                {mt5AccountData && (
                  mt5AccountData.unavailable ? (
                    <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-[#f0b90b]">Balance sync is waiting for the MT5 bridge</p>
                      <p className="text-[10px] text-[#848e9c] mt-1">The account details were saved safely, but live balance and positions will only appear after the server-side MT5 terminal bridge is configured.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {([
                         ['Balance', mt5AccountData.balance ?? '—'],
                        ['Equity', mt5AccountData.equity ?? '—'],
                        ['Free margin', mt5AccountData.free_margin ?? '—'],
                         ['Margin level', mt5AccountData.margin_level != null ? `${mt5AccountData.margin_level.toFixed(2)}%` : '—'],
                        ['Open positions', mt5AccountData.open_positions ?? '—'],
                         ['Currency', mt5AccountData.currency ?? '—'],
                      ] as Array<[string, unknown]>).map(([label, value]) => (
                        <div key={label} className="bg-[#0b0e11] border border-[#2b3139] rounded-lg p-2.5">
                          <p className="text-[9px] text-[#848e9c] uppercase tracking-wide">{label}</p>
                          <p className="text-sm font-semibold text-[#eaecef] mt-1 truncate">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}
                {mt5AccountData && !mt5AccountData.unavailable && mt5AccountData.last_sync_at && (
                  <p className="text-[10px] text-[#848e9c]">
                    Last bridge sync: {new Date(mt5AccountData.last_sync_at).toLocaleString()}
                  </p>
                )}
                {mt5AccountData?.positions && mt5AccountData.positions.length > 0 && (
                  <div className="border border-[#2b3139] rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-[#1a1f25] text-[10px] font-semibold text-[#eaecef]">Open positions</div>
                    <div className="divide-y divide-[#2b3139]">
                      {mt5AccountData.positions.slice(0, 10).map(position => (
                        <div key={position.ticket} className="flex items-center justify-between px-3 py-2 text-[10px]">
                          <span className="font-semibold text-[#eaecef]">{position.symbol || '—'} · {position.side || '—'} · {position.volume ?? '—'} lots</span>
                          <span className={Number(position.profit) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                            {position.profit != null ? Number(position.profit).toFixed(2) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleMt5MarketSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" />
                    <input value={mt5Search} onChange={e => setMt5Search(e.target.value)} placeholder="Search MT5 symbols (EURUSD, XAUUSD…)" className={`${inp} pl-9`} />
                  </div>
                  <button type="submit" className="px-3 rounded-lg bg-[#2b3139] hover:bg-[#3c4451] text-[#eaecef] text-xs transition">Search</button>
                </form>
                 {!mt5Markets.length && (
                   <p className="text-[10px] text-[#848e9c] border border-dashed border-[#2b3139] rounded-lg px-3 py-3">
                     Search the active account to load its broker-specific symbols and live bid/ask quotes. No fallback prices are shown.
                   </p>
                 )}
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mt5Markets.filter(m => !mt5Search || m.symbol.toLowerCase().includes(mt5Search.toLowerCase()) || m.name?.toLowerCase().includes(mt5Search.toLowerCase())).map(m => (
                    <button type="button" key={m.symbol} onClick={() => setMt5SelectedSymbol(m.symbol)}
                      className={`text-left rounded-lg border px-3 py-2 transition ${mt5SelectedSymbol === m.symbol ? 'border-[#f0b90b] bg-[#f0b90b]/10' : 'border-[#2b3139] hover:border-[#3c4451]'}`}>
                      <p className="text-xs font-semibold text-[#eaecef]">{m.symbol}</p>
                       <p className="text-[10px] text-[#848e9c] truncate">
                         {m.name || m.type || 'MT5 market'}
                         {m.bid != null && m.ask != null ? ` · ${m.bid} / ${m.ask}` : ' · quote unavailable'}
                       </p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#0b0e11] border border-[#2b3139] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                       <p className="text-xs font-semibold text-[#eaecef]">Fin AI analysis · {mt5SelectedSymbol || 'select a symbol'}</p>
                      <BarChart3 size={13} className="text-[#f0b90b]" />
                    </div>
                     <p className="text-[10px] text-[#848e9c]">AI reviews the selected broker quote, trend, momentum, levels, risk, and invalidation before any order is sent.</p>
                    <button type="button" onClick={handleMt5Analysis} disabled={mt5Analyzing}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#2b3139] hover:bg-[#3c4451] disabled:opacity-60 text-[#eaecef] py-2 rounded-lg text-xs transition">
                      <Play size={11} />{mt5Analyzing ? 'Analyzing…' : 'Analyze market with Fin AI'}
                    </button>
                    {mt5Analysis && <p className="text-[11px] text-[#c7d0d9] whitespace-pre-wrap max-h-52 overflow-y-auto border-t border-[#2b3139] pt-2">{mt5Analysis}</p>}
                  </div>
                  <div className="bg-[#0b0e11] border border-[#2b3139] rounded-lg p-3 space-y-2">
                     <p className="text-xs font-semibold text-[#eaecef]">Trade {mt5SelectedSymbol || 'select a symbol'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex gap-1">
                        {(['buy', 'sell'] as const).map(side => (
                          <button type="button" key={side} onClick={() => setMt5OrderSide(side)}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase ${mt5OrderSide === side ? (side === 'buy' ? 'bg-[#0ecb81] text-[#06120d]' : 'bg-[#f6465d] text-white') : 'bg-[#2b3139] text-[#848e9c]'}`}>{side}</button>
                        ))}
                      </div>
                      <input value={mt5Volume} onChange={e => setMt5Volume(e.target.value)} type="number" min="0.01" step="0.01" placeholder="Lots" className={inp} />
                      <input value={mt5StopLoss} onChange={e => setMt5StopLoss(e.target.value)} type="number" step="any" placeholder="Stop loss (optional)" className={inp} />
                      <input value={mt5TakeProfit} onChange={e => setMt5TakeProfit(e.target.value)} type="number" step="any" placeholder="Take profit (optional)" className={inp} />
                    </div>
                    <button type="button" onClick={handleMt5Order} disabled={mt5Ordering}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2 rounded-lg text-xs transition">
                       <Play size={11} />{mt5Ordering ? 'Sending…' : activeMt5Connection?.is_demo ? 'Place demo order' : 'Place live order'}
                    </button>
                    <p className="text-[10px] text-[#848e9c]">Every order requires a final confirmation. Add stop-loss and take-profit before trading.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      */}

      {/* ── Alert Channels ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
          <MessageCircle size={13} className="text-[#f0b90b]" />
          <span className="text-xs font-semibold text-[#eaecef]">Alert Channels</span>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-[11px] text-[#848e9c]">Connect Telegram and WhatsApp to receive real-time trade alerts and AI signals.</p>

          {/* Telegram */}
          {isFreeUser ? (
            <div className="relative rounded-xl overflow-hidden">
              <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 opacity-25 pointer-events-none select-none">
                <div className="h-16 bg-[#229ED9]/10 rounded-lg" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
                <Lock size={16} className="text-[#f0b90b]" />
                <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
                <button onClick={() => navigate('/app/pricing')} className="mt-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-[10px] px-4 py-1.5 rounded-lg transition">Upgrade Now</button>
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
                  <button onClick={handleDisconnectTelegram} className="w-full border border-[#f6465d]/30 hover:bg-[#f6465d]/10 text-[#f6465d] font-medium py-2 rounded-lg text-xs transition">
                    Disconnect Telegram
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <ol className="text-[10px] text-[#848e9c] space-y-1 list-decimal list-inside">
                    <li>Search for <span className="text-[#229ED9] font-mono">@FinAitradebot</span> on Telegram</li>
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
                            className="p-1 text-[#229ED9] hover:bg-[#229ED9]/10 rounded-lg transition"><Copy size={13} /></button>
                        </div>
                      </div>
                      <a href="https://t.me/FinAitradebot" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#229ED9] hover:bg-[#1a8bc4] text-white font-semibold py-2.5 rounded-lg text-xs transition">
                        <Send size={12} /> Open @FinAitradebot
                      </a>
                      <button onClick={() => setTgCode(null)} className="w-full text-xs text-[#848e9c] hover:text-[#eaecef] py-1 transition">Generate new code</button>
                    </div>
                  ) : (
                    <button onClick={handleGenerateTgCode} disabled={generatingTgCode}
                      className="w-full bg-[#229ED9]/20 hover:bg-[#229ED9]/30 disabled:opacity-50 border border-[#229ED9]/30 text-[#229ED9] font-semibold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2">
                      {generatingTgCode ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Send size={12} /> Generate Telegram Code</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {isFreeUser ? (
            <div className="relative rounded-xl overflow-hidden">
              <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 opacity-25 pointer-events-none select-none">
                <div className="h-16 bg-[#25D366]/10 rounded-lg" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0e11]/80 rounded-xl">
                <Lock size={16} className="text-[#f0b90b]" />
                <p className="text-xs font-bold text-[#eaecef]">Pro Plan Required</p>
                <button onClick={() => navigate('/app/pricing')} className="mt-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-[10px] px-4 py-1.5 rounded-lg transition">Upgrade Now</button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={12} className="text-[#25D366]" />
                  <span className="text-xs font-semibold text-[#eaecef]">WhatsApp</span>
                </div>
                {waVerified && (
                  <span className="flex items-center gap-1 text-[10px] text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/20 px-2 py-0.5 rounded-full">
                    <CheckCircle size={9} /> Connected
                  </span>
                )}
              </div>

              {/* Connected state */}
              {waVerified ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#0ecb81]/8 border border-[#0ecb81]/15 rounded-lg px-3 py-2.5">
                    <CheckCircle size={13} className="text-[#0ecb81] flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#eaecef]">{waPhone || 'WhatsApp connected'}</p>
                      <p className="text-[10px] text-[#848e9c]">Alerts &amp; signals will be delivered here</p>
                    </div>
                  </div>
                  <button onClick={handleDisconnectWa} className="w-full border border-[#f6465d]/30 hover:bg-[#f6465d]/10 text-[#f6465d] font-medium py-2 rounded-lg text-xs transition">
                    Disconnect WhatsApp
                  </button>
                </div>
              ) : !waCodeSent ? (
                /* Step 1 — enter phone number */
                <div className="space-y-3">
                  <p className="text-[10px] text-[#848e9c]">Enter your WhatsApp number and we'll send you a 6-digit code to verify.</p>
                  <div className="flex gap-2">
                    <input
                      value={waPhoneInput}
                      onChange={e => setWaPhoneInput(e.target.value)}
                      placeholder="+15551234567 (with country code)"
                      className={`${inp} flex-1 min-w-0 text-xs`}
                      onKeyDown={e => e.key === 'Enter' && handleSendWaCode()}
                    />
                    <button
                      onClick={handleSendWaCode}
                      disabled={waSending || !waPhoneInput.trim()}
                      className="flex items-center gap-1.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 disabled:opacity-50 border border-[#25D366]/30 text-[#25D366] font-semibold px-3 py-2 rounded-lg text-xs transition whitespace-nowrap">
                      {waSending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                      {waSending ? 'Sending…' : 'Send Code'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2 — enter OTP */
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 border bg-[#25D366]/8 border-[#25D366]/20">
                    <CheckCircle size={12} className="flex-shrink-0 mt-0.5 text-[#25D366]" />
                    <p className="text-xs font-medium text-[#eaecef]">Code sent to {waPhoneInput}</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={waOtpInput}
                      onChange={e => setWaOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      maxLength={6}
                      className={`${inp} flex-1 min-w-0 text-sm font-mono tracking-widest`}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyWaCode()}
                    />
                    <button
                      onClick={handleVerifyWaCode}
                      disabled={waVerifying || waOtpInput.length < 6}
                      className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1da851] disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-lg text-xs transition whitespace-nowrap">
                      {waVerifying ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      {waVerifying ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                  <button
                    onClick={() => { setWaCodeSent(false); setWaOtpInput('') }}
                    className="w-full border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] py-1.5 rounded-lg text-[10px] transition">
                    ← Change number / resend
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
