import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getBotStatus, startBot, stopBot, closeBotPosition,
  getBotTrades, updateBotParams, getBotPnlHistory, listApiKeys,
} from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Bot, Play, Square, RefreshCw, TrendingUp, Activity, Zap, Brain,
  Settings, Save, ChevronDown, BarChart2, Lock, KeyRound, ArrowRight,
  TrendingDown, DollarSign, Cpu, Plus, X, Target, ArrowUpDown,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from 'recharts'
import { useNavigate } from 'react-router-dom'

interface TradeLog {
  id: number; ticker: string; action: string; price: number; qty: number
  pnl: number | null; reason: string | null; exchange: string; created_at: string
}

interface BotDetail {
  running: boolean
  bot_id: string
  bot_name: string
  ticker: string
  strategy: string
  direction: string
  take_profit_pct: number
  mode: string
  balance: number
  portfolio_value: number
  unrealized_pnl: number
  realized_pnl: number
  win_rate: number
  position: number
  entry_price: number
  current_price: number
  signal: string
  current_drawdown_pct: number
  total_trades: number
  price_chart: { time: string; price: number }[]
  entry_markers: { time: string; price: number }[]
  exit_markers: { time: string; price: number; pnl: number }[]
  recent_trades: { time: string; action: string; price: number; qty: number; pnl: number | null; reason: string }[]
}

interface BotStatus {
  running: boolean
  bots?: Record<string, BotDetail>
  capital?: number
}

interface PnlPoint { date: string; pnl: number; cumulative: number }

const TICKERS = [
  'BTC-USD','ETH-USD','SOL-USD','XRP-USD','BNB-USD','ADA-USD',
  'AVAX-USD','DOGE-USD','NVDA','AAPL','TSLA','MSFT','GOOGL','AMZN','META',
]

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const EMPTY_PARAMS = {
  ticker: 'BTC-USD',
  route: '__balance__',
  initial_capital: 1000,
  risk_per_trade_pct: 2,
  max_drawdown_pct: 10,
  strategy: 'sma' as 'sma' | 'finlux',
  take_profit_pct: 4,
  direction: 'auto' as 'auto' | 'buy' | 'sell',
  bot_name: '',
}

// Mini live-price chart for a single bot
function BotPriceChart({ bot }: { bot: BotDetail }) {
  if (!bot.price_chart || bot.price_chart.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 text-[#4a5568] text-xs">
        Warming up… ({bot.price_chart?.length ?? 0} ticks)
      </div>
    )
  }
  const entrySet = new Set(bot.entry_markers.map(m => m.time))
  const exitSet  = new Set(bot.exit_markers.map(m => m.time))
  const data = bot.price_chart.map(p => ({
    ...p,
    entry: entrySet.has(p.time) ? p.price : undefined,
    exit:  exitSet.has(p.time)  ? p.price : undefined,
  }))
  const prices   = bot.price_chart.map(p => p.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const domain: [number, number] = [minPrice * 0.9995, maxPrice * 1.0005]
  const isUp = prices[prices.length - 1] >= prices[0]

  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#2b3139" vertical={false} />
        <XAxis dataKey="time" hide />
        <YAxis domain={domain} hide />
        <Tooltip
          contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 8, fontSize: 10 }}
          labelStyle={{ color: '#848e9c' }}
          formatter={(v: unknown) => [`$${(v as number).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, 'Price']}
        />
        {bot.entry_price > 0 && (
          <ReferenceLine y={bot.entry_price} stroke="#f0b90b" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <Line
          type="monotone" dataKey="price"
          stroke={isUp ? '#0ecb81' : '#f6465d'} strokeWidth={1.5} dot={false}
          activeDot={{ r: 3, fill: isUp ? '#0ecb81' : '#f6465d' }}
        />
        {/* Entry dots */}
        <Line type="monotone" dataKey="entry" stroke="#0ecb81" dot={{ r: 4, fill: '#0ecb81', stroke: '#0b0e11', strokeWidth: 1 }} strokeWidth={0} activeDot={false} connectNulls={false} />
        {/* Exit dots */}
        <Line type="monotone" dataKey="exit" stroke="#f6465d" dot={{ r: 4, fill: '#f6465d', stroke: '#0b0e11', strokeWidth: 1 }} strokeWidth={0} activeDot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function BotsPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const exchanges = (user as unknown as { exchange_connections?: { exchange: string; label: string; api_key_masked?: string }[] })?.exchange_connections ?? []

  const [status,       setStatus]       = useState<BotStatus>({ running: false })
  const [trades,       setTrades]       = useState<TradeLog[]>([])
  const [pnlHistory,   setPnlHistory]   = useState<PnlPoint[]>([])
  const [loading,      setLoading]      = useState(true)
  const [actionLoading,setActionLoading]= useState<string | null>(null)
  const [showAddBot,   setShowAddBot]   = useState(false)
  const [savingParams, setSavingParams] = useState(false)
  const [showTickerDD, setShowTickerDD] = useState(false)
  const [showRouteDD,  setShowRouteDD]  = useState(false)
  const [hasApiKey,    setHasApiKey]    = useState<boolean | null>(null)
  const [prevPrices,   setPrevPrices]   = useState<Record<string, number>>({})
  const [priceFlash,   setPriceFlash]   = useState<Record<string, 'up' | 'down'>>({})
  const flashTimers                     = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [params, setParams] = useState({ ...EMPTY_PARAMS })

  useEffect(() => {
    listApiKeys()
      .then(res => {
        const keys = Array.isArray(res.data) ? res.data : []
        setHasApiKey(keys.some((k: { is_active: boolean }) => k.is_active))
      })
      .catch(() => setHasApiKey(false))
  }, [])

  useEffect(() => {
    if (user) {
      const u = user as unknown as { default_capital?: number; risk_per_trade?: number; max_drawdown?: number }
      setParams(p => ({
        ...p,
        initial_capital:    u.default_capital || p.initial_capital,
        risk_per_trade_pct: u.risk_per_trade  || p.risk_per_trade_pct,
        max_drawdown_pct:   u.max_drawdown    || p.max_drawdown_pct,
      }))
    }
  }, [user])

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, tradesRes, pnlRes] = await Promise.allSettled([
        getBotStatus(), getBotTrades(50), getBotPnlHistory(30),
      ])
      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value.data
        setStatus(prev => {
          const newBots = d.bots as Record<string, BotDetail> ?? {}
          // Detect price flashes
          const newPrices: Record<string, number> = {}
          Object.entries(newBots).forEach(([bid, bot]) => {
            const newP = bot.current_price ?? 0
            newPrices[bid] = newP
            const oldP = prevPrices[bid]
            if (oldP && newP !== oldP) {
              const dir = newP > oldP ? 'up' : 'down'
              setPriceFlash(f => ({ ...f, [bid]: dir }))
              if (flashTimers.current[bid]) clearTimeout(flashTimers.current[bid])
              flashTimers.current[bid] = setTimeout(
                () => setPriceFlash(f => { const n = { ...f }; delete n[bid]; return n }), 600
              )
            }
          })
          setPrevPrices(newPrices)
          return { running: d.running, bots: newBots, capital: d.capital }
        })
      }
      if (tradesRes.status === 'fulfilled') {
        const d = tradesRes.value.data
        setTrades(Array.isArray(d) ? d : (d?.trades ?? []))
      }
      if (pnlRes.status === 'fulfilled') {
        setPnlHistory(pnlRes.value.data?.history ?? [])
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [prevPrices])

  useEffect(() => {
    fetchData()
    const interval = status.running ? 5000 : 15000
    const id = setInterval(fetchData, interval)
    return () => clearInterval(id)
  }, [fetchData, status.running])

  const handleStart = async () => {
    const usingBalance = params.route === '__balance__'
    const balance      = (user as unknown as { balance_usdt?: number })?.balance_usdt ?? 0
    if (usingBalance && balance < params.initial_capital) {
      toast.error(`Insufficient balance. Need $${params.initial_capital.toLocaleString()} USDT.`)
      return
    }
    setActionLoading('start')
    try {
      const res = await startBot({
        ticker:             params.ticker,
        paper:              false,
        initial_capital:    params.initial_capital,
        risk_per_trade_pct: params.risk_per_trade_pct,
        max_drawdown_pct:   params.max_drawdown_pct,
        exchange_label:     usingBalance ? undefined : params.route,
        strategy:           params.strategy,
        take_profit_pct:    params.take_profit_pct,
        direction:          params.direction,
        bot_name:           params.bot_name || undefined,
      })
      setStatus(s => ({ ...s, running: true }))
      toast.success(res.data?.message || 'Bot started successfully')
      setShowAddBot(false)
      setParams({ ...EMPTY_PARAMS })
      fetchData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to start bot')
    } finally { setActionLoading(null) }
  }

  const handleStop = async (botId = 'ALL') => {
    setActionLoading(botId)
    try {
      await stopBot(botId)
      if (botId === 'ALL') setStatus(s => ({ ...s, running: false }))
      toast.success(botId === 'ALL' ? 'All bots stopped' : `Bot "${botId}" stopped`)
      fetchData()
    } catch { toast.error('Failed to stop bot') } finally { setActionLoading(null) }
  }

  const handleClosePosition = async (botId: string) => {
    setActionLoading(`close_${botId}`)
    try {
      const res = await closeBotPosition(botId)
      toast.success(res.data?.message || 'Position closed')
      fetchData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to close position')
    } finally { setActionLoading(null) }
  }

  const handleSaveDefaults = async () => {
    setSavingParams(true)
    try {
      await updateBotParams({
        default_capital:  params.initial_capital,
        risk_per_trade:   params.risk_per_trade_pct,
        max_drawdown:     params.max_drawdown_pct,
        preferred_tickers:[params.ticker],
      })
      toast.success('Default parameters saved')
    } catch { toast.error('Failed to save parameters') } finally { setSavingParams(false) }
  }

  const activeBots    = Object.values(status.bots ?? {}) as BotDetail[]
  const pnlTrades     = trades.filter(t => t.pnl !== null)
  const totalPnl      = pnlTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const winningTrades = pnlTrades.filter(t => (t.pnl ?? 0) > 0).length
  const winRate       = pnlTrades.length > 0 ? ((winningTrades / pnlTrades.length) * 100).toFixed(1) : '—'
  const totalUnrealized = activeBots.reduce((s, b) => s + (b.unrealized_pnl ?? 0), 0)
  const totalPortfolio  = activeBots.reduce((s, b) => s + (b.portfolio_value ?? 0), 0)

  const routeLabel = params.route === '__balance__'
    ? 'Platform Balance'
    : (exchanges.find(e => e.label === params.route)?.label ?? params.route)

  if (hasApiKey === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (hasApiKey === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-[#f0b90b]/10 border-2 border-[#f0b90b]/30 flex items-center justify-center">
          <Lock size={36} className="text-[#f0b90b]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#eaecef] mb-2">FinAi API Key Required</h2>
          <p className="text-sm text-[#848e9c] max-w-md">To access the AI Trading Bot, you need a FinAi API key.</p>
        </div>
        <div className="bg-[#161a1e] border border-[#f0b90b]/20 rounded-2xl p-6 max-w-sm w-full space-y-3 text-left">
          <p className="text-xs font-semibold text-[#f0b90b] uppercase tracking-widest">How to get access</p>
          <ol className="space-y-2 text-sm text-[#848e9c]">
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">1.</span> Go to your Profile page</li>
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">2.</span> Open the <span className="text-[#eaecef] font-medium">FinAPI</span> tab</li>
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">3.</span> Create a new API key</li>
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">4.</span> Return here to start trading</li>
          </ol>
        </div>
        <button onClick={() => navigate('/app/profile')}
          className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d9a60b] text-black font-bold px-6 py-3 rounded-xl transition">
          <KeyRound size={16} /> Go to Profile — Create Key <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#eaecef]">AI Trading Bots</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.running ? 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 animate-pulse' : 'bg-[#2b3139] text-[#848e9c]'}`}>
            {status.running ? `● ${activeBots.length} Live` : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status.running && (
            <button onClick={() => handleStop('ALL')} disabled={!!actionLoading}
              className="flex items-center gap-1.5 text-xs bg-[#f6465d]/10 hover:bg-[#f6465d]/20 border border-[#f6465d]/30 text-[#f6465d] px-3 py-1.5 rounded-lg transition">
              <Square size={11} /> Stop All
            </button>
          )}
          <button onClick={() => setShowAddBot(v => !v)}
            className="flex items-center gap-1.5 text-xs bg-[#f0b90b] hover:bg-[#d9a60b] text-black font-semibold px-3 py-1.5 rounded-lg transition">
            <Plus size={12} /> Add Bot
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Add Bot Panel ── */}
      {showAddBot && (
        <div className="bg-[#161a1e] border border-[#f0b90b]/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2">
              <Bot size={14} className="text-[#f0b90b]" /> Configure New Bot
            </h3>
            <button onClick={() => setShowAddBot(false)} className="text-[#848e9c] hover:text-[#eaecef]">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Bot name */}
            <div className="lg:col-span-1">
              <label className="text-xs text-[#848e9c] mb-1.5 block">Bot Name (optional)</label>
              <input value={params.bot_name} onChange={e => setParams(p => ({ ...p, bot_name: e.target.value }))}
                placeholder={`e.g. BTC-Scalper`}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none transition" />
            </div>

            {/* Ticker */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Asset / Ticker</label>
              <div className="relative">
                <button onClick={() => { setShowTickerDD(v => !v); setShowRouteDD(false) }}
                  className="w-full flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] transition">
                  <span className="font-mono font-medium">{params.ticker}</span>
                  <ChevronDown size={12} className="text-[#848e9c]" />
                </button>
                {showTickerDD && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-[#1e2329] border border-[#2b3139] rounded-xl z-20 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {TICKERS.map(t => (
                      <button key={t} onClick={() => { setParams(p => ({ ...p, ticker: t })); setShowTickerDD(false) }}
                        className={`w-full text-left px-4 py-2 text-sm transition hover:bg-[#2b3139] font-mono ${t === params.ticker ? 'text-[#f0b90b] font-semibold' : 'text-[#eaecef]'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Strategy */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Strategy</label>
              <div className="grid grid-cols-2 gap-1 bg-[#0b0e11] p-1 rounded-xl border border-[#2b3139]">
                {(['sma', 'finlux'] as const).map(s => (
                  <button key={s} onClick={() => setParams(p => ({ ...p, strategy: s }))}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${params.strategy === s ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                    {s === 'sma' ? 'SMA' : 'FinLux'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#4a5568] mt-1">
                {params.strategy === 'sma'
                  ? 'SMA-6 momentum crossover'
                  : 'LuxAlgo Trendlines with Breaks'}
              </p>
            </div>

            {/* Direction */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Bot Direction</label>
              <div className="flex gap-1 bg-[#0b0e11] p-1 rounded-xl border border-[#2b3139]">
                {([['auto', 'Auto', ArrowUpDown], ['buy', 'Buy Only', TrendingUp], ['sell', 'Sell Only', TrendingDown]] as const).map(([val, lbl, Icon]) => (
                  <button key={val} onClick={() => setParams(p => ({ ...p, direction: val }))}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition ${params.direction === val ? val === 'buy' ? 'bg-[#0ecb81] text-black' : val === 'sell' ? 'bg-[#f6465d] text-white' : 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                    <Icon size={10} />{lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Route */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Trade Route</label>
              <div className="relative">
                <button onClick={() => { setShowRouteDD(v => !v); setShowTickerDD(false) }}
                  className="w-full flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] transition">
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${params.route === '__balance__' ? 'bg-[#0ecb81]' : 'bg-[#f0b90b]'}`} />
                    {params.route === '__balance__' ? 'Platform Balance' : routeLabel}
                  </span>
                  <ChevronDown size={12} className="text-[#848e9c]" />
                </button>
                {showRouteDD && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-[#1e2329] border border-[#2b3139] rounded-xl z-20 shadow-xl overflow-hidden">
                    <button onClick={() => { setParams(p => ({ ...p, route: '__balance__' })); setShowRouteDD(false) }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-[#2b3139] flex items-center gap-3 ${params.route === '__balance__' ? 'text-[#0ecb81] font-semibold' : 'text-[#eaecef]'}`}>
                      <span className="w-2 h-2 rounded-full bg-[#0ecb81]" />
                      <div><p className="font-medium">Platform Balance</p><p className="text-[10px] text-[#848e9c] mt-0.5">Internal USDT wallet</p></div>
                    </button>
                    {exchanges.map(ex => (
                      <button key={ex.label} onClick={() => { setParams(p => ({ ...p, route: ex.label })); setShowRouteDD(false) }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-[#2b3139] flex items-center gap-3 border-t border-[#2b3139] ${params.route === ex.label ? 'text-[#f0b90b] font-semibold' : 'text-[#eaecef]'}`}>
                        <span className="w-2 h-2 rounded-full bg-[#f0b90b]" />
                        <div><p className="font-medium">{ex.label}</p><p className="text-[10px] text-[#848e9c] mt-0.5">{ex.exchange.toUpperCase()} · {ex.api_key_masked ?? '••••'}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Capital */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Capital (USDT) &nbsp;
                <span className="text-[#4a5568]">Balance: ${((user as unknown as { balance_usdt?: number })?.balance_usdt ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </label>
              <input type="number" min={10} step={100} value={params.initial_capital}
                onChange={e => setParams(p => ({ ...p, initial_capital: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition" />
            </div>

            {/* Take Profit */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Take Profit: <span className="text-[#0ecb81] font-semibold">{params.take_profit_pct}%</span>
              </label>
              <input type="range" min={1} max={50} step={0.5} value={params.take_profit_pct}
                onChange={e => setParams(p => ({ ...p, take_profit_pct: parseFloat(e.target.value) }))}
                className="w-full accent-[#0ecb81]" />
              <div className="flex justify-between text-[10px] text-[#4a5568] mt-1">
                <span>1%</span><span>Auto-close on gain</span><span>50%</span>
              </div>
            </div>

            {/* Risk per trade */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Risk Per Trade: <span className="text-[#f0b90b] font-semibold">{params.risk_per_trade_pct}%</span>
                {params.risk_per_trade_pct >= 50 && <span className="ml-1 text-[#f6465d] font-bold text-[10px]">⚠ Aggressive</span>}
              </label>
              <input type="range" min={1} max={100} step={1} value={params.risk_per_trade_pct}
                onChange={e => setParams(p => ({ ...p, risk_per_trade_pct: parseFloat(e.target.value) }))}
                className="w-full accent-[#f0b90b]" />
              <div className="flex justify-between text-[10px] text-[#4a5568] mt-1">
                <span>1%</span><span>Conservative ← → Aggressive</span><span>100%</span>
              </div>
            </div>

            {/* Max drawdown */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Max Drawdown Stop: <span className="text-[#f6465d] font-semibold">{params.max_drawdown_pct}%</span>
              </label>
              <input type="range" min={1} max={50} step={1} value={params.max_drawdown_pct}
                onChange={e => setParams(p => ({ ...p, max_drawdown_pct: parseFloat(e.target.value) }))}
                className="w-full accent-[#f6465d]" />
              <div className="flex justify-between text-[10px] text-[#4a5568] mt-1">
                <span>1%</span><span>Stop bot at this loss</span><span>50%</span>
              </div>
            </div>

            {/* Summary + start */}
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 pt-2 border-t border-[#2b3139]">
              <div className="flex flex-wrap gap-3 text-xs text-[#848e9c] flex-1">
                <span><span className="text-[#4a5568]">Ticker</span> <span className="text-[#f0b90b] font-mono font-semibold">{params.ticker}</span></span>
                <span><span className="text-[#4a5568]">Strategy</span> <span className="text-[#eaecef] font-semibold uppercase">{params.strategy}</span></span>
                <span><span className="text-[#4a5568]">Direction</span> <span className="text-[#eaecef] font-semibold capitalize">{params.direction}</span></span>
                <span><span className="text-[#4a5568]">TP</span> <span className="text-[#0ecb81] font-semibold">+{params.take_profit_pct}%</span></span>
                <span><span className="text-[#4a5568]">SL</span> <span className="text-[#f6465d] font-semibold">-3% (fixed)</span></span>
                <span><span className="text-[#4a5568]">Mode</span> <span className="text-[#f6465d] font-semibold">LIVE</span></span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveDefaults} disabled={savingParams}
                  className="flex items-center gap-1.5 text-xs border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] px-3 py-2 rounded-lg transition">
                  <Save size={11} /> {savingParams ? 'Saving…' : 'Save Defaults'}
                </button>
                <button onClick={handleStart} disabled={!!actionLoading}
                  className="flex items-center gap-2 bg-[#0ecb81] hover:bg-[#0ab56f] disabled:opacity-60 text-black font-bold px-5 py-2 rounded-xl text-sm transition">
                  <Play size={13} /> {actionLoading === 'start' ? 'Starting…' : 'Launch Bot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Bots Grid ── */}
      {activeBots.length === 0 && !showAddBot && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-[#161a1e] border border-[#2b3139] rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-[#2b3139] flex items-center justify-center">
            <Bot size={28} className="text-[#848e9c]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#eaecef]">No bots running</p>
            <p className="text-xs text-[#848e9c] mt-1">Click "Add Bot" to launch your first AI trading bot</p>
          </div>
          <button onClick={() => setShowAddBot(true)}
            className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d9a60b] text-black font-bold px-5 py-2.5 rounded-xl text-sm transition">
            <Plus size={14} /> Add Bot
          </button>
        </div>
      )}

      {activeBots.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeBots.map(bot => {
            const flash = priceFlash[bot.bot_id]
            return (
              <div key={bot.bot_id} className={`bg-[#161a1e] border rounded-2xl p-4 space-y-3 ${bot.running ? 'border-[#0ecb81]/20' : 'border-[#2b3139]'}`}>
                {/* Bot header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bot.running ? 'bg-[#0ecb81]/10' : 'bg-[#2b3139]'}`}>
                      <Bot size={16} className={bot.running ? 'text-[#0ecb81]' : 'text-[#848e9c]'} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#eaecef]">{bot.bot_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-[#f0b90b]">{bot.ticker}</span>
                        <span className="text-[10px] text-[#848e9c]">·</span>
                        <span className="text-[10px] uppercase font-semibold text-[#848e9c]">{bot.strategy}</span>
                        <span className="text-[10px] text-[#848e9c]">·</span>
                        <span className="text-[10px] capitalize text-[#848e9c]">{bot.direction}</span>
                        {bot.running && <span className="text-[10px] text-[#0ecb81] animate-pulse">● Live</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {bot.position > 0 && (
                      <button onClick={() => handleClosePosition(bot.bot_id)}
                        disabled={actionLoading === `close_${bot.bot_id}`}
                        className="text-[10px] px-2 py-1 bg-[#f0b90b]/10 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg hover:bg-[#f0b90b]/20 transition disabled:opacity-60">
                        {actionLoading === `close_${bot.bot_id}` ? '…' : 'Close Pos'}
                      </button>
                    )}
                    <button onClick={() => handleStop(bot.bot_id)}
                      disabled={!!actionLoading}
                      className="text-[10px] px-2 py-1 bg-[#f6465d]/10 border border-[#f6465d]/30 text-[#f6465d] rounded-lg hover:bg-[#f6465d]/20 transition disabled:opacity-60">
                      {actionLoading === bot.bot_id ? '…' : 'Stop'}
                    </button>
                  </div>
                </div>

                {/* Price + signal row */}
                <div className="flex items-center justify-between bg-[#0b0e11] rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-[10px] text-[#848e9c] mb-0.5">Live Price</p>
                    <p className={`text-lg font-bold font-mono transition-colors duration-300 ${flash === 'up' ? 'text-[#0ecb81]' : flash === 'down' ? 'text-[#f6465d]' : 'text-[#eaecef]'}`}>
                      ${bot.current_price < 1 ? bot.current_price.toFixed(5) : fmt(bot.current_price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${bot.signal === 'BULLISH' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : bot.signal === 'BEARISH' ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                      {bot.signal}
                    </span>
                    <p className="text-[10px] text-[#848e9c] mt-1">TP: +{bot.take_profit_pct}% · SL: -3%</p>
                  </div>
                </div>

                {/* Price chart */}
                <div className="bg-[#0b0e11] rounded-xl px-2 py-2">
                  <div className="flex items-center justify-between mb-1 px-1">
                    <p className="text-[10px] text-[#848e9c]">Price Chart</p>
                    {bot.price_chart.length > 1 && (
                      <p className="text-[10px] text-[#4a5568]">{bot.price_chart.length} ticks · ● entry  ● exit</p>
                    )}
                  </div>
                  <BotPriceChart bot={bot} />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: 'Balance',   v: `$${fmt(bot.balance)}`,   c: 'text-[#eaecef]' },
                    { l: 'Realized',  v: `${bot.realized_pnl >= 0 ? '+' : ''}$${fmt(bot.realized_pnl)}`, c: bot.realized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                    { l: 'Unrealized',v: bot.position > 0 ? `${bot.unrealized_pnl >= 0 ? '+' : ''}$${fmt(bot.unrealized_pnl)}` : '—', c: bot.unrealized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                    { l: 'Win Rate',  v: `${bot.win_rate.toFixed(1)}%`, c: bot.win_rate >= 50 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                  ].map(s => (
                    <div key={s.l} className="bg-[#0b0e11] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-[#4a5568] uppercase tracking-wide mb-1">{s.l}</p>
                      <p className={`text-xs font-bold font-mono ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>

                {/* Open position */}
                {bot.position > 0 && (
                  <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-3 py-2.5 space-y-1">
                    <p className="text-[10px] text-[#f0b90b] font-semibold uppercase tracking-wide flex items-center gap-1">
                      <Target size={9} /> Open Position
                    </p>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Entry</span>
                      <span className="font-mono text-[#eaecef]">${fmt(bot.entry_price)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Qty</span>
                      <span className="font-mono text-[#f0b90b]">{bot.position.toFixed(6)} {bot.ticker.replace('-USD','')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Unrealized P&L</span>
                      <span className={`font-mono font-semibold ${bot.unrealized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {bot.unrealized_pnl >= 0 ? '+' : ''}${fmt(bot.unrealized_pnl)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Recent trades mini */}
                {bot.recent_trades.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#848e9c] uppercase tracking-wide">Recent Trades</p>
                    {bot.recent_trades.slice(0, 3).map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.action}</span>
                          <span className="text-[#848e9c] font-mono">${t.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.pnl !== null && (
                            <span className={`font-mono font-semibold ${t.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                            </span>
                          )}
                          <span className="text-[#4a5568]">{new Date(t.time).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Summary P&L stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Realized P&L',    value: `${totalPnl >= 0 ? '+' : ''}$${fmt(totalPnl)}`,       sub: `${pnlTrades.length} closed`,              up: totalPnl >= 0,             icon: TrendingUp   },
          { label: 'Unrealized P&L',  value: totalUnrealized !== 0 ? `${totalUnrealized >= 0 ? '+' : ''}$${fmt(totalUnrealized)}` : '—', sub: activeBots.filter(b => b.position > 0).length + ' open', up: totalUnrealized >= 0, icon: Activity },
          { label: 'Win Rate',        value: `${winRate}%`,                                          sub: `${winningTrades} of ${pnlTrades.length}`, up: parseFloat(winRate as string) > 50, icon: Cpu },
          { label: 'Portfolio Value', value: totalPortfolio > 0 ? `$${fmt(totalPortfolio)}` : '—', sub: `${activeBots.length} active bots`,         up: true,                      icon: DollarSign   },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#848e9c]">{s.label}</span>
                <div className="w-7 h-7 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
                  <Icon size={13} className="text-[#f0b90b]" />
                </div>
              </div>
              <p className={`text-xl font-bold font-mono ${s.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{s.value}</p>
              <p className="text-xs text-[#848e9c] mt-1">{s.sub}</p>
            </div>
          )
        })}
      </div>

      {/* ── Cumulative P&L Chart ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[#f0b90b]" />
            <h3 className="text-sm font-semibold text-[#eaecef]">Cumulative P&L (30 days)</h3>
          </div>
          {pnlHistory.length > 0 && (
            <span className={`text-xs font-bold font-mono ${(pnlHistory[pnlHistory.length - 1]?.cumulative ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {(pnlHistory[pnlHistory.length - 1]?.cumulative ?? 0) >= 0 ? '+' : ''}${(pnlHistory[pnlHistory.length - 1]?.cumulative ?? 0).toFixed(2)}
            </span>
          )}
        </div>
        {pnlHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 gap-2">
            <BarChart2 size={24} className="text-[#2b3139]" />
            <p className="text-xs text-[#848e9c]">No P&L history yet — run bots to see your chart</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pnlHistory} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ecb81" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0ecb81" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
              <XAxis dataKey="date" tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v as number).toFixed(0)}`} width={52} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 10, fontSize: 11 }} labelStyle={{ color: '#848e9c' }} formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'P&L']} />
              <ReferenceLine y={0} stroke="#2b3139" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="cumulative" stroke="#0ecb81" strokeWidth={2} fill="url(#pnlGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Strategy info banner ── */}
      <div className="flex items-start gap-3 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-4 py-3">
        <Brain size={16} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#848e9c] space-y-1">
          <p><span className="text-[#f0b90b] font-semibold">SMA Strategy:</span> Price crossover with 6-period moving average. Buys on bullish cross, sells on bearish cross or TP/SL.</p>
          <p><span className="text-[#f0b90b] font-semibold">FinLux Strategy:</span> LuxAlgo Trendlines with Breaks — detects pivot highs/lows, draws dynamic trendlines, fires on upward/downward breakouts.</p>
          <p className="text-[#4a5568]">Entry/exit markers shown as dots on price chart. Green = BUY, Red = SELL. Yellow dashed line = entry price.</p>
        </div>
      </div>

      {/* ── Full trade log ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#f0b90b]" />
            <h2 className="text-sm font-semibold text-[#eaecef]">Live Trade Log</h2>
            {status.running && <span className="text-[10px] bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
          </div>
          <span className="text-xs text-[#848e9c]">{trades.length} trades</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                {['Time','Asset','Action','Price','Qty','P&L','Reason'].map(h => (
                  <th key={h} className={`px-4 py-3 font-medium ${h === 'Price' || h === 'Qty' || h === 'P&L' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Bot size={28} className="text-[#2b3139]" />
                    <p className="text-sm text-[#848e9c]">No trades yet — start a bot to begin</p>
                  </div>
                </td></tr>
              ) : trades.map((t, i) => (
                <tr key={t.id ?? i} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                  <td className="px-4 py-3 text-xs text-[#848e9c] whitespace-nowrap">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs font-mono font-semibold text-[#f0b90b]">{t.ticker}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.action}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">${t.price < 1 ? t.price.toFixed(5) : fmt(t.price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">{t.qty.toFixed(6)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.pnl !== null
                      ? <span className={t.pnl >= 0 ? 'text-[#0ecb81] font-semibold' : 'text-[#f6465d] font-semibold'}>{t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}</span>
                      : <span className="text-[#848e9c]">Open</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#848e9c]">{(t.reason ?? '').replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
