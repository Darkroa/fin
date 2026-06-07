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
  Server, ShoppingBag, RefreshCw, Package,
  CheckCircle, Clock, XCircle, TrendingUp,
  X, CalendarRange, BarChart2,
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

type StoreTab = 'products' | 'vps' | 'asset' | 'history'

function statusBadge(s: string) {
  if (s === 'completed' || s === 'approved')
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81] font-medium"><CheckCircle size={9} />Active</span>
  if (s === 'rejected' || s === 'failed' || s === 'cancelled')
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d] font-medium"><XCircle size={9} />{s === 'cancelled' ? 'Closed' : 'Rejected'}</span>
  return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-medium"><Clock size={9} />Pending</span>
}

function RoiBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#848e9c] flex items-center gap-1"><BarChart2 size={9} />ROI</span>
        <span className="text-[10px] font-bold text-[#0ecb81]">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#2b3139] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0ecb81] to-[#00a868] transition-all"
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  )
}

export default function StorePage() {
  const { user, setUser } = useAuthStore()
  const { currency } = useLanguage()
  const [tab, setTab] = useState<StoreTab>('products')
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
        if (Array.isArray(v.data) && v.data.length > 0) setVpsPlans(v.data)
        if (Array.isArray(a.data) && a.data.length > 0) setAssetProducts(a.data)
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
      await buyAsset({
        asset_id: asset.id, name: asset.name, price: asset.price,
        start_date: asset.start_date, end_date: asset.end_date, roi_percent: asset.roi_percent,
      })
      toast.success(`${asset.name} purchase submitted — pending admin approval`)
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
      await rentVps({
        plan_id: plan.id, name: plan.name, price: plan.price,
        start_date: plan.start_date, end_date: plan.end_date, roi_percent: plan.roi_percent,
      })
      toast.success(`${plan.name} rental submitted — pending admin approval`)
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

  const TABS: { key: StoreTab; label: string }[] = [
    { key: 'products', label: 'Products' },
    { key: 'vps',      label: 'Rent VPS' },
    { key: 'asset',    label: 'Asset' },
    { key: 'history',  label: 'History' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#eaecef]">Store</h1>

      {/* Balance card */}
      <div className="relative bg-gradient-to-br from-[#1e2329] via-[#181d22] to-[#161a1e] border border-[#2b3139] rounded-2xl p-5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse at top right, rgba(240,185,11,0.08) 0%, transparent 60%)' }} />
        <div className="relative">
          <p className="text-xs text-[#848e9c] font-medium mb-1">Available Balance</p>
          <p className="text-3xl font-bold font-mono text-[#eaecef]">{formatCurrency(balance, currency)}</p>
          <p className="text-xs text-[#848e9c] mt-1">USDT · Used for purchases &amp; rentals</p>
          {/* Quick buttons */}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setTab('vps')}
              className="flex items-center gap-1.5 text-xs bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 border border-[#0ecb81]/25 text-[#0ecb81] px-4 py-2 rounded-xl font-medium transition">
              <Server size={12} /> Rent VPS
            </button>
            <button onClick={() => setTab('asset')}
              className="flex items-center gap-1.5 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/25 text-[#f0b90b] px-4 py-2 rounded-xl font-medium transition">
              <TrendingUp size={12} /> Asset
            </button>
            <button onClick={() => setTab('history')}
              className="flex items-center gap-1.5 text-xs bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 border border-[#a78bfa]/25 text-[#a78bfa] px-4 py-2 rounded-xl font-medium transition">
              <Package size={12} /> History
            </button>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              tab === t.key
                ? 'bg-[#f0b90b] text-black'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Products tab ── */}
      {tab === 'products' && (
        <div className="space-y-4">
          {/* VPS section */}
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
                <div className="py-10 flex items-center justify-center"><RefreshCw size={20} className="text-[#2b3139] animate-spin" /></div>
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
                  {(plan.start_date || plan.end_date || plan.roi_percent) && (
                    <div className="pt-1 border-t border-[#2b3139] space-y-1.5">
                      {(plan.start_date || plan.end_date) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
                          <CalendarRange size={9} />
                          {plan.start_date && <span>{plan.start_date}</span>}
                          {plan.start_date && plan.end_date && <span>→</span>}
                          {plan.end_date && <span>{plan.end_date}</span>}
                        </div>
                      )}
                      {plan.roi_percent != null && plan.roi_percent > 0 && <RoiBar pct={plan.roi_percent} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Asset section */}
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
                <div className="py-10 flex items-center justify-center"><RefreshCw size={20} className="text-[#2b3139] animate-spin" /></div>
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
                  {(asset.start_date || asset.end_date || asset.roi_percent) && (
                    <div className="pt-1 border-t border-[#2b3139] space-y-1.5">
                      {(asset.start_date || asset.end_date) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
                          <CalendarRange size={9} />
                          {asset.start_date && <span>{asset.start_date}</span>}
                          {asset.start_date && asset.end_date && <span>→</span>}
                          {asset.end_date && <span>{asset.end_date}</span>}
                        </div>
                      )}
                      {asset.roi_percent != null && asset.roi_percent > 0 && <RoiBar pct={asset.roi_percent} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Rent VPS tab ── */}
      {tab === 'vps' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2b3139] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0ecb81]/10 flex items-center justify-center flex-shrink-0">
              <Server size={15} className="text-[#0ecb81]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#eaecef]">Rent a VPS</h2>
              <p className="text-[10px] text-[#848e9c]">Run your bot 24/7 on a dedicated server</p>
            </div>
          </div>
          <div className="p-4 space-y-2.5">
            {loading ? (
              <div className="py-10 flex items-center justify-center"><RefreshCw size={20} className="text-[#2b3139] animate-spin" /></div>
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
                    <p className="text-sm font-bold text-[#0ecb81]">${plan.price}<span className="text-[10px] text-[#848e9c] font-normal">/mo</span></p>
                    <button onClick={() => handleRentVps(plan)} disabled={rentingId === plan.id}
                      className="mt-1 flex items-center gap-1.5 text-xs bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 disabled:opacity-60 text-[#0ecb81] px-3 py-1 rounded-lg transition font-medium ml-auto">
                      {rentingId === plan.id && <RefreshCw size={10} className="animate-spin" />} Rent
                    </button>
                  </div>
                </div>
                {(plan.start_date || plan.end_date || plan.roi_percent) && (
                  <div className="pt-1 border-t border-[#2b3139] space-y-1.5">
                    {(plan.start_date || plan.end_date) && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
                        <CalendarRange size={9} />
                        {plan.start_date && <span>{plan.start_date}</span>}
                        {plan.start_date && plan.end_date && <span>→</span>}
                        {plan.end_date && <span>{plan.end_date}</span>}
                      </div>
                    )}
                    {plan.roi_percent != null && plan.roi_percent > 0 && <RoiBar pct={plan.roi_percent} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Asset tab ── */}
      {tab === 'asset' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden">
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
              <div className="py-10 flex items-center justify-center"><RefreshCw size={20} className="text-[#2b3139] animate-spin" /></div>
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
                {(asset.start_date || asset.end_date || asset.roi_percent) && (
                  <div className="pt-1 border-t border-[#2b3139] space-y-1.5">
                    {(asset.start_date || asset.end_date) && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
                        <CalendarRange size={9} />
                        {asset.start_date && <span>{asset.start_date}</span>}
                        {asset.start_date && asset.end_date && <span>→</span>}
                        {asset.end_date && <span>{asset.end_date}</span>}
                      </div>
                    )}
                    {asset.roi_percent != null && asset.roi_percent > 0 && <RoiBar pct={asset.roi_percent} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2b3139] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#a78bfa]/10 flex items-center justify-center flex-shrink-0">
              <Package size={15} className="text-[#a78bfa]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#eaecef]">My Purchases</h2>
              <p className="text-[10px] text-[#848e9c]">Your active assets &amp; VPS rentals</p>
            </div>
            <span className="ml-auto text-[10px] text-[#848e9c] bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2 py-1">
              {purchases.length} order{purchases.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-xl bg-[#0b0e11] border border-[#2b3139] animate-pulse" />
                ))}
              </div>
            ) : purchases.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-[#0b0e11] border border-[#2b3139] flex items-center justify-center">
                  <Package size={20} className="text-[#2b3139]" />
                </div>
                <p className="text-sm text-[#848e9c]">No purchases yet</p>
                <p className="text-[10px] text-[#4a5568]">Buy an asset or rent a VPS to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map(p => {
                  const isAsset   = p.tx_type === 'asset'
                  const isActive  = p.status === 'completed' || p.status === 'approved'
                  const isClosed  = p.status === 'cancelled'
                  return (
                    <div key={p.id}
                      className={`bg-[#0b0e11] border rounded-xl px-4 py-3 space-y-2.5 transition
                        ${isClosed ? 'border-[#f6465d]/20 opacity-60' : isActive ? 'border-[#0ecb81]/20 hover:border-[#0ecb81]/35' : 'border-[#2b3139]'}`}>

                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0
                          ${isAsset ? 'bg-[#f0b90b]/10 border-[#f0b90b]/25' : 'bg-[#0ecb81]/10 border-[#0ecb81]/25'}`}>
                          {isAsset
                            ? <TrendingUp size={14} className="text-[#f0b90b]" />
                            : <Server     size={14} className="text-[#0ecb81]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#eaecef] truncate">
                              {p.asset || (isAsset ? 'Asset Purchase' : 'VPS Rental')}
                            </p>
                            <p className={`text-sm font-bold font-mono flex-shrink-0 ${isActive ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                              ${Number(p.amount_usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold
                                ${isAsset ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'bg-[#0ecb81]/10 text-[#0ecb81]'}`}>
                                {isAsset ? 'ASSET' : 'VPS'}
                              </span>
                              <span className="text-[10px] text-[#4a5568]">
                                {new Date(p.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {statusBadge(p.status)}
                          </div>
                        </div>
                      </div>

                      {/* Dates row */}
                      {(p.start_date || p.end_date) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c] pl-[52px]">
                          <CalendarRange size={9} />
                          {p.start_date && <span>Start: <span className="text-[#eaecef]">{p.start_date}</span></span>}
                          {p.start_date && p.end_date && <span className="text-[#2b3139]">·</span>}
                          {p.end_date && <span>End: <span className="text-[#eaecef]">{p.end_date}</span></span>}
                        </div>
                      )}

                      {/* ROI bar */}
                      {p.roi_percent != null && p.roi_percent > 0 && (
                        <div className="pl-[52px]">
                          <RoiBar pct={p.roi_percent} />
                        </div>
                      )}

                      {/* Close button */}
                      {!isClosed && (
                        <div className="pl-[52px]">
                          <button
                            onClick={() => handleClose(p)}
                            disabled={closingId === p.id}
                            className="flex items-center gap-1.5 text-[10px] text-[#f6465d] hover:text-[#fff] bg-[#f6465d]/8 hover:bg-[#f6465d]/20 border border-[#f6465d]/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {closingId === p.id
                              ? <RefreshCw size={9} className="animate-spin" />
                              : <X size={9} />}
                            Close Subscription
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
      )}
    </div>
  )
}
