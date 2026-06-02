import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useLanguage } from '../contexts/LanguageContext'
import { formatCurrency } from '../lib/i18n'
import {
  getWalletConfig, requestDeposit, requestWithdrawal,
  p2pSend, getMyTransactions, getMe, getVpsPlans, getAssetProducts,
  getMyDepositConfig,
} from '../lib/api'
import toast from 'react-hot-toast'
import { QRCode } from 'react-qr-code'
import {
  ArrowDownLeft, ArrowUpRight, Send, Copy, RefreshCw,
  Clock, CheckCircle, XCircle, Server, ShoppingBag, ChevronRight,
  ChevronLeft, AlertTriangle, Lock, Bitcoin,
} from 'lucide-react'

type WalletTab = 'deposit' | 'withdraw' | 'send' | 'vps' | 'asset'
type DepStep = 1 | 2 | 3

interface WalletCfg { [key: string]: { value: string; label: string } }
interface Tx {
  id: number; tx_type: string; method: string; asset: string
  amount_usdt: number; status: string; note?: string; created_at: string
}
interface VpsPlan { id: number; name: string; price: number; specs: string }
interface AssetProduct { id: number; name: string; price: number; icon: string }

const METHODS = [
  { key: 'crypto_btc',  label: 'Bitcoin (BTC)',   cfgKey: 'btc_address',  icon: '₿', color: 'text-[#f7931a]', bg: 'bg-[#f7931a]/10', border: 'border-[#f7931a]/20' },
  { key: 'crypto_eth',  label: 'Ethereum (ETH)',   cfgKey: 'eth_address',  icon: 'Ξ', color: 'text-[#627eea]', bg: 'bg-[#627eea]/10', border: 'border-[#627eea]/20' },
  { key: 'crypto_usdt', label: 'USDT (TRC-20)',    cfgKey: 'usdt_trc20',   icon: '₮', color: 'text-[#26a17b]', bg: 'bg-[#26a17b]/10', border: 'border-[#26a17b]/20' },
  { key: 'bank',        label: 'Bank Transfer',    cfgKey: 'bank_account', icon: 'B',  color: 'text-[#848e9c]', bg: 'bg-[#848e9c]/10', border: 'border-[#848e9c]/20' },
]

const DEFAULT_VPS: VpsPlan[] = [
  { id: 1,  name: 'DigitalOcean',     price: 6,  specs: '1 vCPU · 1GB RAM · 25GB SSD' },
  { id: 2,  name: 'Linode',           price: 5,  specs: '1 vCPU · 1GB RAM · 25GB SSD' },
  { id: 3,  name: 'Vultr',            price: 6,  specs: '1 vCPU · 1GB RAM · 25GB SSD' },
  { id: 4,  name: 'Kamatera',         price: 4,  specs: '1 vCPU · 1GB RAM · 20GB SSD' },
  { id: 5,  name: 'Liquid Web',       price: 15, specs: '1 vCPU · 2GB RAM · 40GB SSD' },
  { id: 6,  name: 'Hostinger',        price: 4,  specs: '1 vCPU · 1GB RAM · 20GB SSD' },
  { id: 7,  name: 'IONOS',            price: 5,  specs: '1 vCPU · 1GB RAM · 25GB SSD' },
  { id: 8,  name: 'ScalaHosting',     price: 10, specs: '1 vCPU · 2GB RAM · 50GB SSD' },
  { id: 9,  name: 'InMotion Hosting', price: 20, specs: '2 vCPU · 4GB RAM · 75GB SSD' },
  { id: 10, name: 'A2 Hosting',       price: 5,  specs: '1 vCPU · 1GB RAM · 25GB SSD' },
]

const DEFAULT_ASSETS: AssetProduct[] = [
  { id: 1, name: 'Bitcoin (BTC)',  price: 67432, icon: '₿' },
  { id: 2, name: 'Ethereum (ETH)', price: 3521,  icon: 'Ξ' },
  { id: 3, name: 'BNB',           price: 598,   icon: 'B' },
]

function txIcon(type: string) {
  switch (type) {
    case 'deposit':     return <ArrowDownLeft size={13} className="text-[#0ecb81]" />
    case 'withdrawal':  return <ArrowUpRight  size={13} className="text-[#f6465d]" />
    case 'p2p_send':    return <Send          size={13} className="text-[#f0b90b]" />
    case 'p2p_receive': return <ArrowDownLeft size={13} className="text-[#0ecb81]" />
    default:            return <RefreshCw     size={13} className="text-[#848e9c]" />
  }
}

function statusBadge(s: string) {
  if (s === 'completed' || s === 'approved')
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81]"><CheckCircle size={9} className="inline mr-0.5" />{s}</span>
  if (s === 'rejected' || s === 'failed')
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]"><XCircle size={9} className="inline mr-0.5" />{s}</span>
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]"><Clock size={9} className="inline mr-0.5" />pending</span>
}

export default function WalletPage() {
  const { user, setUser } = useAuthStore()
  const { currency } = useLanguage()
  const [tab, setTab] = useState<WalletTab>('deposit')
  const [cfg, setCfg] = useState<WalletCfg>({})
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [vpsPlans, setVpsPlans]       = useState<VpsPlan[]>(DEFAULT_VPS)
  const [assetProducts, setAssetProducts] = useState<AssetProduct[]>(DEFAULT_ASSETS)

  const [depStep, setDepStep]           = useState<DepStep>(1)
  const [depAmount, setDepAmount]       = useState('')
  const [depBtcRate, setDepBtcRate]     = useState<number | null>(null)
  const [depRateLoading, setDepRateLoading] = useState(false)
  const [depMethod, setDepMethod]       = useState('')
  const [depTxHash, setDepTxHash]       = useState('')
  const [depBankRef, setDepBankRef]     = useState('')
  const [depPaymentProof, setDepPaymentProof] = useState<string>('')
  const [depProofName, setDepProofName] = useState('')

  const [wdMethod, setWdMethod]   = useState('crypto_btc')
  const [wdAmount, setWdAmount]   = useState('')
  const [wdAddress, setWdAddress] = useState('')
  const [wdBankRef, setWdBankRef] = useState('')
  const [wdPin, setWdPin]         = useState('')
  const [showPin, setShowPin]     = useState(false)

  const [p2pEmail, setP2pEmail]   = useState('')
  const [p2pAmount, setP2pAmount] = useState('')
  const [p2pNote, setP2pNote]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([getWalletConfig(), getMyTransactions(), getVpsPlans(), getAssetProducts(), getMyDepositConfig().catch(() => ({data: {}}))])
      .then(([cfgRes, txRes, vpsRes, assetRes, myDepRes]) => {
        const globalCfg: WalletCfg = cfgRes.data || {}
        const userOverrides: Record<string, string> = myDepRes.data || {}
        // Merge user-specific overrides on top of global config
        const merged: WalletCfg = { ...globalCfg }
        for (const [k, v] of Object.entries(userOverrides)) {
          if (v && typeof v === 'string' && v.trim()) {
            merged[k] = { value: v, label: globalCfg[k]?.label || k }
          }
        }
        setCfg(merged)
        setTxs(Array.isArray(txRes.data) ? txRes.data : [])
        if (Array.isArray(vpsRes.data) && vpsRes.data.length > 0) setVpsPlans(vpsRes.data)
        if (Array.isArray(assetRes.data) && assetRes.data.length > 0) setAssetProducts(assetRes.data)
      })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false))
  }, [])

  const refreshBalance = async () => {
    try { const res = await getMe(); setUser(res.data) } catch { /* silent */ }
  }

  const fetchBtcRate = useCallback(async () => {
    setDepRateLoading(true)
    try {
      const res = await fetch('/api/public/prices')
      if (res.ok) {
        const data = await res.json()
        const btcPrice = data['BTC/USDT']?.price || data.bitcoin?.usd
        setDepBtcRate(btcPrice || 97000)
      } else {
        setDepBtcRate(97000)
      }
    } catch {
      setDepBtcRate(97000)
    } finally {
      setDepRateLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'deposit' && depStep === 1) fetchBtcRate()
  }, [tab, depStep, fetchBtcRate])

  const handleDepositSubmit = async () => {
    if (!depAmount || parseFloat(depAmount) <= 0) return toast.error('Enter a valid amount')
    if (!depMethod) return toast.error('Select a payment method')
    const method = METHODS.find(m => m.key === depMethod)
    setSubmitting(true)
    try {
      await requestDeposit({
        method: depMethod,
        asset: method?.label?.split(' ')[0] || 'USDT',
        amount_usdt: parseFloat(depAmount),
        tx_hash: depTxHash || undefined,
        bank_ref: depBankRef || undefined,
        payment_proof: depPaymentProof || undefined,
      })
      toast.success('Deposit request submitted — awaiting admin approval')
      setDepStep(1); setDepAmount(''); setDepMethod(''); setDepTxHash(''); setDepBankRef(''); setDepPaymentProof(''); setDepProofName('')
      const txRes = await getMyTransactions()
      setTxs(Array.isArray(txRes.data) ? txRes.data : [])
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wdAmount || parseFloat(wdAmount) <= 0) return toast.error('Enter a valid amount')
    if (!wdPin.trim()) return toast.error('Enter your transfer PIN')
    setSubmitting(true)
    try {
      await requestWithdrawal({
        method: wdMethod,
        asset: METHODS.find(m => m.key === wdMethod)?.label?.split(' ')[0] || 'USDT',
        amount_usdt: parseFloat(wdAmount),
        wallet_address: wdAddress || undefined,
        bank_ref: wdBankRef || undefined,
        transfer_pin: wdPin,
      })
      toast.success('Withdrawal request submitted')
      setWdAmount(''); setWdAddress(''); setWdBankRef(''); setWdPin('')
      await refreshBalance()
      const txRes = await getMyTransactions()
      setTxs(Array.isArray(txRes.data) ? txRes.data : [])
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Insufficient balance or invalid PIN')
    } finally { setSubmitting(false) }
  }

  const handleP2P = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!p2pEmail || !p2pAmount) return toast.error('Fill all fields')
    setSubmitting(true)
    try {
      await p2pSend({ recipient_email: p2pEmail, amount_usdt: parseFloat(p2pAmount), note: p2pNote || undefined })
      toast.success(`Sent $${p2pAmount} to ${p2pEmail}`)
      setP2pEmail(''); setP2pAmount(''); setP2pNote('')
      await refreshBalance()
      const txRes = await getMyTransactions()
      setTxs(Array.isArray(txRes.data) ? txRes.data : [])
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'
  const isCrypto = (method: string) => method !== 'bank'

  const depMethodObj = METHODS.find(m => m.key === depMethod)
  const depCfgKey    = depMethodObj?.cfgKey
  const depAddress   = depCfgKey ? (cfg[depCfgKey]?.value?.trim() ?? '') : ''
  const depConfigured = depMethod === 'bank'
    ? !!cfg['bank_account']?.value
    : !!depAddress

  const bankLogo = cfg['bank_logo']?.value || ''

  const tabs = [
    { key: 'deposit',  label: 'Deposit',   icon: ArrowDownLeft },
    { key: 'withdraw', label: 'Withdraw',  icon: ArrowUpRight },
    { key: 'send',     label: 'Send P2P',  icon: Send },
    { key: 'vps',      label: 'Rent VPS',  icon: Server },
    { key: 'asset',    label: 'Buy Asset', icon: ShoppingBag },
  ] as const

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Balance hero card */}
      <div className="relative bg-gradient-to-br from-[#1e2329] via-[#181d22] to-[#161a1e] border border-[#2b3139] rounded-2xl p-5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at top right, rgba(14,203,129,0.07) 0%, transparent 60%)' }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#848e9c] font-medium mb-1">Available Balance</p>
            <p className="text-3xl font-bold font-mono text-[#eaecef]">
              {formatCurrency(user?.balance_usdt ?? 0, currency)}
            </p>
            <p className="text-xs text-[#848e9c] mt-1">USDT · Updated just now</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setTab('deposit'); setDepStep(1) }} className="flex items-center gap-1.5 bg-[#0ecb81] hover:bg-[#0ab56f] text-black font-semibold text-xs px-4 py-2.5 rounded-xl transition">
              <ArrowDownLeft size={13} /> Deposit
            </button>
            <button onClick={() => setTab('withdraw')} className="flex items-center gap-1.5 bg-[#0b0e11] hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] font-semibold text-xs px-4 py-2.5 rounded-xl border border-[#2b3139] transition">
              <ArrowUpRight size={13} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Action tabs */}
      <div className="grid grid-cols-5 gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key as WalletTab); if (key === 'deposit') setDepStep(1) }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2.5 rounded-lg text-[10px] sm:text-xs font-medium transition ${tab === key ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
            <Icon size={13} /><span className="leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: form */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5">

          {/* ── DEPOSIT ── */}
          {tab === 'deposit' && (
            <div className="space-y-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${depStep >= s ? 'bg-[#f0b90b] text-black' : 'bg-[#2b3139] text-[#848e9c]'}`}>{s}</div>
                    {s < 3 && <div className={`flex-1 h-0.5 w-8 rounded ${depStep > s ? 'bg-[#f0b90b]' : 'bg-[#2b3139]'}`} />}
                  </div>
                ))}
                <span className="text-xs text-[#848e9c] ml-1">
                  {depStep === 1 ? 'Amount' : depStep === 2 ? 'Method' : 'Send & Confirm'}
                </span>
              </div>

              {/* Step 1 */}
              {depStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-[#eaecef]">How much do you want to deposit?</h2>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Amount (USDT) *</label>
                    <div className="relative">
                      <input
                        type="number" min="0" step="0.01"
                        value={depAmount}
                        onChange={e => setDepAmount(e.target.value)}
                        placeholder="0.00"
                        className={inp}
                        autoFocus
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#848e9c] font-semibold">USDT</span>
                    </div>
                  </div>

                  {depAmount && parseFloat(depAmount) > 0 && (
                    <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 space-y-1.5">
                      <p className="text-[10px] text-[#848e9c] font-semibold uppercase tracking-wider mb-2">Approximate conversions</p>
                      {depRateLoading ? (
                        <p className="text-xs text-[#4a5568]">Fetching rates…</p>
                      ) : depBtcRate ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#848e9c] flex items-center gap-1.5"><Bitcoin size={11} className="text-[#f7931a]" /> Bitcoin (BTC)</span>
                            <span className="text-xs font-mono text-[#eaecef]">≈ {(parseFloat(depAmount) / depBtcRate).toFixed(8)} BTC</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#848e9c]">Ξ Ethereum (ETH)</span>
                            <span className="text-xs font-mono text-[#eaecef]">≈ {(parseFloat(depAmount) / (depBtcRate / 30)).toFixed(6)} ETH</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#848e9c]">₮ USDT (TRC-20)</span>
                            <span className="text-xs font-mono text-[#eaecef]">= {parseFloat(depAmount).toFixed(2)} USDT</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!depAmount || parseFloat(depAmount) <= 0) return toast.error('Enter a valid amount')
                      setDepStep(2)
                    }}
                    className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    Next: Choose Payment Method <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Step 2 */}
              {depStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDepStep(1)} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#2b3139] transition">
                      <ChevronLeft size={14} />
                    </button>
                    <h2 className="text-sm font-semibold text-[#eaecef]">Select payment method</h2>
                  </div>
                  <p className="text-xs text-[#848e9c]">Depositing <span className="text-[#f0b90b] font-mono font-semibold">${parseFloat(depAmount || '0').toFixed(2)} USDT</span></p>

                  <div className="grid grid-cols-2 gap-2">
                    {METHODS.map(m => {
                      const configured = m.key === 'bank' ? !!cfg['bank_account']?.value : !!cfg[m.cfgKey]?.value?.trim()
                      return (
                        <button
                          key={m.key}
                          onClick={() => { setDepMethod(m.key); setDepStep(3) }}
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${depMethod === m.key ? `${m.border} ${m.bg}` : 'border-[#2b3139] hover:border-[#3c4451]'}`}
                        >
                          {!configured && (
                            <span className="absolute top-1.5 right-1.5 text-[8px] bg-[#848e9c]/20 text-[#848e9c] px-1 py-0.5 rounded font-medium">Unconfigured</span>
                          )}
                          <span className={`text-2xl ${m.color}`}>{m.icon}</span>
                          <span className="text-xs font-medium text-[#eaecef] text-center leading-tight">{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 3 — no method */}
              {depStep === 3 && !depMethodObj && (
                <div className="space-y-4">
                  <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-[#f6465d] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#f6465d]">No payment method selected</p>
                      <button onClick={() => setDepStep(2)} className="mt-3 text-xs text-[#f0b90b] hover:underline">← Choose a method</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 — with method */}
              {depStep === 3 && depMethodObj && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDepStep(2)} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#2b3139] transition">
                      <ChevronLeft size={14} />
                    </button>
                    <div>
                      <h2 className="text-sm font-semibold text-[#eaecef]">Send your payment</h2>
                      <p className="text-xs text-[#848e9c]">
                        {depMethodObj.label} · ${parseFloat(depAmount || '0').toFixed(2)} USDT
                      </p>
                    </div>
                  </div>

                  {!depConfigured ? (
                    <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-[#f6465d] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-[#f6465d]">Payment method not configured</p>
                        <p className="text-[11px] text-[#848e9c] mt-1">Admin has not set up this deposit method yet.</p>
                        <button onClick={() => setDepStep(2)} className="mt-3 text-xs text-[#f0b90b] hover:underline">← Choose another method</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl p-3 text-xs text-[#848e9c]">
                        <p className="font-semibold text-[#f0b90b] flex items-center gap-1.5 mb-1">
                          <AlertTriangle size={11} /> Important
                        </p>
                        <ul className="text-[10px] space-y-0.5 list-disc list-inside">
                          <li>Send the exact amount and currency</li>
                          <li>Minimum $10 equivalent</li>
                          <li>Double-check address</li>
                        </ul>
                      </div>

                      {/* Crypto Section */}
                      {isCrypto(depMethod) && depAddress ? (
                        <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-5 space-y-4">
                          <p className="text-center text-xs text-[#848e9c]">Scan QR or Copy Address</p>

                          {/* QR code with FinAi logo overlay */}
                          <div className="flex justify-center">
                            <div className="relative bg-white p-3 rounded-2xl inline-flex">
                              <QRCode
                                value={depAddress}
                                size={110}
                                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                              />
                              {/* FinAi logo in center */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-7 h-7 bg-[#f0b90b] rounded-md flex items-center justify-center shadow-md border-2 border-white">
                                  <span className="text-black font-black text-[10px] leading-none">Fi</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-[#161a1e] border border-[#2b3139] rounded-lg px-3 py-3">
                            <code className="text-[11px] font-mono text-[#eaecef] flex-1 break-all">{depAddress}</code>
                            <button
                              onClick={() => { navigator.clipboard.writeText(depAddress); toast.success('Address copied!') }}
                              className="text-[#f0b90b] hover:text-white p-1.5 transition"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      ) : isCrypto(depMethod) && !depAddress ? (
                        <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-4 text-center">
                          <p className="text-[#f6465d] text-sm">Address not available for this method.</p>
                          <button onClick={() => setDepStep(2)} className="mt-2 text-xs text-[#f0b90b]">Choose another method</button>
                        </div>
                      ) : null}

                      {/* Bank Section */}
                      {depMethod === 'bank' && (
                        <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3">
                          {/* Bank logo */}
                          {bankLogo && (
                            <div className="flex justify-center mb-2">
                              <img src={bankLogo} alt="Bank" className="w-14 h-14 rounded-full object-cover border-2 border-[#2b3139]" />
                            </div>
                          )}
                          {(['bank_name', 'bank_address', 'bank_account', 'bank_routing', 'bank_swift', 'bank_name_beneficiary'] as const).map(k =>
                            cfg[k]?.value ? (
                              <div key={k} className="flex justify-between items-center gap-2">
                                <span className="text-[#848e9c] capitalize text-xs flex-shrink-0">{cfg[k].label || k.replace(/_/g, ' ')}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[#eaecef] text-xs text-right">{cfg[k].value}</span>
                                  <button onClick={() => { navigator.clipboard.writeText(cfg[k].value); toast.success('Copied!') }}>
                                    <Copy size={14} className="text-[#848e9c]" />
                                  </button>
                                </div>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}

                      {isCrypto(depMethod) && (
                        <div>
                          <label className="text-xs text-[#848e9c] mb-1.5 block">Transaction Hash (optional)</label>
                          <input value={depTxHash} onChange={e => setDepTxHash(e.target.value)} placeholder="0x..." className={inp} />
                        </div>
                      )}

                      {depMethod === 'bank' && (
                        <>
                          <div>
                            <label className="text-xs text-[#848e9c] mb-1.5 block">Bank Reference *</label>
                            <input value={depBankRef} onChange={e => setDepBankRef(e.target.value)} placeholder="Transfer reference" className={inp} />
                          </div>
                          <div>
                            <label className="text-xs text-[#848e9c] mb-1.5 block">Upload Payment Proof (optional)</label>
                            <div className="border border-dashed border-[#2b3139] rounded-xl p-4 text-center hover:border-[#f0b90b]/40 transition cursor-pointer"
                              onClick={() => document.getElementById('proof-upload')?.click()}>
                              <input id="proof-upload" type="file" accept="image/*" className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  if (file.size > 5 * 1024 * 1024) { toast.error('File too large — max 5MB'); return }
                                  setDepProofName(file.name)
                                  const reader = new FileReader()
                                  reader.onload = ev => setDepPaymentProof(ev.target?.result as string)
                                  reader.readAsDataURL(file)
                                }}
                              />
                              {depPaymentProof ? (
                                <div className="space-y-2">
                                  <img src={depPaymentProof} alt="proof" className="max-h-32 mx-auto rounded-lg object-contain" />
                                  <p className="text-[10px] text-[#0ecb81]">{depProofName}</p>
                                  <button type="button" onClick={e => { e.stopPropagation(); setDepPaymentProof(''); setDepProofName('') }}
                                    className="text-[10px] text-[#f6465d] hover:underline">Remove</button>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-xs text-[#848e9c]">Click to upload screenshot / receipt</p>
                                  <p className="text-[10px] text-[#4a5568] mt-1">PNG, JPG, JPEG (max 5MB)</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      <button
                        onClick={handleDepositSubmit}
                        disabled={submitting || (depMethod === 'bank' && !depBankRef.trim())}
                        className="w-full bg-[#0ecb81] hover:bg-[#0ab56f] disabled:opacity-60 text-black font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
                      >
                        {submitting ? 'Submitting…' : "I've Sent the Payment — Submit Request"}
                        {!submitting && <CheckCircle size={14} />}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── WITHDRAW ── */}
          {tab === 'withdraw' && (
            <form onSubmit={handleWithdraw} className="space-y-4">
              <h2 className="text-sm font-semibold text-[#eaecef]">Withdraw Funds</h2>
              <p className="text-xs text-[#848e9c]">Balance: <span className="text-[#eaecef] font-mono font-semibold">${(user?.balance_usdt ?? 0).toFixed(2)} USDT</span></p>

              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Withdrawal Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map(m => (
                    <button key={m.key} type="button"
                      onClick={() => setWdMethod(m.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition text-xs font-medium ${wdMethod === m.key ? `${m.border} ${m.bg} ${m.color}` : 'border-[#2b3139] text-[#848e9c] hover:border-[#3c4451]'}`}>
                      <span>{m.icon}</span><span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isCrypto(wdMethod) && (
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Destination Wallet Address *</label>
                  <input value={wdAddress} onChange={e => setWdAddress(e.target.value)} required placeholder="Your crypto wallet address" className={inp} />
                </div>
              )}
              {!isCrypto(wdMethod) && (
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Bank Account / IBAN *</label>
                  <input value={wdBankRef} onChange={e => setWdBankRef(e.target.value)} required placeholder="Your bank account or IBAN" className={inp} />
                </div>
              )}

              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Amount (USDT) *</label>
                <div className="relative">
                  <input type="number" min="0" step="0.01" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                    required placeholder="0.00" className={inp} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#848e9c]">USDT</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block flex items-center gap-1"><Lock size={10} /> Transfer PIN *</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={wdPin} onChange={e => setWdPin(e.target.value)}
                    required placeholder="Your 4–6 digit PIN" maxLength={6}
                    className={`${inp} tracking-widest`}
                  />
                  <button type="button" onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef] text-xs">
                    {showPin ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={submitting || (!!wdAmount && parseFloat(wdAmount) > (user?.balance_usdt ?? 0))}
                className="w-full bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2">
                {submitting ? 'Submitting…' : 'Request Withdrawal'}
                {!submitting && <ArrowUpRight size={14} />}
              </button>
            </form>
          )}

          {/* ── P2P ── */}
          {tab === 'send' && (
            <form onSubmit={handleP2P} className="space-y-4">
              <h2 className="text-sm font-semibold text-[#eaecef]">Send to User (P2P)</h2>
              <p className="text-xs text-[#848e9c]">Instant transfer to any FinAi user by email</p>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Recipient Email *</label>
                <input type="email" value={p2pEmail} onChange={e => setP2pEmail(e.target.value)} required placeholder="user@example.com" className={inp} />
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Amount (USDT) *</label>
                <input type="number" min="0.01" step="0.01" value={p2pAmount} onChange={e => setP2pAmount(e.target.value)} required placeholder="0.00" className={inp} />
              </div>
              <div>
                <label className="text-xs text-[#848e9c] mb-1.5 block">Note (optional)</label>
                <input value={p2pNote} onChange={e => setP2pNote(e.target.value)} placeholder="Payment note" className={inp} />
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-3 rounded-xl text-sm transition">
                {submitting ? 'Sending...' : 'Send Funds'}
              </button>
            </form>
          )}

          {/* ── RENT VPS ── */}
          {tab === 'vps' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[#eaecef]">Rent a VPS for your Bot</h2>
              <p className="text-xs text-[#848e9c]">Run your FinAi bot 24/7 on a dedicated server.</p>
              {vpsPlans.length === 0 ? (
                <p className="text-xs text-[#848e9c] text-center py-8">No VPS plans available.</p>
              ) : vpsPlans.map(plan => (
                <div key={plan.id} className="flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 hover:border-[#f0b90b]/30 transition">
                  <div>
                    <p className="text-sm font-medium text-[#eaecef]">{plan.name}</p>
                    <p className="text-xs text-[#848e9c]">{plan.specs}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-[#f0b90b]">${plan.price}<span className="text-xs text-[#848e9c]">/mo</span></p>
                    <button onClick={() => {
                      if ((user?.balance_usdt ?? 0) < plan.price) return toast.error('Insufficient balance')
                      toast.success(`${plan.name} order submitted!`)
                    }} className="mt-1 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] px-3 py-1 rounded-lg transition flex items-center gap-1 ml-auto">
                      Rent <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BUY ASSET ── */}
          {tab === 'asset' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[#eaecef]">Buy Crypto Assets</h2>
              <p className="text-xs text-[#848e9c]">Purchase crypto directly from your USDT balance.</p>
              {assetProducts.length === 0 ? (
                <p className="text-xs text-[#848e9c] text-center py-8">No assets available.</p>
              ) : assetProducts.map(asset => (
                <div key={asset.id} className="flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 hover:border-[#f0b90b]/30 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#f0b90b]/10 flex items-center justify-center font-bold text-[#f0b90b]">{asset.icon}</div>
                    <div>
                      <p className="text-sm font-medium text-[#eaecef]">{asset.name}</p>
                      <p className="text-xs text-[#848e9c]">${Number(asset.price).toLocaleString()} / unit</p>
                    </div>
                  </div>
                  <button onClick={() => toast('Asset purchase coming soon')} className="text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                    Buy <ChevronRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Transaction History */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#eaecef]">Recent Transactions</h2>
            <span className="text-xs text-[#848e9c]">{txs.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[480px]">
            {loading ? (
              <div className="py-12 text-center text-[#848e9c] text-sm">Loading...</div>
            ) : txs.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <RefreshCw size={24} className="text-[#2b3139]" />
                <p className="text-sm text-[#848e9c]">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2b3139]/50">
                {txs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#1e2329] transition">
                    <div className="w-6 h-6 rounded-full bg-[#2b3139] flex items-center justify-center flex-shrink-0">
                      {txIcon(tx.tx_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#eaecef] capitalize">{tx.tx_type?.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-[#848e9c] truncate">{tx.method} · {tx.note || tx.asset}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-[#eaecef]">${tx.amount_usdt?.toFixed(2)}</p>
                      <div>{statusBadge(tx.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
