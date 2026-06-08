import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useLanguage } from '../contexts/LanguageContext'
import { formatCurrency } from '../lib/i18n'
import {
  getVpsPlans, getAssetProducts, buyAsset, rentVps,
  getMe, getMyTransactions, closePurchase,
} from '../lib/api'
import toast from 'react-hot-toast'
import {
  Server, ShoppingBag, RefreshCw, CheckCircle,
  Clock, XCircle, TrendingUp, X, CalendarRange,
} from 'lucide-react'

interface VpsPlan {
  id: number; name: string; price: number; specs: string
  start_date?: string; end_date?: string; roi_percent?: number; description?: string
}
interface AssetProduct {
  id: number; name: string; price: number; icon: string
  start_date?: string; end_date?: string; roi_percent?: number; description?: string
}
interface Purchase {
  id: number; tx_type: string; asset: string; amount_usdt: number
  status: string; note?: string; created_at: string
  start_date?: string; end_date?: string; roi_percent?: number
}

function statusBadge(s: string) {
  if (s === 'completed' || s === 'approved')
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81] font-medium"><CheckCircle size={9} />Active</span>
  if (s === 'rejected' || s === 'failed' || s === 'cancelled')
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d] font-medium"><XCircle size={9} />{s === 'cancelled' ? 'Closed' : 'Rejected'}</span>
  return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-medium"><Clock size={9} />Pending</span>
}

function RoiChart({ roi }: { roi: number }) {
  const W = 120; const H = 36; const pad = 4
  const N = 30
  const pts: [number, number][] = []
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const trend = t * roi
    const swing = Math.sin(t * Math.PI * 3.5) * roi * 0.18 * Math.exp(-t * 1.2)
    const val = Math.max(0, trend + swing)
    const x = pad + t * (W - pad * 2)
    const maxVal = roi * 1.15
    const y = H - pad - (val / maxVal) * (H - pad * 2)
    pts.push([x, y])
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i]
    const mx = (p[0] + c[0]) / 2
    d += ` C ${mx.toFixed(1)} ${p[1].toFixed(1)} ${mx.toFixed(1)} ${c[1].toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  const fillD = d + ` L ${last[0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`

  return (
    <div className="flex items-center gap-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
        <defs>
          <linearGradient id="roi-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ecb81" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0ecb81" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#roi-fill)" />
        <path d={d} fill="none" stroke="#0ecb81" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="2.5" fill="#0ecb81" />
      </svg>
      <span className="text-[11px] font-bold text-[#0ecb81]">+{roi.toFixed(1)}%</span>
    </div>
  )
}

export default function StorePage() {
  const { user, setUser } = useAuthStore()
  const { currency } = useLanguage()
  const [vpsPlans, setVpsPlans]           = useState<VpsPlan[]>([])
  const [assetProducts, setAssetProducts] = useState<AssetProduct[]>([])
  const [purchases, setPurchases]         = useState<Purchase[]>([])
  const [loading, setLoading]             = useState(true)
  const [buyingId, setBuyingId]           = useState<number | null>(null)
  const [rentingId, setRentingId]         = useState<number | null>(null)
  const [closingId, setClosingId]         = useState<number | null>(null)
  const vpsRef   = useRef<HTMLDivElement>(null)
  const assetRef = useRef<HTMLDivElement>(null)

  const balance = user?.balance_usdt ?? 0

  useEffect(() => {
    Promise.all([getVpsPlans(), getAssetProducts(), getMyTransactions()])
      .then(([v, a, txRes]) => {
        if (Array.isArray(v.data)) setVpsPlans(v.data)
        if (Array.isArray(a.data)) setAssetProducts(a.data)
        if (Array.isArray(txRes.data))
          setPurchases(txRes.data.filter((t: Purchase) => t.tx_type === 'vps' || t.tx_type === 'asset'))
      })
      .finally(() => setLoading(false))
  }, [])

  const refresh = async () => {
    const [meRes, txRes] = await Promise.all([getMe(), getMyTransactions()])
    if (meRes.data) setUser(meRes.data)
    if (Array.isArray(txRes.data))
      setPurchases(txRes.data.filter((t: Purchase) => t.tx_type === 'vps' || t.tx_type === 'asset'))
  }

  const handleBuyAsset = async (asset: AssetProduct) => {
    if (balance < asset.price) return toast.error('Insufficient balance')
    setBuyingId(asset.id)
    try {
      await buyAsset({ asset_id: asset.id, name: asset.name, price: asset.price, start_date: asset.start_date, end_date: asset.end_date, roi_percent: asset.roi_percent })
      toast.success(`${asset.name} purchase submitted`)
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Purchase failed')
    } finally { setBuyingId(null) }
  }

  const handleRentVps = async (plan: VpsPlan) => {
    if (balance < plan.price) return toast.error('Insufficient balance')
    setRentingId(plan.id)
    try {
      await rentVps({ plan_id: plan.id, name: plan.name, price: plan.price, start_date: plan.start_date, end_date: plan.end_date, roi_percent: plan.roi_percent })
      toast.success(`${plan.name} rental submitted`)
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Rental failed')
    } finally { setRentingId(null) }
  }

  const handleClose = async (p: Purchase) => {
    if (!confirm('Close this subscription? This action cannot be undone.')) return
    setClosingId(p.id)
    try {
      await closePurchase(p.id)
      toast.success('Subscription closed')
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to close')
    } finally { setClosingId(null) }
  }

  const activePurchases  = purchases.filter(p => p.status === 'completed' || p.status === 'approved' || p.status === 'pending')
  const closedPurchases  = purchases.filter(p => p.status === 'cancelled' || p.status === 'rejected')

  const totalInvested    = activePurchases.reduce((s, p) => s + p.amount_usdt, 0)
  const unrealizedPL     = activePurchases.reduce((s, p) => s + p.amount_usdt * ((p.roi_percent ?? 0) / 100), 0)
  const realizedPL       = closedPurchases.reduce((s, p) => s + p.amount_usdt * ((p.roi_percent ?? 0) / 100), 0)
  const avgRoi           = activePurchases.length > 0
    ? activePurchases.reduce((s, p) => s + (p.roi_percent ?? 0), 0) / activePurchases.length
    : 0

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#eaecef]">Store</h1>

      {/* Balance card */}
      <div className="relative bg-gradient-to-br from-[#1e2329] via-[#181d22] to-[#161a1e] border border-[#2b3139] rounded-2xl p-5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse at top right, rgba(240,185,11,0.08) 0%, transparent 60%)' }} />
        <div className="relative">
          <p className="text-xs text-[#848e9c] font-medium mb-1">Available Balance</p>
          <p className="text-3xl font-bold font-mono text-[#eaecef]">{formatCurrency(balance, currency)}</p>
          <p className="text-xs text-[#848e9c] mt-1">USDT · Used for purchases &amp; rentals</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => vpsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 text-xs bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 border border-[#0ecb81]/25 text-[#0ecb81] px-4 py-2 rounded-xl font-medium transition">
              <Server size={12} /> Rent VPS
            </button>
            <button onClick={() => assetRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/25 text-[#f0b90b] px-4 py-2 rounded-xl font-medium transition">
              <TrendingUp size={12} /> Asset
            </button>
          </div>
        </div>
      </div>

      {/* ROI Earnings Calculator */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#eaecef]">ROI Earnings Calculator</p>
          <span className="text-[10px] text-[#848e9c] bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2 py-1">
            {activePurchases.length} active
          </span>
        </div>

        {/* Chart */}
        {avgRoi > 0 && (
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3">
            <p className="text-[10px] text-[#848e9c] mb-2">Avg ROI Curve</p>
            <RoiChart roi={avgRoi} />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3">
            <p className="text-[10px] text-[#848e9c] mb-1">Purchases</p>
            <p className="text-base font-bold font-mono text-[#eaecef]">{activePurchases.length}</p>
          </div>
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3">
            <p className="text-[10px] text-[#848e9c] mb-1">Total Invested</p>
            <p className="text-base font-bold font-mono text-[#eaecef] truncate">${totalInvested.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3">
            <p className="text-[10px] text-[#848e9c] mb-1">Unrealized P&L</p>
            <p className={`text-base font-bold font-mono truncate ${unrealizedPL >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              +${unrealizedPL.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3">
            <p className="text-[10px] text-[#848e9c] mb-1">Realized P&L</p>
            <p className={`text-base font-bold font-mono truncate ${realizedPL >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              +${realizedPL.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Active Purchases */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2b3139] flex items-center gap-2">
          <CheckCircle size={14} className="text-[#0ecb81]" />
          <span className="text-sm font-bold text-[#eaecef]">Active Subscriptions</span>
          <span className="ml-auto text-[10px] text-[#848e9c] bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2 py-1">
            {activePurchases.length}
          </span>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-[#0b0e11] border border-[#2b3139] animate-pulse" />)}
            </div>
          ) : activePurchases.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-[#0b0e11] border border-[#2b3139] flex items-center justify-center">
                <ShoppingBag size={20} className="text-[#2b3139]" />
              </div>
              <p className="text-sm text-[#848e9c]">No active purchases</p>
              <p className="text-[10px] text-[#4a5568]">Scroll down to buy an asset or rent a VPS</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activePurchases.map(p => {
                const isAsset  = p.tx_type === 'asset'
                const isActive = p.status === 'completed' || p.status === 'approved'
                const projEarn = p.amount_usdt * ((p.roi_percent ?? 0) / 100)
                return (
                  <div key={p.id}
                    className={`bg-[#0b0e11] border rounded-xl px-4 py-3 space-y-2 ${isActive ? 'border-[#0ecb81]/20' : 'border-[#2b3139]'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0
                        ${isAsset ? 'bg-[#f0b90b]/10 border-[#f0b90b]/25' : 'bg-[#0ecb81]/10 border-[#0ecb81]/25'}`}>
                        {isAsset
                          ? <TrendingUp size={13} className="text-[#f0b90b]" />
                          : <Server size={13} className="text-[#0ecb81]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#eaecef] truncate">
                            {p.asset || (isAsset ? 'Asset' : 'VPS')}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className={`text-xs font-bold font-mono ${isActive ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                              ${p.amount_usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <button onClick={() => handleClose(p)} disabled={closingId === p.id}
                              className="flex items-center gap-1 text-[10px] text-[#f6465d] hover:bg-[#f6465d]/15 border border-[#f6465d]/20 px-2 py-1 rounded-lg transition disabled:opacity-50">
                              {closingId === p.id ? <RefreshCw size={8} className="animate-spin" /> : <X size={8} />}
                              Close
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold
                            ${isAsset ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'bg-[#0ecb81]/10 text-[#0ecb81]'}`}>
                            {isAsset ? 'ASSET' : 'VPS'}
                          </span>
                          <span className="text-[10px] text-[#4a5568]">{new Date(p.created_at).toLocaleDateString()}</span>
                          {statusBadge(p.status)}
                        </div>
                      </div>
                    </div>

                    {(p.start_date || p.end_date) && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c] pl-12">
                        <CalendarRange size={9} />
                        {p.start_date && <span>{p.start_date}</span>}
                        {p.start_date && p.end_date && <span>→</span>}
                        {p.end_date && <span>{p.end_date}</span>}
                      </div>
                    )}

                    {p.roi_percent != null && p.roi_percent > 0 && (
                      <div className="pl-12">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#848e9c]">ROI Projection</span>
                          <span className="text-[10px] text-[#0ecb81] font-bold">+${projEarn.toFixed(2)}</span>
                        </div>
                        <RoiChart roi={p.roi_percent} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* VPS Plans */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden" ref={vpsRef}>
        <div className="px-5 py-4 border-b border-[#2b3139] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0ecb81]/10 flex items-center justify-center flex-shrink-0">
            <Server size={15} className="text-[#0ecb81]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#eaecef]">VPS Plans</h2>
            <p className="text-[10px] text-[#848e9c]">Run your bot 24/7 on a dedicated server</p>
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {loading ? (
            <div className="py-8 flex items-center justify-center"><RefreshCw size={18} className="text-[#2b3139] animate-spin" /></div>
          ) : vpsPlans.length === 0 ? (
            <p className="text-xs text-[#848e9c] text-center py-8">No VPS plans available</p>
          ) : vpsPlans.map(plan => (
            <div key={plan.id}
              className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 hover:border-[#0ecb81]/30 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#eaecef]">{plan.name}</p>
                  <p className="text-xs text-[#848e9c] truncate">{plan.specs}</p>
                  {plan.description && <p className="text-[10px] text-[#4a5568] mt-0.5">{plan.description}</p>}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-[#0ecb81]">
                    ${plan.price}<span className="text-[10px] text-[#848e9c] font-normal">/mo</span>
                  </p>
                  <button onClick={() => handleRentVps(plan)} disabled={rentingId === plan.id}
                    className="mt-1 flex items-center gap-1.5 text-xs bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 disabled:opacity-60 text-[#0ecb81] px-3 py-1 rounded-lg transition font-medium ml-auto">
                    {rentingId === plan.id && <RefreshCw size={10} className="animate-spin" />} Rent
                  </button>
                </div>
              </div>
              {(plan.start_date || plan.end_date) && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
                  <CalendarRange size={9} />
                  {plan.start_date && <span>{plan.start_date}</span>}
                  {plan.start_date && plan.end_date && <span>→</span>}
                  {plan.end_date && <span>{plan.end_date}</span>}
                </div>
              )}
              {plan.roi_percent != null && plan.roi_percent > 0 && <RoiChart roi={plan.roi_percent} />}
            </div>
          ))}
        </div>
      </div>

      {/* Asset Products */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden" ref={assetRef}>
        <div className="px-5 py-4 border-b border-[#2b3139] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={15} className="text-[#f0b90b]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#eaecef]">Buy Crypto Assets</h2>
            <p className="text-[10px] text-[#848e9c]">Purchase directly from your balance</p>
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {loading ? (
            <div className="py-8 flex items-center justify-center"><RefreshCw size={18} className="text-[#2b3139] animate-spin" /></div>
          ) : assetProducts.length === 0 ? (
            <p className="text-xs text-[#848e9c] text-center py-8">No assets available</p>
          ) : assetProducts.map(asset => (
            <div key={asset.id}
              className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 hover:border-[#f0b90b]/30 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f0b90b]/10 flex items-center justify-center font-bold text-[#f0b90b] text-sm flex-shrink-0">
                    {asset.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#eaecef]">{asset.name}</p>
                    <p className="text-xs text-[#848e9c]">${Number(asset.price).toLocaleString()} / unit</p>
                    {asset.description && <p className="text-[10px] text-[#4a5568]">{asset.description}</p>}
                  </div>
                </div>
                <button onClick={() => handleBuyAsset(asset)} disabled={buyingId === asset.id}
                  className="flex items-center gap-1.5 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 disabled:opacity-60 text-[#f0b90b] px-3 py-1.5 rounded-lg transition font-medium flex-shrink-0">
                  {buyingId === asset.id && <RefreshCw size={10} className="animate-spin" />} Buy
                </button>
              </div>
              {(asset.start_date || asset.end_date) && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
                  <CalendarRange size={9} />
                  {asset.start_date && <span>{asset.start_date}</span>}
                  {asset.start_date && asset.end_date && <span>→</span>}
                  {asset.end_date && <span>{asset.end_date}</span>}
                </div>
              )}
              {asset.roi_percent != null && asset.roi_percent > 0 && <RoiChart roi={asset.roi_percent} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
