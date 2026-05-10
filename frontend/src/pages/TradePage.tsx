import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowUpDown, TrendingUp, TrendingDown, ChevronDown,
  Wifi, WifiOff, BarChart2, Activity, Link2, RefreshCw,
  Clock, CheckCircle2, X, Target, AlertTriangle,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useTickerPrices } from '../hooks/useTickerPrices'
import { executeTrade, getBotTrades, getOpenPositions, closeManualTrade } from '../lib/api'

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
const TF    = ['1m', '5m', '15m', '1h', '4h', '1D']
type ChartMode = 'line' | 'candle'

const FALLBACKS: Record<string, { price: number; change: number }> = {
  'BTC/USDT': { price: 81000, change: 2.4 },
  'ETH/USDT': { price: 2380,  change: 1.8 },
  'BNB/USDT': { price: 628,   change: 0.9 },
  'SOL/USDT': { price: 85,    change: 1.2 },
}

function generateLineData(base: number) {
  return Array.from({ length: 48 }, (_, i) => ({
    time:  `${Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`,
    price: base + Math.sin(i * 0.4) * (base * 0.025) + (Math.random() - 0.5) * (base * 0.008),
  }))
}

function generateCandleData(base: number) {
  return Array.from({ length: 24 }, (_, i) => {
    const open  = base + Math.sin(i * 0.6) * (base * 0.02) + (Math.random() - 0.5) * (base * 0.01)
    const close = open + (Math.random() - 0.5) * (base * 0.015)
    const bullish = close >= open
    return {
      time:      `${i}:00`,
      body:      +Math.abs(close - open).toFixed(2),
      bodyStart: +Math.min(open, close).toFixed(2),
      bullish,
      color: bullish ? '#0ecb81' : '#f6465d',
    }
  })
}

function makeOrderBook(base: number) {
  return {
    asks: Array.from({ length: 7 }, (_, i) => ({
      price: base + (i + 1) * (base * 0.00012),
      size:  +(Math.random() * 2).toFixed(4),
    })),
    bids: Array.from({ length: 7 }, (_, i) => ({
      price: base - i * (base * 0.00012),
      size:  +(Math.random() * 2).toFixed(4),
    })),
  }
}

interface ExchangeConn { exchange: string; label: string; api_key_masked: string }
interface TradeRecord {
  id: number; ticker: string; action: string; price: number; qty: number
  pnl: number | null; exchange: string; paper: boolean; created_at: string
}
interface OpenPosition {
  id: number; ticker: string; price: number; qty: number
  exchange: string; created_at: string; current_price: number; unrealized_pnl: number
}

export default function TradePage() {
  const { user }    = useAuthStore()
  const tickerItems = useTickerPrices(30000)

  const [side, setSide]           = useState<'buy' | 'sell'>('buy')
  const [orderType, setType]      = useState<'market' | 'limit'>('limit')
  const [price, setPrice]         = useState('')
  const [amount, setAmount]       = useState('')
  const [stopLoss, setStopLoss]   = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [tf, setTf]               = useState('1h')
  const [pair, setPair]           = useState('BTC/USDT')
  const [showPairs, setShowP]     = useState(false)
  const [chartMode, setChartMode] = useState<ChartMode>('line')
  const [selExchange, setSelExch] = useState<string>('__balance__')
  const [orderLoading, setLoading]= useState(false)
  const [bottomTab, setBottomTab] = useState<'history' | 'positions'>('positions')
  const [tradeHistory, setHistory]= useState<TradeRecord[]>([])
  const [openPositions, setOpenPos] = useState<OpenPosition[]>([])
  const [histLoading, setHistLoad]= useState(false)
  const [closingId, setClosingId] = useState<number | null>(null)

  const exchanges: ExchangeConn[] =
    (user as unknown as { exchange_connections?: ExchangeConn[] })?.exchange_connections ?? []

  useEffect(() => {
    if (exchanges.length > 0 && selExchange === '__balance__') {
      setSelExch(exchanges[0].label)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges.length])

  const fetchHistory = useCallback(async () => {
    setHistLoad(true)
    try {
      const [tradesRes, posRes] = await Promise.allSettled([
        getBotTrades(50),
        getOpenPositions(),
      ])
      if (tradesRes.status === 'fulfilled') {
        setHistory(tradesRes.value.data?.trades ?? [])
      }
      if (posRes.status === 'fulfilled') {
        setOpenPos(posRes.value.data?.positions ?? [])
      }
    } catch { /* silent */ } finally { setHistLoad(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const getPriceData = (p: string) => {
    const item = tickerItems.find(i => i.symbol === p)
    if (item?.live) {
      const pr = parseFloat(item.price.replace(/[$,]/g, ''))
      const ch = parseFloat(item.change.replace(/[%+]/g, ''))
      return { price: pr, change: ch, live: true }
    }
    return { ...(FALLBACKS[p] ?? { price: 100, change: 0 }), live: false }
  }

  const { price: livePrice, change: liveChange, live: isLive } = getPriceData(pair)
  const lineData   = generateLineData(livePrice)
  const candleData = generateCandleData(livePrice)
  const orderBook  = makeOrderBook(livePrice)

  const prevPair     = useRef(pair)
  const priceInitRef = useRef(false)

  useEffect(() => {
    const pairChanged = prevPair.current !== pair
    if ((pairChanged || !priceInitRef.current) && livePrice > 0) {
      setPrice(livePrice.toFixed(2))
      prevPair.current     = pair
      priceInitRef.current = true
    }
  }, [pair, livePrice])

  const userBalance = user?.balance_usdt ?? 0
  const asset       = pair.split('/')[0]
  const availCrypto = livePrice > 0 ? userBalance / livePrice : 0
  const numPrice    = parseFloat(price.replace(/,/g, '')) || 0
  const qty         = parseFloat(amount) || 0
  const total       = numPrice && qty ? (numPrice * qty).toFixed(2) : '0.00'
  const high24      = livePrice > 0 ? (livePrice * 1.022).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'
  const low24       = livePrice > 0 ? (livePrice * 0.978).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'

  const usingBalance  = selExchange === '__balance__'
  const selectedConn  = exchanges.find(e => e.label === selExchange)

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qty || qty <= 0)           return toast.error('Enter a valid amount')
    if (!numPrice || numPrice <= 0) return toast.error('Price must be greater than 0')
    if (usingBalance && side === 'buy' && numPrice * qty > userBalance)
      return toast.error(`Insufficient balance. You have $${userBalance.toFixed(2)} USDT`)

    setLoading(true)
    try {
      const res = await executeTrade({
        pair,
        side,
        order_type: orderType,
        price: numPrice,
        amount: qty,
        paper: false,
        exchange_label: usingBalance ? undefined : selExchange,
      })
      const d = res.data
      const exLabel = usingBalance ? 'Platform Balance' : selectedConn?.exchange?.toUpperCase() ?? selExchange

      if (side === 'buy') {
        toast.success(
          `▲ Buy ${qty} ${asset} @ $${numPrice.toLocaleString()} via ${exLabel} — Filled\n` +
          `Cost: $${(numPrice * qty).toFixed(2)} USDT deducted`,
          { duration: 4000 }
        )
      } else {
        toast.success(
          `▼ Sell ${qty} ${asset} @ $${numPrice.toLocaleString()} via ${exLabel} — Filled\n` +
          `Proceeds: $${(numPrice * qty).toFixed(2)} USDT credited`,
          { duration: 4000 }
        )
      }

      if (d?.exchange_error) {
        toast.error(`Exchange error: ${d.exchange_error}`, { duration: 7000 })
      }
      if (d?.trade?.new_balance !== undefined) {
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          balance_usdt: d.trade.new_balance,
        })
      }
      setAmount('')
      setStopLoss('')
      setTakeProfit('')
      fetchHistory()
      setBottomTab('positions')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Order failed')
    } finally { setLoading(false) }
  }

  const handleClosePosition = async (tradeId: number) => {
    setClosingId(tradeId)
    try {
      const res = await closeManualTrade(tradeId)
      const d = res.data
      const pnl = d.pnl ?? 0
      toast.success(
        `Position closed @ $${d.close_price?.toLocaleString('en-US', { maximumFractionDigits: 2 })} — P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        { duration: 5000 }
      )
      if (d.new_balance !== undefined) {
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          balance_usdt: d.new_balance,
        })
      }
      fetchHistory()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to close position')
    } finally { setClosingId(null) }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button onClick={() => setShowP(v => !v)}
            className="flex items-center gap-2 bg-[#161a1e] border border-[#2b3139] hover:border-[#f0b90b]/40 rounded-xl px-3.5 py-2 transition">
            <span className="text-sm font-bold text-[#eaecef]">{pair}</span>
            <ChevronDown size={12} className="text-[#848e9c]" />
          </button>
          {showPairs && (
            <div className="absolute top-full mt-1 left-0 bg-[#1e2329] border border-[#2b3139] rounded-xl overflow-hidden z-20 min-w-[150px] shadow-xl shadow-black/40">
              {PAIRS.map(p => (
                <button key={p} onClick={() => { setPair(p); setShowP(false); setAmount('') }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-[#2b3139] ${p === pair ? 'text-[#f0b90b] font-semibold' : 'text-[#eaecef]'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#eaecef]">
            ${livePrice > 0 ? livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
          </span>
          <span className={`text-xs font-semibold flex items-center gap-0.5 px-2 py-1 rounded-lg ${liveChange >= 0 ? 'text-[#0ecb81] bg-[#0ecb81]/10' : 'text-[#f6465d] bg-[#f6465d]/10'}`}>
            {liveChange >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}%
          </span>
          <span className={`text-[10px] flex items-center gap-0.5 ${isLive ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
            {isLive ? <Wifi size={9} /> : <WifiOff size={9} />}
            {isLive ? 'live' : 'cached'}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap gap-3 text-xs text-[#848e9c]">
          <div><span className="block text-[10px]">24h High</span><span className="text-[#eaecef] font-mono font-medium">${high24}</span></div>
          <div><span className="block text-[10px]">24h Low</span><span className="text-[#eaecef] font-mono font-medium">${low24}</span></div>
          <div className="hidden sm:block">
            <span className="block text-[10px]">Balance</span>
            <span className="text-[#f0b90b] font-mono font-medium">${userBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT</span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="lg:col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex gap-1">
              {TF.map(t => (
                <button key={t} onClick={() => setTf(t)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${t === tf ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1 bg-[#0b0e11] p-0.5 rounded-lg border border-[#2b3139]">
              <button onClick={() => setChartMode('line')}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition ${chartMode === 'line' ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                <Activity size={11} /> Line
              </button>
              <button onClick={() => setChartMode('candle')}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition ${chartMode === 'candle' ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                <BarChart2 size={11} /> Candle
              </button>
            </div>
          </div>

          {chartMode === 'line' ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={lineData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0ecb81" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0ecb81" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
                <XAxis dataKey="time" tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} interval={7} />
                <YAxis tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false}
                  tickFormatter={v => livePrice >= 10000 ? `$${((v as number)/1000).toFixed(1)}k` : `$${(v as number).toFixed(1)}`}
                  domain={['auto','auto']} width={48} />
                <Tooltip contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 10, fontSize: 11 }}
                  labelStyle={{ color: '#848e9c' }} itemStyle={{ color: '#0ecb81' }}
                  formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'Price']} />
                <Area type="monotone" dataKey="price" stroke="#0ecb81" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={candleData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
                <XAxis dataKey="time" tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} interval={5} />
                <YAxis tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false}
                  tickFormatter={v => livePrice >= 10000 ? `$${((v as number)/1000).toFixed(1)}k` : `$${(v as number).toFixed(1)}`}
                  domain={['auto','auto']} width={48} />
                <Tooltip contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 10, fontSize: 11 }}
                  labelStyle={{ color: '#848e9c' }}
                  formatter={(v: unknown, name: unknown) => {
                    const labels: Record<string,string> = { bodyStart: 'Open/Close from', body: 'Body size' }
                    return [`$${(v as number).toFixed(2)}`, labels[name as string] || String(name)]
                  }} />
                <Bar dataKey="bodyStart" stackId="candle" fill="transparent" stroke="none" />
                <Bar dataKey="body" stackId="candle" radius={[1,1,1,1]}>
                  {candleData.map((_, i) => <Cell key={i} fill={candleData[i].color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartMode === 'candle' && (
            <div className="flex items-center gap-4 mt-2 text-[10px] text-[#848e9c]">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#0ecb81] inline-block" /> Bullish</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#f6465d] inline-block" /> Bearish</span>
            </div>
          )}
        </div>

        {/* Right column — order form */}
        <div className="space-y-4">
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 space-y-3">

            {/* Route */}
            <div>
              <label className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-1.5 block">Route via</label>
              <select value={selExchange} onChange={e => setSelExch(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-xs text-[#eaecef] focus:outline-none transition">
                <option value="__balance__">Platform Balance (internal)</option>
                {exchanges.map(ex => (
                  <option key={ex.label} value={ex.label}>{ex.exchange.toUpperCase()} — {ex.label}</option>
                ))}
              </select>
              <p className="text-[9px] text-[#848e9c] mt-1 flex items-center gap-1">
                {usingBalance
                  ? <>Platform wallet · BUY deducts USDT · SELL credits USDT</>
                  : <><Link2 size={9} /> Live order on {selectedConn?.exchange?.toUpperCase()} via API</>}
              </p>
            </div>

            {/* Buy / Sell */}
            <div className="grid grid-cols-2 gap-1 bg-[#0b0e11] p-1 rounded-xl">
              <button onClick={() => setSide('buy')}
                className={`py-2.5 rounded-lg text-sm font-bold transition ${side === 'buy' ? 'bg-[#0ecb81] text-black shadow-lg shadow-[#0ecb81]/20' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                Buy
              </button>
              <button onClick={() => setSide('sell')}
                className={`py-2.5 rounded-lg text-sm font-bold transition ${side === 'sell' ? 'bg-[#f6465d] text-white shadow-lg shadow-[#f6465d]/20' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                Sell
              </button>
            </div>

            {/* Order type */}
            <div className="flex gap-1">
              {(['limit', 'market'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`text-xs px-3 py-1.5 rounded-lg capitalize font-medium transition ${orderType === t ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleTrade} className="space-y-3">
              {orderType === 'limit' && (
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-[#848e9c]">Price (USDT)</label>
                    <span className="text-[10px] text-[#0ecb81]">{isLive ? '● live' : '○ cached'}</span>
                  </div>
                  <input value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition" />
                </div>
              )}

              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs text-[#848e9c]">Amount ({asset})</label>
                  <span className="text-[10px] text-[#848e9c]">
                    Avail: {side === 'buy'
                      ? `$${userBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT`
                      : `${availCrypto.toFixed(6)} ${asset}`}
                  </span>
                </div>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition" />
              </div>

              {/* % quick-fill */}
              <div className="grid grid-cols-4 gap-1">
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct} type="button"
                    onClick={() => {
                      if (side === 'buy') {
                        const buyUSDT = userBalance * pct / 100
                        setAmount(numPrice > 0 ? (buyUSDT / numPrice).toFixed(6) : '0')
                      } else {
                        setAmount((availCrypto * pct / 100).toFixed(6))
                      }
                    }}
                    className="text-xs py-1.5 rounded-lg bg-[#0b0e11] hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition font-medium border border-[#2b3139]">
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Stop Loss / Take Profit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#848e9c] mb-1 flex items-center gap-1">
                    <AlertTriangle size={8} className="text-[#f6465d]" /> Stop Loss
                  </label>
                  <input value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="Optional"
                    className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f6465d]/60 rounded-xl px-3 py-2 text-xs font-mono text-[#eaecef] focus:outline-none transition" />
                </div>
                <div>
                  <label className="text-[10px] text-[#848e9c] mb-1 flex items-center gap-1">
                    <Target size={8} className="text-[#0ecb81]" /> Take Profit
                  </label>
                  <input value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="Optional"
                    className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#0ecb81]/60 rounded-xl px-3 py-2 text-xs font-mono text-[#eaecef] focus:outline-none transition" />
                </div>
              </div>
              {(stopLoss || takeProfit) && (
                <div className="text-[10px] text-[#848e9c] bg-[#0b0e11] rounded-lg px-2.5 py-2 space-y-0.5 border border-[#2b3139]">
                  {stopLoss && <p className="text-[#f6465d]">SL @ ${parseFloat(stopLoss).toLocaleString()} — auto-close if price falls here</p>}
                  {takeProfit && <p className="text-[#0ecb81]">TP @ ${parseFloat(takeProfit).toLocaleString()} — auto-close if price rises here</p>}
                  <p className="text-[#4a5568]">Monitor your position and close manually when these levels are hit.</p>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between text-xs py-2 border-t border-[#2b3139]">
                <span className="text-[#848e9c]">{side === 'buy' ? 'Cost' : 'Proceeds'}</span>
                <span className={`font-mono font-semibold ${side === 'buy' ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
                  {side === 'buy' ? '-' : '+'}${total} USDT
                </span>
              </div>

              {/* Submit */}
              <button type="submit" disabled={orderLoading}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 ${
                  side === 'buy'
                    ? 'bg-[#0ecb81] hover:bg-[#0ab56f] text-black shadow-lg shadow-[#0ecb81]/20'
                    : 'bg-[#f6465d] hover:bg-[#d93d51] text-white shadow-lg shadow-[#f6465d]/20'
                }`}>
                {orderLoading ? 'Placing order...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${asset}`}
              </button>
            </form>
          </div>

          {/* Order book */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#848e9c] mb-3 flex items-center gap-1.5">
              <ArrowUpDown size={11} /> Order Book
            </p>
            <div className="flex justify-between text-[10px] text-[#4a5568] mb-2 px-0.5">
              <span>Price (USDT)</span><span>Size ({asset})</span>
            </div>
            <div className="space-y-1">
              {orderBook.asks.slice(0,5).reverse().map((a, i) => (
                <div key={i} className="relative flex justify-between text-[11px] px-0.5 py-0.5">
                  <div className="absolute inset-0 right-0 bg-[#f6465d]/8 rounded" style={{ width: `${Math.min(a.size/2*100,100)}%`, marginLeft: 'auto' }} />
                  <span className="text-[#f6465d] font-mono relative">${a.price.toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                  <span className="text-[#848e9c] font-mono relative">{a.size.toFixed(4)}</span>
                </div>
              ))}
              <div className="py-2 text-center text-sm font-bold font-mono text-[#eaecef] bg-[#0b0e11] rounded-lg my-1">
                ${livePrice > 0 ? livePrice.toLocaleString('en-US',{maximumFractionDigits:2}) : '—'}
              </div>
              {orderBook.bids.slice(0,5).map((b, i) => (
                <div key={i} className="relative flex justify-between text-[11px] px-0.5 py-0.5">
                  <div className="absolute inset-0 bg-[#0ecb81]/8 rounded" style={{ width: `${Math.min(b.size/2*100,100)}%` }} />
                  <span className="text-[#0ecb81] font-mono relative">${b.price.toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                  <span className="text-[#848e9c] font-mono relative">{b.size.toFixed(4)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#848e9c] mt-3 pt-2 border-t border-[#2b3139]">
              <span className="text-[#f6465d]">Asks: {orderBook.asks.reduce((s,a)=>s+a.size,0).toFixed(3)}</span>
              <span className="text-[#0ecb81]">Bids: {orderBook.bids.reduce((s,b)=>s+b.size,0).toFixed(3)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom panel — Open Positions + History */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 px-5 py-3 border-b border-[#2b3139]">
          <button onClick={() => setBottomTab('positions')}
            className={`text-xs font-semibold pb-1 border-b-2 transition mr-3 ${bottomTab === 'positions' ? 'text-[#eaecef] border-[#f0b90b]' : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'}`}>
            Open Positions {openPositions.length > 0 && <span className="ml-1 bg-[#f0b90b]/20 text-[#f0b90b] text-[10px] px-1.5 py-0.5 rounded-full">{openPositions.length}</span>}
          </button>
          <button onClick={() => setBottomTab('history')}
            className={`text-xs font-semibold pb-1 border-b-2 transition ${bottomTab === 'history' ? 'text-[#eaecef] border-[#f0b90b]' : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'}`}>
            Order History
          </button>
          <button onClick={fetchHistory} className="ml-auto text-[#848e9c] hover:text-[#eaecef] transition p-1" title="Refresh">
            <RefreshCw size={12} className={histLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Open positions */}
        {bottomTab === 'positions' && (
          openPositions.length === 0 ? (
            <div className="py-10 text-center">
              <Target size={22} className="text-[#2b3139] mx-auto mb-2" />
              <p className="text-xs text-[#848e9c]">No open positions — place a Buy order to open one</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-7 gap-2 px-5 py-2 text-[10px] text-[#4a5568] uppercase tracking-widest border-b border-[#2b3139]/50">
                <span>Pair</span>
                <span className="text-right">Entry</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Current</span>
                <span className="text-right col-span-2">Unrealized P&L</span>
                <span className="text-right">Action</span>
              </div>
              <div className="divide-y divide-[#2b3139]/50 max-h-72 overflow-y-auto">
                {openPositions.map(pos => {
                  const pairFmt    = pos.ticker.replace('-', '/')
                  const pnlColor   = pos.unrealized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                  const pnlBg      = pos.unrealized_pnl >= 0 ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : 'bg-[#f6465d]/5 border-[#f6465d]/20'
                  const timeStr    = pos.created_at ? new Date(pos.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                  return (
                    <div key={pos.id}>
                      {/* Desktop */}
                      <div className={`hidden sm:grid grid-cols-7 gap-2 px-5 py-2.5 text-xs items-center border-l-2 ${pnlBg} border-b border-[#2b3139]/50`}
                        style={{ borderLeftColor: pos.unrealized_pnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                        <span className="font-mono font-semibold text-[#eaecef]">{pairFmt}</span>
                        <span className="font-mono text-right text-[#848e9c]">${(pos.price ?? 0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        <span className="font-mono text-right text-[#eaecef]">{(pos.qty ?? 0).toFixed(6)}</span>
                        <span className="font-mono text-right text-[#eaecef]">${(pos.current_price ?? 0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        <span className={`font-mono font-semibold text-right col-span-2 ${pnlColor}`}>
                          {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                        </span>
                        <div className="flex justify-end">
                          <button onClick={() => handleClosePosition(pos.id)} disabled={closingId === pos.id}
                            className="text-[10px] px-2.5 py-1.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg font-semibold transition disabled:opacity-60 flex items-center gap-1">
                            {closingId === pos.id ? <><RefreshCw size={9} className="animate-spin" /> Closing…</> : <><X size={9} /> Close</>}
                          </button>
                        </div>
                      </div>
                      {/* Mobile */}
                      <div className={`sm:hidden px-4 py-3 border-l-2 ${pnlBg}`}
                        style={{ borderLeftColor: pos.unrealized_pnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-bold font-mono text-[#eaecef]">{pairFmt}</span>
                            <p className="text-[10px] text-[#848e9c]">{timeStr}</p>
                          </div>
                          <span className={`text-sm font-bold font-mono ${pnlColor}`}>
                            {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-[#848e9c] space-y-0.5">
                            <p>Entry: <span className="text-[#eaecef] font-mono">${(pos.price ?? 0).toLocaleString('en-US',{maximumFractionDigits:2})}</span></p>
                            <p>Now: <span className="text-[#eaecef] font-mono">${(pos.current_price ?? 0).toLocaleString('en-US',{maximumFractionDigits:2})}</span></p>
                          </div>
                          <button onClick={() => handleClosePosition(pos.id)} disabled={closingId === pos.id}
                            className="text-xs px-3 py-2 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg font-semibold transition disabled:opacity-60">
                            {closingId === pos.id ? 'Closing…' : 'Close Position'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}

        {/* Order history */}
        {bottomTab === 'history' && (
          tradeHistory.length === 0 ? (
            <div className="py-12 text-center">
              <Clock size={22} className="text-[#2b3139] mx-auto mb-2" />
              <p className="text-xs text-[#848e9c]">No trades yet — place your first order above</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-7 gap-2 px-5 py-2 text-[10px] text-[#4a5568] uppercase tracking-widest border-b border-[#2b3139]/50">
                <span>Pair</span><span>Side</span>
                <span className="text-right">Price</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Total</span>
                <span>Route</span>
                <span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-[#2b3139]/50 max-h-72 overflow-y-auto">
                {tradeHistory.map(t => {
                  const isBuy   = t.action?.toUpperCase() === 'BUY'
                  const total_v = (t.price ?? 0) * (t.qty ?? 0)
                  const pairFmt = t.ticker?.replace('-', '/') ?? '—'
                  const timeStr = t.created_at ? new Date(t.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                  const exchLbl = t.exchange === 'internal' || t.exchange === 'manual' ? 'Balance' : (t.exchange ?? '—').toUpperCase()
                  return (
                    <div key={t.id}>
                      <div className="hidden sm:grid grid-cols-7 gap-2 px-5 py-2.5 text-xs hover:bg-[#1e2329] transition items-center">
                        <span className="font-mono font-semibold text-[#eaecef]">{pairFmt}</span>
                        <span className={`font-bold flex items-center gap-1 ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {isBuy ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {isBuy ? 'Buy' : 'Sell'}
                        </span>
                        <span className="font-mono text-[#eaecef] text-right">${(t.price ?? 0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        <span className="font-mono text-[#eaecef] text-right">{(t.qty ?? 0).toFixed(6)}</span>
                        <span className={`font-mono text-right font-semibold ${isBuy ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
                          {isBuy ? '-' : '+'}${total_v.toLocaleString('en-US',{maximumFractionDigits:2})}
                        </span>
                        <span className="text-[#848e9c] flex items-center gap-1"><CheckCircle2 size={9} className="text-[#0ecb81]" />{exchLbl}</span>
                        <span className="text-[#848e9c] text-right text-[10px]">{timeStr}</span>
                      </div>
                      <div className="sm:hidden px-4 py-3 flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isBuy ? 'bg-[#0ecb81]/10' : 'bg-[#f6465d]/10'}`}>
                          {isBuy ? <TrendingUp size={12} className="text-[#0ecb81]" /> : <TrendingDown size={12} className="text-[#f6465d]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#eaecef] font-mono">{pairFmt}</span>
                            <span className={`text-[10px] font-bold ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{isBuy ? 'Buy' : 'Sell'}</span>
                          </div>
                          <span className="text-[10px] text-[#848e9c]">{(t.qty ?? 0).toFixed(6)} @ ${(t.price ?? 0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-mono font-semibold ${isBuy ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>{isBuy ? '-' : '+'}${total_v.toLocaleString('en-US',{maximumFractionDigits:2})}</p>
                          <p className="text-[9px] text-[#848e9c]">{timeStr}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
