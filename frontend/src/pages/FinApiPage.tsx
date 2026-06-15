import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  createApiKey, listApiKeys, revokeApiKey,
  connectExchange, disconnectExchange, getMe,
  generateWhatsAppCode, disconnectWhatsApp, disconnectTelegram, generateTelegramCode,
} from '../lib/api'
import toast from 'react-hot-toast'
import {
  Key, Plus, Trash2, Eye, EyeOff, Copy, AlertCircle, Send, MessageCircle,
  Wifi, RefreshCw, CheckCircle, Zap, Lock, ChevronLeft,
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
  const [waGenCode, setWaGenCode]   = useState<string | null>(null)
  const [waGenerating, setWaGenerating] = useState(false)

  const selectedExch = EXCHANGES.find(e => e.id === selExchange)
  const connections  = (user?.exchange_connections as { exchange: string; label?: string; api_key_masked?: string }[]) || []
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
      toast.success('Code generated — send to our WhatsApp number!')
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
                    <div key={c.exchange} className="flex items-center justify-between bg-[#0b0e11] border border-[#0ecb81]/20 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {exch?.logo
                          ? <img src={exch.logo} alt={exch.label} className="w-6 h-6 rounded-full object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          : <div className="w-6 h-6 rounded-full bg-[#2b3139] flex-shrink-0" />}
                        <div>
                          <p className="text-xs font-medium text-[#eaecef]">{c.label || c.exchange}</p>
                          <p className="text-[10px] text-[#848e9c] font-mono">{c.api_key_masked}</p>
                        </div>
                        <CheckCircle size={12} className="text-[#0ecb81]" />
                      </div>
                      <button onClick={() => handleDisconnect(c.exchange)}
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
                <button type="submit" disabled={connecting}
                  className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-lg text-xs transition">
                  {connecting ? 'Connecting…' : `Connect ${selectedExch?.label}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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
                  <button onClick={handleDisconnectWa} className="w-full border border-[#f6465d]/30 hover:bg-[#f6465d]/10 text-[#f6465d] font-medium py-2 rounded-lg text-xs transition">
                    Disconnect WhatsApp
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-[#848e9c]">Connect WhatsApp to receive trade alerts and signals.</p>
                  {!waGenCode ? (
                    <button onClick={handleGenerateWaCode} disabled={waGenerating}
                      className="w-full bg-[#25D366]/20 hover:bg-[#25D366]/30 disabled:opacity-50 border border-[#25D366]/30 text-[#25D366] font-semibold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2">
                      {waGenerating ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Send size={12} /> Generate WhatsApp Code</>}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-[#25D366]/8 border border-[#25D366]/20 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] text-[#848e9c] font-semibold uppercase tracking-wider">Your code</p>
                        <div className="flex items-center gap-3">
                          <code className="text-xl font-mono font-bold text-[#25D366] tracking-widest">{waGenCode}</code>
                          <button onClick={() => { navigator.clipboard.writeText(waGenCode); toast.success('Code copied!') }}
                            className="text-[#848e9c] hover:text-[#25D366] transition"><Copy size={13} /></button>
                        </div>
                      </div>
                      <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 space-y-1.5">
                        <p className="text-[10px] text-[#848e9c] font-semibold">How to connect:</p>
                        <ol className="text-[10px] text-[#848e9c] space-y-1 list-decimal list-inside">
                          <li>Open WhatsApp on your phone</li>
                          <li>Message <span className="text-[#25D366] font-mono font-semibold">+1 415 523 8886</span></li>
                          <li>Send: <span className="text-[#f0b90b] font-mono font-semibold">{waGenCode}</span></li>
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
