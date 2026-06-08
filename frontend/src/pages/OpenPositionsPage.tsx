import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  BarChart2, ChevronDown, Minus, Plus, TrendingUp, TrendingDown,
  Wifi, WifiOff, X, RefreshCw, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getOpenPositions, closeManualTrade, executeTrade } from '../lib/api'

const PAIRS = [
  'BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','DOGE/USDT','ADA/USDT','AVAX/USDT',
  'LINK/USDT','DOT/USDT','UNI/USDT','MATIC/USDT','LTC/USDT','XLM/USDT',
  'XAU/USD','XAG/USD','OIL/WTI','AAPL','TSLA','NVDA','MSFT','SPY',
]
const FALLBACKS: Record<string, { price: number; change: number }> = {
  'BTC/USDT': { price: 97000, change: 2.4 }, 'ETH/USDT': { price: 3200, change: 1.8 },
  'XAU/USD':  { price: 3290,  change: 0.5 }, 'NVDA':     { price: 875,  change: 1.8 },
}
const LEVERAGE_STEPS = [1, 2, 5, 10, 20, 50, 100, 125]

interface OpenPosition {
  id: number; ticker: string; price: number; qty: number; exchange: string;
  created_at: string; current_price: number; unrealized_pnl: number; leverage?: number; pnl_pct?: number
}

function useWsBalance(token: string | null) {
  const [balance, setBalance] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  useEffect(() => {
    if (!token) return
    let alive = true
    const connect = () => {
      if (!alive) return
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${proto}//${window.location.host}/ws/live?token=${encodeURIComponent(token)}`)
        wsRef.current = ws
        ws.onopen    = () => alive && setConnected(true)
        ws.onclose   = () => { setConnected(false); if (alive) setTimeout(connect, 4000) }
        ws.onerror   = () => { ws.close() }
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data)
            if (d.type === 'balance' && typeof d.balance_usdt === 'number') setBalance(d.balance_usdt)
          } catch { /* */ }
        }
      } catch { /* */ }
    }
    connect()
    return () => { alive = false; wsRef.current?.close() }
  }, [token])
  return { balance, connected }
}

export default function OpenPositionsPage() {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const { balance: wsBalance, connected: wsConnected } = useWsBalance(token)

  const [openPositions, setOpenPos] = useState<OpenPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [closingId, setClosingId] = useState<number | null>(null)

  const [pair, setPair] = useState('BTC/USDT')
  const [showPairs, setShowP] = useState(false)
  const [showBuySell, setShowBuySell] = useState(true)
  const [lotSize, setLotSize] = useState('0.01')
  const [leverageIdx, setLeverageIdx] = useState(0)
  const leverage = LEVERAGE_STEPS[leverageIdx]
  const [orderLoading, setOrderLoading] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userBalance = user?.balance_usdt ?? 0
  const liveBalance = wsBalance ?? userBalance

  const fetchPositions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOpenPositions()
      setOpenPos(res.data?.positions ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  const totalPositionValue = openPositions.reduce((s, p) => s + p.qty * (p.current_price || p.price), 0)
  const marginUsed = totalPositionValue
  const availableMargin = Math.max(0, liveBalance - marginUsed)
  const unrealizedPnl = openPositions.reduce((s, p) => s + (p.unrealized_pnl ?? 0), 0)

  const handleQuickTrade = async (side: 'buy' | 'sell') => {
    const ls = parseFloat(lotSize) || 0.01
    setOrderLoading(true)
    try {
      const priceData = FALLBACKS[pair] ?? { price: 100 }
      const res = await executeTrade({ pair, side, order_type: 'market', price: priceData.price, amount: ls, paper: false, leverage: leverage > 1 ? leverage : undefined })
      const d = res.data
      toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} ${ls} ${pair.split('/')[0]} @ market`, { duration: 4000 })
      if (d?.trade?.new_balance !== undefined)
        useAuthStore.getState().setUser({ ...useAuthStore.getState().user!, balance_usdt: d.trade.new_balance })
      fetchPositions()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Order failed')
    } finally { setOrderLoading(false) }
  }

  const handleClose = async (id: number) => {
    setClosingId(id)
    try {
      const res = await closeManualTrade(id)
      const d = res.data; const pnl = d.pnl ?? 0
      toast.success(`Closed @ $${d.close_price?.toLocaleString('en-US', { maximumFractionDigits: 2 })} — P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, { duration: 5000 })
      if (d.new_balance !== undefined) useAuthStore.getState().setUser({ ...useAuthStore.getState().user!, balance_usdt: d.new_balance })
      fetchPositions()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to close position')
    } finally { setClosingId(null) }
  }

  return (
    <div className="space-y-3">

      {/* Back */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
          <ArrowLeft size={13} /> Back
        </button>
        <h1 className="text-xl font-bold text-[#eaecef]">Open Positions</h1>
      </div>

      {/* Pair selector + Quick Buy/Sell (merged, tap-hold to hide) */}
      <div
        className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-visible"
        onMouseDown={() => { holdTimerRef.current = setTimeout(() => setShowBuySell(v => !v), 3500) }}
        onMouseUp={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
        onMouseLeave={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
        onTouchStart={() => { holdTimerRef.current = setTimeout(() => setShowBuySell(v => !v), 3500) }}
        onTouchEnd={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
        onTouchCancel={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
          <div className="relative">
            <button
              onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
              onClick={() => setShowP(v => !v)}
              className="flex items-center gap-1.5 hover:bg-[#2b3139]/60 rounded-lg px-1.5 py-1 transition"
            >
              <span className="text-sm font-bold text-[#eaecef]">{pair}</span>
              <ChevronDown size={11} className="text-[#848e9c]" />
            </button>
            {showPairs && (
              <div className="absolute top-full mt-1 left-0 bg-[#1e2329] border border-[#2b3139] rounded-xl z-30 min-w-[140px] shadow-xl max-h-56 overflow-y-auto">
                {PAIRS.map(p => (
                  <button key={p} onClick={() => { setPair(p); setShowP(false) }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#2b3139] transition ${p === pair ? 'text-[#f0b90b] font-semibold' : 'text-[#eaecef]'}`}>{p}</button>
                ))}
              </div>
            )}
          </div>
          {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse flex-shrink-0" />}
          <span className={`text-[10px] ml-auto ${wsConnected ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
            <Wifi size={9} className="inline mr-0.5" />{wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {showBuySell && (
          <div
            className="border-t border-[#2b3139] px-3 py-2 flex items-center gap-2"
            onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
          >
            <button type="button" disabled={orderLoading} onClick={() => handleQuickTrade('sell')}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#f6465d]/10 border border-[#f6465d]/30 text-[#f6465d] hover:bg-[#f6465d] hover:text-white disabled:opacity-50 transition active:scale-[0.98]">
              Sell
            </button>
            <div className="flex items-center bg-[#0b0e11] border border-[#2b3139] rounded-lg overflow-hidden flex-shrink-0"
              onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
              <button type="button" onClick={() => {
                const n = Math.max(0.01, parseFloat(lotSize || '0.01') - 0.01)
                setLotSize(n.toFixed(2))
              }} className="px-2 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition"><Minus size={9} /></button>
              <span className="w-12 text-center text-xs font-mono text-[#eaecef] font-bold py-1.5">{lotSize}</span>
              <button type="button" onClick={() => {
                const n = Math.min(100, parseFloat(lotSize || '0.01') + 0.01)
                setLotSize(n.toFixed(2))
              }} className="px-2 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition"><Plus size={9} /></button>
            </div>
            <button type="button" disabled={orderLoading} onClick={() => handleQuickTrade('buy')}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#0ecb81]/10 border border-[#0ecb81]/30 text-[#0ecb81] hover:bg-[#0ecb81] hover:text-black disabled:opacity-50 transition active:scale-[0.98]">
              Buy
            </button>
          </div>
        )}
      </div>

      {/* Balance / Margin stats */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
          <p className="text-[9px] text-[#848e9c] mb-0.5">Balance</p>
          <p className="text-sm font-bold font-mono text-[#eaecef]">${liveBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
          <p className="text-[9px] text-[#848e9c] mb-0.5">Margin Used</p>
          <p className="text-sm font-bold font-mono text-[#f0b90b]">${marginUsed.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
          <p className="text-[9px] text-[#848e9c] mb-0.5">Available</p>
          <p className="text-sm font-bold font-mono text-[#0ecb81]">${availableMargin.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
          <p className="text-[9px] text-[#848e9c] mb-0.5">Unrealized P&L</p>
          <p className={`text-sm font-bold font-mono ${unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Positions list */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <BarChart2 size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">{openPositions.length} Open Position{openPositions.length !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={fetchPositions} className="p-1.5 rounded-lg hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {openPositions.length === 0 ? (
          <div className="py-14 text-center">
            <BarChart2 size={28} className="text-[#2b3139] mx-auto mb-3" />
            <p className="text-sm text-[#848e9c]">No open positions</p>
            <button onClick={() => navigate('/app/trade')}
              className="mt-3 px-4 py-2 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-xs text-[#f0b90b] hover:bg-[#f0b90b]/20 transition">
              Go to Trade
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#2b3139]/50">
            {openPositions.map(pos => {
              const pnl = pos.unrealized_pnl ?? 0
              const pnlPct = pos.pnl_pct ?? (pos.price > 0 ? ((pos.current_price - pos.price) / pos.price) * 100 : 0)
              return (
                <div key={pos.id} className="px-4 py-3 hover:bg-[#1e2329] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-[#eaecef]">{pos.ticker}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20">
                          {pos.exchange || 'Platform'}
                        </span>
                        {(pos.leverage ?? 1) > 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#627eea]/10 text-[#627eea] border border-[#627eea]/20">
                            {pos.leverage}x
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-[10px]">
                        <div>
                          <span className="text-[#848e9c]">Entry</span>
                          <p className="text-[#eaecef] font-mono font-semibold">${pos.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</p>
                        </div>
                        <div>
                          <span className="text-[#848e9c]">Current</span>
                          <p className="text-[#eaecef] font-mono font-semibold">${pos.current_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</p>
                        </div>
                        <div>
                          <span className="text-[#848e9c]">Qty</span>
                          <p className="text-[#eaecef] font-mono font-semibold">{pos.qty}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </p>
                        <p className={`text-[10px] ${pnlPct >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {pnlPct >= 0 ? <TrendingUp size={8} className="inline mr-0.5" /> : <TrendingDown size={8} className="inline mr-0.5" />}
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </p>
                      </div>
                      <button
                        onClick={() => handleClose(pos.id)}
                        disabled={closingId === pos.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#f6465d]/10 border border-[#f6465d]/30 text-[#f6465d] hover:bg-[#f6465d] hover:text-white disabled:opacity-50 transition"
                      >
                        <X size={9} /> {closingId === pos.id ? 'Closing…' : 'Close'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
