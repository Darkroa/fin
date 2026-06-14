// Add this at the very top of the file
declare module 'react-qr-code';
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useLanguage } from '../contexts/LanguageContext'
import { formatCurrency } from '../lib/i18n'
import {
  getWalletConfig, requestDeposit, requestWithdrawal,
  p2pSend, getMyTransactions, getMe,
  getMyDepositConfig, cancelDeposit, getWithdrawalMethods, saveWithdrawalMethods,
} from '../lib/api'
import toast from 'react-hot-toast'
import { QRCode } from 'react-qr-code'
import {
  ArrowDownLeft, ArrowUpRight, Send, Copy, RefreshCw,
  Clock, CheckCircle, XCircle, ChevronRight,
  ChevronLeft, AlertTriangle, Lock, Bitcoin, Plus, Trash2, CreditCard,
  Building2, Info,
} from 'lucide-react'

type WalletTab = 'deposit' | 'withdraw' | 'send'
type DepStep = 1 | 2 | 3
type WdStep  = 1 | 2 | 3

interface WalletCfg { [key: string]: { value: string; label: string } }
interface Tx {
  id: number; tx_type: string; method: string; asset: string
  amount_usdt: number; status: string; note?: string; created_at: string
}

export interface WithdrawalMethod {
  id: string
  type: 'crypto_btc' | 'crypto_eth' | 'crypto_usdt' | 'bank'
  label: string
  address?: string
  bank_name?: string
  bank_account?: string
  bank_routing?: string
  bank_swift?: string
  bank_beneficiary?: string
}

const METHODS = [
  { key: 'crypto_btc',  label: 'Bitcoin (BTC)',   cfgKey: 'btc_address',  icon: '₿', color: 'text-[#f7931a]', bg: 'bg-[#f7931a]/10', border: 'border-[#f7931a]/20' },
  { key: 'crypto_eth',  label: 'Ethereum (ETH)',   cfgKey: 'eth_address',  icon: 'Ξ', color: 'text-[#627eea]', bg: 'bg-[#627eea]/10', border: 'border-[#627eea]/20' },
  { key: 'crypto_usdt', label: 'USDT (TRC-20)',    cfgKey: 'usdt_trc20',   icon: '₮', color: 'text-[#26a17b]', bg: 'bg-[#26a17b]/10', border: 'border-[#26a17b]/20' },
  { key: 'bank',        label: 'Bank Transfer',    cfgKey: 'bank_account', icon: 'B',  color: 'text-[#848e9c]', bg: 'bg-[#848e9c]/10', border: 'border-[#848e9c]/20' },
]

const WD_TYPES: { key: WithdrawalMethod['type']; label: string; icon: string; color: string }[] = [
  { key: 'crypto_btc',  label: 'Bitcoin (BTC)',  icon: '₿', color: 'text-[#f7931a]' },
  { key: 'crypto_eth',  label: 'Ethereum (ETH)', icon: 'Ξ', color: 'text-[#627eea]' },
  { key: 'crypto_usdt', label: 'USDT TRC-20',    icon: '₮', color: 'text-[#26a17b]' },
  { key: 'bank',        label: 'Bank Transfer',  icon: 'B', color: 'text-[#848e9c]' },
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
  if (s === 'rejected' || s === 'failed' || s === 'cancelled')
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]"><XCircle size={9} className="inline mr-0.5" />{s}</span>
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]"><Clock size={9} className="inline mr-0.5" />pending</span>
}

function DepositCountdown({ createdAt, onExpired }: { createdAt: string; onExpired: () => void }) {
  const LIMIT = 30 * 60
  const calcSecs = () => Math.max(0, LIMIT - Math.floor((Date.now() - new Date(createdAt + (createdAt.endsWith('Z') ? '' : 'Z')).getTime()) / 1000))
  const [secs, setSecs] = useState(calcSecs)
  const firedRef = useRef(false)

  useEffect(() => {
    if (secs <= 0 && !firedRef.current) { firedRef.current = true; onExpired(); return }
    const t = setInterval(() => {
      const s = calcSecs()
      setSecs(s)
      if (s <= 0 && !firedRef.current) { firedRef.current = true; onExpired(); clearInterval(t) }
    }, 1000)
    return () => clearInterval(t)
  }, [])

  if (secs <= 0) return <span className="text-[10px] text-[#f6465d] font-mono">Expired</span>
  const m = Math.floor(secs / 60)
  const s = secs % 60
  const urgent = secs < 5 * 60
  return (
    <span className={`text-[10px] font-mono flex items-center gap-0.5 ${urgent ? 'text-[#f6465d]' : 'text-[#f0b90b]'}`}>
      <Clock size={9} />{m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

function wdTypeColor(type: WithdrawalMethod['type']) {
  if (type === 'crypto_btc') return 'text-[#f7931a]'
  if (type === 'crypto_eth') return 'text-[#627eea]'
  if (type === 'crypto_usdt') return 'text-[#26a17b]'
  return 'text-[#848e9c]'
}
function wdTypeIcon(type: WithdrawalMethod['type']) {
  if (type === 'bank') return 'B'
  if (type === 'crypto_btc') return '₿'
  if (type === 'crypto_eth') return 'Ξ'
  return '₮'
}
function wdTypeLabel(type: WithdrawalMethod['type']) {
  return WD_TYPES.find(t => t.key === type)?.label ?? type
}

export default function WalletPage() {
  const { user, setUser } = useAuthStore()
  const { currency } = useLanguage()
  const [tab, setTab] = useState<WalletTab>('deposit')
  const [cfg, setCfg] = useState<WalletCfg>({})
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // ── Deposit state ──
  const [depStep, setDepStep]           = useState<DepStep>(1)
  const [depAmount, setDepAmount]       = useState('')
  const [depBtcRate, setDepBtcRate]     = useState<number | null>(null)
  const [depRateLoading, setDepRateLoading] = useState(false)
  const [depMethod, setDepMethod]       = useState('')
  const [depTxHash, setDepTxHash]       = useState('')
  const [depBankRef, setDepBankRef]     = useState('')
  const [depPaymentProof, setDepPaymentProof] = useState<string>('')
  const [depProofName, setDepProofName] = useState('')

  // ── Withdrawal wizard state ──
  const [wdStep, setWdStep]             = useState<WdStep>(1)
  const [wdAmount, setWdAmount]         = useState('')
  const [wdPin, setWdPin]               = useState('')
  const [showPin, setShowPin]           = useState(false)
  const [wdMethods, setWdMethods]       = useState<WithdrawalMethod[]>([])
  const [wdSelectedId, setWdSelectedId] = useState<string>('')
  const [wdMethodsLoaded, setWdMethodsLoaded] = useState(false)
  const [showAddMethod, setShowAddMethod] = useState(false)
  const [wdNewType, setWdNewType]       = useState<WithdrawalMethod['type']>('crypto_btc')
  const [wdNewLabel, setWdNewLabel]     = useState('')
  const [wdNewAddress, setWdNewAddress] = useState('')
  const [wdNewBankName, setWdNewBankName]           = useState('')
  const [wdNewBankAccount, setWdNewBankAccount]     = useState('')
  const [wdNewBankRouting, setWdNewBankRouting]     = useState('')
  const [wdNewBankSwift, setWdNewBankSwift]         = useState('')
  const [wdNewBankBeneficiary, setWdNewBankBeneficiary] = useState('')
  const [savingMethod, setSavingMethod] = useState(false)

  // ── P2P state ──
  const [p2pEmail, setP2pEmail]   = useState('')
  const [p2pAmount, setP2pAmount] = useState('')
  const [p2pNote, setP2pNote]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getWalletConfig(),
      getMyTransactions(),
      getMyDepositConfig().catch(() => ({ data: {} })),
      getWithdrawalMethods().catch(() => ({ data: [] })),
    ])
      .then(([cfgRes, txRes, myDepRes, wdRes]) => {
        const globalCfg: WalletCfg = cfgRes.data || {}
        const userOverrides: Record<string, string> = myDepRes.data || {}
        const merged: WalletCfg = { ...globalCfg }
        for (const [k, v] of Object.entries(userOverrides)) {
          if (v && typeof v === 'string' && v.trim()) {
            merged[k] = { value: v, label: globalCfg[k]?.label || k }
          }
        }
        setCfg(merged)
        setTxs(Array.isArray(txRes.data) ? txRes.data : [])
        setWdMethods(Array.isArray(wdRes.data) ? wdRes.data : [])
        setWdMethodsLoaded(true)
      })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false))
  }, [])

  const refreshBalance = async () => {
    try { const res = await getMe(); setUser(res.data) } catch { /* silent */ }
  }

  const refreshTxs = async () => {
    const res = await getMyTransactions()
    setTxs(Array.isArray(res.data) ? res.data : [])
  }

  const fetchBtcRate = useCallback(async () => {
    setDepRateLoading(true)
    try {
      const res = await fetch('/api/public/prices')
      if (res.ok) {
        const data = await res.json()
        setDepBtcRate(data['BTC/USDT']?.price || data.bitcoin?.usd || 97000)
      } else { setDepBtcRate(97000) }
    } catch { setDepBtcRate(97000) }
    finally { setDepRateLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'deposit' && depStep === 1) fetchBtcRate()
  }, [tab, depStep, fetchBtcRate])

  // ── Deposit submit ──
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
      await refreshTxs()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  // ── Cancel deposit ──
  const handleCancelDeposit = async (txId: number) => {
    try {
      await cancelDeposit(txId)
      toast.success('Deposit cancelled')
      await refreshTxs()
    } catch { toast.error('Could not cancel deposit') }
  }

  // ── Withdrawal methods CRUD ──
  const persistMethods = async (updated: WithdrawalMethod[]) => {
    setWdMethods(updated)
    await saveWithdrawalMethods(updated as object[])
  }

  const handleSaveNewMethod = async () => {
    const trimLabel = wdNewLabel.trim()
    if (!trimLabel) return toast.error('Enter a label for this method')
    if (wdNewType !== 'bank' && !wdNewAddress.trim()) return toast.error('Enter a wallet address')
    if (wdNewType === 'bank' && !wdNewBankAccount.trim()) return toast.error('Enter an account number / IBAN')
    setSavingMethod(true)
    try {
      const newMethod: WithdrawalMethod = {
        id: crypto.randomUUID(),
        type: wdNewType,
        label: trimLabel,
        ...(wdNewType !== 'bank' ? { address: wdNewAddress.trim() } : {
          bank_name: wdNewBankName.trim(),
          bank_account: wdNewBankAccount.trim(),
          bank_routing: wdNewBankRouting.trim(),
          bank_swift: wdNewBankSwift.trim(),
          bank_beneficiary: wdNewBankBeneficiary.trim(),
        }),
      }
      const updated = [...wdMethods, newMethod]
      await persistMethods(updated)
      setWdSelectedId(newMethod.id)
      setShowAddMethod(false)
      setWdNewLabel(''); setWdNewAddress(''); setWdNewBankName(''); setWdNewBankAccount('')
      setWdNewBankRouting(''); setWdNewBankSwift(''); setWdNewBankBeneficiary('')
      toast.success('Payout method saved')
    } catch { toast.error('Failed to save method') }
    finally { setSavingMethod(false) }
  }

  const handleDeleteMethod = async (id: string) => {
    const updated = wdMethods.filter(m => m.id !== id)
    await persistMethods(updated)
    if (wdSelectedId === id) setWdSelectedId('')
    toast.success('Method removed')
  }

  // ── Withdrawal submit ──
  const handleWithdraw = async () => {
    if (!wdAmount || parseFloat(wdAmount) <= 0) return toast.error('Enter a valid amount')
    if (!wdSelectedId) return toast.error('Select a payout method')
    if (!wdPin.trim()) return toast.error('Enter your transfer PIN')
    const method = wdMethods.find(m => m.id === wdSelectedId)
    if (!method) return toast.error('Invalid method selected')
    setSubmitting(true)
    try {
      await requestWithdrawal({
        method: method.type,
        asset: WD_TYPES.find(t => t.key === method.type)?.label?.split(' ')[0] || 'USDT',
        amount_usdt: parseFloat(wdAmount),
        wallet_address: method.address || undefined,
        bank_ref: method.bank_account || undefined,
        transfer_pin: wdPin,
      })
      toast.success('Withdrawal request submitted')
      setWdAmount(''); setWdPin(''); setWdStep(1)
      await refreshBalance()
      await refreshTxs()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Insufficient balance or invalid PIN')
    } finally { setSubmitting(false) }
  }

  // ── P2P submit ──
  const handleP2P = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!p2pEmail || !p2pAmount) return toast.error('Fill all fields')
    setSubmitting(true)
    try {
      await p2pSend({ recipient_email: p2pEmail, amount_usdt: parseFloat(p2pAmount), note: p2pNote || undefined })
      toast.success(`Sent $${p2pAmount} to ${p2pEmail}`)
      setP2pEmail(''); setP2pAmount(''); setP2pNote('')
      await refreshBalance(); await refreshTxs()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'
  const isCrypto = (method: string) => method !== 'bank'

  const depMethodObj = METHODS.find(m => m.key === depMethod)
  const depCfgKey    = depMethodObj?.cfgKey
  const depAddress   = depCfgKey ? (cfg[depCfgKey]?.value?.trim() ?? '') : ''
  const depConfigured = depMethod === 'bank' ? !!cfg['bank_account']?.value : !!depAddress
  const bankLogo = cfg['bank_logo']?.value || ''
  const depositNote = cfg['deposit_note']?.value?.trim() || ''

  const selectedMethod = wdMethods.find(m => m.id === wdSelectedId)
  const balance = user?.balance_usdt ?? 0

  const tabs = [
    { key: 'deposit',  label: 'Deposit',   icon: ArrowDownLeft },
    { key: 'withdraw', label: 'Withdraw',  icon: ArrowUpRight },
    { key: 'send',     label: 'Send P2P',  icon: Send },
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
              {formatCurrency(balance, currency)}
            </p>
            <p className="text-xs text-[#848e9c] mt-1">USDT · Updated just now</p>
          </div>
        </div>
      </div> 

      {/* Action tabs */}
      <div className="grid grid-cols-3 gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key as WalletTab); if (key === 'deposit') setDepStep(1); if (key === 'withdraw') setWdStep(1) }}
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
                      <input type="number" min="0" step="0.01" value={depAmount} onChange={e => setDepAmount(e.target.value)}
                        placeholder="0.00" className={inp} autoFocus />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#848e9c] font-semibold">USDT</span>
                    </div>
                  </div>
                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[50, 100, 500, 1000].map(v => (
                      <button key={v} onClick={() => setDepAmount(String(v))}
                        className="flex-1 text-[10px] py-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/40 hover:text-[#f0b90b] transition">${v}</button>
                    ))}
                  </div>

                  {depAmount && parseFloat(depAmount) > 0 && (
                    <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 space-y-1.5">
                      <p className="text-[10px] text-[#848e9c] font-semibold uppercase tracking-wider mb-2">Approximate conversions</p>
                      {depRateLoading ? <p className="text-xs text-[#4a5568]">Fetching rates…</p> : depBtcRate ? (
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

                  <button onClick={() => { if (!depAmount || parseFloat(depAmount) <= 0) return toast.error('Enter a valid amount'); setDepStep(2) }}
                    className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    Next: Choose Payment Method <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Step 2 */}
              {depStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDepStep(1)} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#2b3139] transition"><ChevronLeft size={14} /></button>
                    <h2 className="text-sm font-semibold text-[#eaecef]">Select payment method</h2>
                  </div>
                  <p className="text-xs text-[#848e9c]">Depositing <span className="text-[#f0b90b] font-mono font-semibold">${parseFloat(depAmount || '0').toFixed(2)} USDT</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {METHODS.map(m => {
                      const configured = m.key === 'bank' ? !!cfg['bank_account']?.value : !!cfg[m.cfgKey]?.value?.trim()
                      return (
                        <button key={m.key} onClick={() => { setDepMethod(m.key); setDepStep(3) }}
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${depMethod === m.key ? `${m.border} ${m.bg}` : 'border-[#2b3139] hover:border-[#3c4451]'}`}>
                          {!configured && <span className="absolute top-1.5 right-1.5 text-[8px] bg-[#848e9c]/20 text-[#848e9c] px-1 py-0.5 rounded font-medium">Unconfigured</span>}
                          <span className={`text-2xl ${m.color}`}>{m.icon}</span>
                          <span className="text-xs font-medium text-[#eaecef] text-center leading-tight">{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 3 */}
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

              {depStep === 3 && depMethodObj && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDepStep(2)} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#2b3139] transition"><ChevronLeft size={14} /></button>
                    <div>
                      <h2 className="text-sm font-semibold text-[#eaecef]">Send your payment</h2>
                      <p className="text-xs text-[#848e9c]">{depMethodObj.label} · ${parseFloat(depAmount || '0').toFixed(2)} USDT</p>
                    </div>
                  </div>

                  {/* Admin deposit note */}
                  {depositNote && (
                    <div className="bg-[#1e2329] border border-[#f0b90b]/20 rounded-xl p-3 flex items-start gap-2.5">
                      <Info size={14} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#eaecef] leading-relaxed">{depositNote}</p>
                    </div>
                  )}

                  {!depConfigured ? (
                    <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-[#f6465d] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-[#f6465d]">Payment method not configured</p>
                        <p className="text-[11px] text-[#848e9c] mt-1"> ..System pending config</p>
                        <button onClick={() => setDepStep(2)} className="mt-3 text-xs text-[#f0b90b] hover:underline">← Choose another method</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl p-3 text-xs text-[#848e9c]">
                        <p className="font-semibold text-[#f0b90b] flex items-center gap-1.5 mb-1"><AlertTriangle size={11} /> Important</p>
                        <ul className="text-[10px] space-y-0.5 list-disc list-inside">
                          <li>Send the exact amount and currency</li>
                          <li>Minimum $10 equivalent</li>
                          <li>Double-check address before sending</li>
                          <li>You have 30 minutes to complete the payment</li>
                        </ul>
                      </div>

                      {isCrypto(depMethod) && depAddress ? (
                        <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-5 space-y-4">
                          <p className="text-center text-xs text-[#848e9c]">Scan QR or Copy Address</p>
                          <div className="flex justify-center">
                            <div className="relative bg-white p-3 rounded-2xl inline-flex">
                              <QRCode value={depAddress} size={110} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-7 h-7 bg-[#f0b90b] rounded-md flex items-center justify-center shadow-md border-2 border-white">
                                  <span className="text-black font-black text-[10px] leading-none">FinAi</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-[#161a1e] border border-[#2b3139] rounded-lg px-3 py-3">
                            <code className="text-[11px] font-mono text-[#eaecef] flex-1 break-all">{depAddress}</code>
                            <button onClick={() => { navigator.clipboard.writeText(depAddress); toast.success('Address copied!') }} className="text-[#f0b90b] hover:text-white p-1.5 transition"><Copy size={16} /></button>
                          </div>
                        </div>
                      ) : isCrypto(depMethod) && !depAddress ? (
                        <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-4 text-center">
                          <p className="text-[#f6465d] text-sm">Address not available for this method.</p>
                          <button onClick={() => setDepStep(2)} className="mt-2 text-xs text-[#f0b90b]">Choose another method</button>
                        </div>
                      ) : null}

                      {depMethod === 'bank' && (
                        <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3">
                          {bankLogo && <div className="flex justify-center mb-2"><img src={bankLogo} alt="Bank" className="w-14 h-14 rounded-full object-cover border-2 border-[#2b3139]" /></div>}
                          {(['bank_name', 'bank_address', 'bank_account', 'bank_routing', 'bank_swift', 'bank_name_beneficiary'] as const).map(k =>
                            cfg[k]?.value ? (
                              <div key={k} className="flex justify-between items-center gap-2">
                                <span className="text-[#848e9c] capitalize text-xs flex-shrink-0">{cfg[k].label || k.replace(/_/g, ' ')}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[#eaecef] text-xs text-right">{cfg[k].value}</span>
                                  <button onClick={() => { navigator.clipboard.writeText(cfg[k].value); toast.success('Copied!') }}><Copy size={14} className="text-[#848e9c]" /></button>
                                </div>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}

                      {isCrypto(depMethod) && (
                        <div>
                          <label className="text-xs text-[#848e9c] mb-1.5 block">Transaction Hash </label>
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
                                  const file = e.target.files?.[0]; if (!file) return
                                  if (file.size > 5 * 1024 * 1024) { toast.error('File too large — max 5MB'); return }
                                  setDepProofName(file.name)
                                  const reader = new FileReader()
                                  reader.onload = ev => setDepPaymentProof(ev.target?.result as string)
                                  reader.readAsDataURL(file)
                                }} />
                              {depPaymentProof ? (
                                <div className="space-y-2">
                                  <img src={depPaymentProof} alt="proof" className="max-h-32 mx-auto rounded-lg object-contain" />
                                  <p className="text-[10px] text-[#0ecb81]">{depProofName}</p>
                                  <button type="button" onClick={e => { e.stopPropagation(); setDepPaymentProof(''); setDepProofName('') }} className="text-[10px] text-[#f6465d] hover:underline">Remove</button>
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

                      <button onClick={handleDepositSubmit} disabled={submitting || (depMethod === 'bank' && !depBankRef.trim())}
                        className="w-full bg-[#0ecb81] hover:bg-[#0ab56f] disabled:opacity-60 text-black font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2">
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
            <div className="space-y-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${wdStep >= s ? 'bg-[#f6465d] text-white' : 'bg-[#2b3139] text-[#848e9c]'}`}>{s}</div>
                    {s < 3 && <div className={`flex-1 h-0.5 w-8 rounded ${wdStep > s ? 'bg-[#f6465d]' : 'bg-[#2b3139]'}`} />}
                  </div>
                ))}
                <span className="text-xs text-[#848e9c] ml-1">
                  {wdStep === 1 ? 'Amount' : wdStep === 2 ? 'Payout Method' : 'Confirm & PIN'}
                </span>
              </div>

              {/* Wd Step 1 — Amount */}
              {wdStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-[#eaecef]">How much do you want to withdraw?</h2>
                  <p className="text-xs text-[#848e9c]">Balance: <span className="text-[#eaecef] font-mono font-semibold">${balance.toFixed(2)} USDT</span></p>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Amount (USDT) *</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                        placeholder="0.00" className={inp} autoFocus />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#848e9c] font-semibold">USDT</span>
                    </div>
                  </div>
                  {/* Quick % buttons */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map(pct => (
                      <button key={pct} onClick={() => setWdAmount((balance * pct / 100).toFixed(2))}
                        className="flex-1 text-[10px] py-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139] text-[#848e9c] hover:border-[#f6465d]/40 hover:text-[#f6465d] transition">{pct}%</button>
                    ))}
                  </div>
                  {wdAmount && parseFloat(wdAmount) > balance && (
                    <p className="text-xs text-[#f6465d] flex items-center gap-1"><AlertTriangle size={11} /> Amount exceeds balance</p>
                  )}
                  <button
                    onClick={() => {
                      if (!wdAmount || parseFloat(wdAmount) <= 0) return toast.error('Enter a valid amount')
                      if (parseFloat(wdAmount) > balance) return toast.error('Insufficient balance')
                      setWdStep(2)
                    }}
                    className="w-full bg-[#f6465d] hover:bg-[#d93d51] text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    Next: Choose Payout Method <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Wd Step 2 — Select Payout Method */}
              {wdStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setWdStep(1); setShowAddMethod(false) }} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#2b3139] transition"><ChevronLeft size={14} /></button>
                    <h2 className="text-sm font-semibold text-[#eaecef]">Select payout method</h2>
                  </div>
                  <p className="text-xs text-[#848e9c]">Withdrawing <span className="text-[#f6465d] font-mono font-semibold">${parseFloat(wdAmount || '0').toFixed(2)} USDT</span></p>

                  {/* Saved cards */}
                  {wdMethods.length === 0 && !showAddMethod && (
                    <div className="text-center py-6 bg-[#0b0e11] border border-dashed border-[#2b3139] rounded-xl">
                      <CreditCard size={28} className="text-[#2b3139] mx-auto mb-2" />
                      <p className="text-sm text-[#848e9c]">No payout methods yet</p>
                      <p className="text-[10px] text-[#4a5568] mt-0.5 mb-3">Add BTC, ETH, USDT or bank account</p>
                    </div>
                  )}

                  {wdMethods.length > 0 && !showAddMethod && (
                    <div className="space-y-2">
                      {wdMethods.map(m => (
                        <div key={m.id}
                          onClick={() => setWdSelectedId(m.id)}
                          className={`relative flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${wdSelectedId === m.id ? 'border-[#f6465d]/50 bg-[#f6465d]/5' : 'border-[#2b3139] hover:border-[#3c4451] bg-[#0b0e11]'}`}>
                          {/* Radio dot */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${wdSelectedId === m.id ? 'border-[#f6465d]' : 'border-[#3c4451]'}`}>
                            {wdSelectedId === m.id && <div className="w-2 h-2 rounded-full bg-[#f6465d]" />}
                          </div>
                          {/* Type icon */}
                          <div className={`w-8 h-8 rounded-lg bg-[#1e2329] flex items-center justify-center text-base font-bold flex-shrink-0 ${wdTypeColor(m.type)}`}>
                            {wdTypeIcon(m.type)}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#eaecef]">{m.label}</p>
                            <p className="text-[10px] text-[#848e9c] truncate">
                              {m.type === 'bank'
                                ? `${m.bank_name ? m.bank_name + ' · ' : ''}${m.bank_account || ''}`
                                : m.address?.slice(0, 12) + '…' + m.address?.slice(-6)}
                            </p>
                            <p className={`text-[9px] font-medium mt-0.5 ${wdTypeColor(m.type)}`}>{wdTypeLabel(m.type)}</p>
                          </div>
                          {/* Delete */}
                          <button onClick={e => { e.stopPropagation(); handleDeleteMethod(m.id) }}
                            className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Method button */}
                  {!showAddMethod && (
                    <button onClick={() => setShowAddMethod(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/40 hover:text-[#f0b90b] transition text-xs font-medium">
                      <Plus size={14} /> Add New Payout Method
                    </button>
                  )}

                  {/* Add Method Form */}
                  {showAddMethod && (
                    <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#eaecef]">New Payout Method</p>
                        <button onClick={() => setShowAddMethod(false)} className="text-[#848e9c] hover:text-[#eaecef] text-[10px]">Cancel</button>
                      </div>
                      {/* Type selector */}
                      <div>
                        <label className="text-xs text-[#848e9c] mb-2 block">Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {WD_TYPES.map(t => (
                            <button key={t.key} type="button" onClick={() => setWdNewType(t.key)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition ${wdNewType === t.key ? 'border-[#f0b90b]/40 bg-[#f0b90b]/5 text-[#eaecef]' : 'border-[#2b3139] text-[#848e9c] hover:border-[#3c4451]'}`}>
                              <span className={t.color}>{t.icon}</span>{t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Label */}
                      <div>
                        <label className="text-xs text-[#848e9c] mb-1.5 block">Nickname / Label *</label>
                        <input value={wdNewLabel} onChange={e => setWdNewLabel(e.target.value)} placeholder="e.g. My BTC Wallet" className={inp} />
                      </div>
                      {/* Crypto fields */}
                      {wdNewType !== 'bank' && (
                        <div>
                          <label className="text-xs text-[#848e9c] mb-1.5 block">Wallet Address *</label>
                          <input value={wdNewAddress} onChange={e => setWdNewAddress(e.target.value)} placeholder="Enter address…" className={`${inp} font-mono text-xs`} />
                        </div>
                      )}
                      {/* Bank fields */}
                      {wdNewType === 'bank' && (
                        <div className="space-y-3">
                          {[
                            { label: 'Bank Name', value: wdNewBankName, set: setWdNewBankName, ph: 'e.g. Chase Bank' },
                            { label: 'Account Number / IBAN *', value: wdNewBankAccount, set: setWdNewBankAccount, ph: 'GB29 NWBK 6016 1331 9268 19' },
                            { label: 'Routing / Sort Code', value: wdNewBankRouting, set: setWdNewBankRouting, ph: '021000021' },
                            { label: 'SWIFT / BIC', value: wdNewBankSwift, set: setWdNewBankSwift, ph: 'CHASUS33' },
                            { label: 'Beneficiary Name', value: wdNewBankBeneficiary, set: setWdNewBankBeneficiary, ph: 'John Doe' },
                          ].map(f => (
                            <div key={f.label}>
                              <label className="text-xs text-[#848e9c] mb-1.5 block">{f.label}</label>
                              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} className={inp} />
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={handleSaveNewMethod} disabled={savingMethod}
                        className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2">
                        {savingMethod ? 'Saving…' : 'Save & Select This Method'}
                        {!savingMethod && <CheckCircle size={13} />}
                      </button>
                    </div>
                  )}

                  {!showAddMethod && (
                    <button disabled={!wdSelectedId}
                      onClick={() => setWdStep(3)}
                      className="w-full bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2">
                      Next: Review & Confirm <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Wd Step 3 — Review + PIN */}
              {wdStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setWdStep(2)} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#2b3139] transition"><ChevronLeft size={14} /></button>
                    <h2 className="text-sm font-semibold text-[#eaecef]">Review Withdrawal</h2>
                  </div>

                  {/* Summary card */}
                  <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#848e9c]">Amount</span>
                      <span className="text-sm font-bold font-mono text-[#f6465d]">${parseFloat(wdAmount).toFixed(2)} USDT</span>
                    </div>
                    {selectedMethod && (
                      <>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-[#848e9c] flex-shrink-0">Method</span>
                          <div className="text-right">
                            <p className="text-xs font-medium text-[#eaecef]">{selectedMethod.label}</p>
                            <p className={`text-[10px] font-medium ${wdTypeColor(selectedMethod.type)}`}>{wdTypeLabel(selectedMethod.type)}</p>
                          </div>
                        </div>
                        {selectedMethod.type !== 'bank' && selectedMethod.address && (
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs text-[#848e9c] flex-shrink-0">Address</span>
                            <span className="text-[10px] font-mono text-[#eaecef] text-right break-all">{selectedMethod.address}</span>
                          </div>
                        )}
                        {selectedMethod.type === 'bank' && (
                          <>
                            {selectedMethod.bank_name && <div className="flex justify-between"><span className="text-xs text-[#848e9c]">Bank</span><span className="text-xs text-[#eaecef]">{selectedMethod.bank_name}</span></div>}
                            <div className="flex justify-between"><span className="text-xs text-[#848e9c]">Account</span><span className="text-xs font-mono text-[#eaecef]">{selectedMethod.bank_account}</span></div>
                          </>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[#848e9c]">Fee</span>
                          <span className="text-xs text-[#0ecb81]">Free</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-[#2b3139] pt-3 flex justify-between items-center">
                      <span className="text-xs font-semibold text-[#848e9c]">You Receive</span>
                      <span className="text-sm font-bold font-mono text-[#eaecef]">${parseFloat(wdAmount).toFixed(2)} USDT</span>
                    </div>
                  </div>

                  {/* Transfer PIN */}
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 flex items-center gap-1"><Lock size={10} /> Transfer PIN *</label>
                    <div className="relative">
                      <input type={showPin ? 'text' : 'password'} value={wdPin} onChange={e => setWdPin(e.target.value)}
                        placeholder="Your 4–6 digit PIN" maxLength={6} className={`${inp} tracking-widest`} />
                      <button type="button" onClick={() => setShowPin(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef] text-xs">{showPin ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>

                  <div className="bg-[#f6465d]/5 border border-[#f6465d]/20 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle size={13} className="text-[#f6465d] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-[#848e9c]">All Withdrawals are pending and will be processed within 24 hours. Your balance is pending.</p>
                  </div>

                  <button onClick={handleWithdraw} disabled={submitting || !wdPin.trim()}
                    className="w-full bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    {submitting ? 'Submitting…' : 'Confirm Withdrawal'}
                    {!submitting && <ArrowUpRight size={14} />}
                  </button>
                </div>
              )}
            </div>
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

        </div>

{/* Payout method management card — shown when withdraw tab is active */}
        {tab === 'withdraw' && wdMethodsLoaded && (
          <div className="lg:col-span-2 bg-[#161a1e] border-[#2b3139] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-[#848e9c]" />
              <h3 className="text-sm font-semibold text-[#eaecef]">Your Payout Methods</h3>
              <span className="text-[10px] text-[#848e9c] bg-[#2b3139] px-2 py-0.5 rounded-full">{wdMethods.length} saved</span>
            </div>
            {wdMethods.length === 0? (
              <p className="text-xs text-[#848e9c]">No payout methods saved. Add one in Step 2 of the withdrawal flow above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {wdMethods.map(m => (
                  <div key={m.id} className="flex items-center gap-2 bg-[#0b0e11] border-[#2b3139] rounded-xl px-3 py-2">
                    <span className={`text-sm font-bold ${wdTypeColor(m.type)}`}>{wdTypeIcon(m.type)}</span>
                    <div>
                      <p className="text-[11px] font-medium text-[#eaecef]">{m.label}</p>
                      <p className="text-[9px] text-[#848e9c]">{wdTypeLabel(m.type)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right: Transaction History */}
        <div className="bg-[#161a1e] border-[#2b3139] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#eaecef]">Recent Transactions</h2>
            <span className="text-xs text-[#848e9c]">{txs.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[520px]">
            {loading? (
              <div className="py-12 text-center text-[#848e9c] text-sm">Loading...</div>
            ) : txs.length === 0? (
              <div className="py-12 flex-col items-center gap-2">
                <RefreshCw size={24} className="text-[#2b3139]" />
                <p className="text-sm text-[#848e9c]">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2b3139]/50">
                {txs.map(tx => {
                  const isPendingDeposit = tx.tx_type === 'deposit' && tx.status === 'pending'
                  return (
                    <div key={tx.id} className="px-4 py-3 hover:bg-[#1e2329] transition">
                      <div className="flex items-center gap-3">
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
                      {/* Countdown row for pending deposits */}
                      {isPendingDeposit && tx.created_at && (
                        <div className="mt-1.5 ml-9 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-[#848e9c]">Expires in:</span>
                            <DepositCountdown
                              createdAt={tx.created_at}
                              onExpired={() => handleCancelDeposit(tx.id)}
                            />
                          </div>
                          <button
                            onClick={() => handleCancelDeposit(tx.id)}
                            className="text-[9px] text-[#f6465d] hover:underline flex items-center gap-0.5">
                            <XCircle size={9} /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}