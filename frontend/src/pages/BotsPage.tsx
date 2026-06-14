import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getBotStatus, startBot, stopBot, closeBotPosition,
  getBotTrades, updateBotParams, getBotPnlHistory, listApiKeys,
  getSubscriptionLimits,
  finEventStart, finEventStop, finEventTrades, finEventListBots,
  getMe,
} from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Bot, Play, Square, RefreshCw, TrendingUp, Activity, Zap, Brain,
  Save, ChevronDown, BarChart2, Lock, KeyRound, ArrowRight,
  TrendingDown, DollarSign, Cpu, Plus, X, Target, ArrowUpDown,
  ChevronUp, Crown, Calculator,
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
  stop_loss_pct: number
  leverage: number
  lot_size: number
  open_margin: number
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

interface SubLimits {
  subscription: string
  limits: { api_keys: number; bots: number }
  used: { api_keys: number }
}

interface PnlPoint { date: string; pnl: number; cumulative: number }

const TICKERS = [
  'BTC-USD','ETH-USD','SOL-USD','XRP-USD','BNB-USD','ADA-USD',
  'AVAX-USD','DOGE-USD','NVDA','AAPL','TSLA','MSFT','GOOGL','AMZN','META',
]

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

// Compact formatter: 2,421,266 → 2.42M  |  94,500 → 94.5K
function fmtC(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (abs >= 10_000)    return (n / 1_000).toFixed(1) + 'K'
  return fmt(n)
}

const MIN_CAPITAL = 200

const EMPTY_PARAMS = {
  ticker: 'BTC-USD',
  route: '__balance__',
  initial_capital: 200,
  risk_per_trade_pct: 100,
  max_drawdown_pct: 25,
  strategy: 'finlux' as 'sma' | 'finlux' | 'auto' | 'live',
  take_profit_pct: 50,
  stop_loss_pct: 30,
  leverage: 200,
  sl_usdt: 100,
  direction: 'auto' as 'auto' | 'buy' | 'sell',
  bot_name: '',
  lot_size: 1,
  execution_cooldown: 40,
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
  const isUp = prices[prices.length - 10] >= prices[0]

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
  const { user, setUser }  = useAuthStore()
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
  const [subLimits,    setSubLimits]    = useState<SubLimits | null>(null)
  const [prevPrices,   setPrevPrices]   = useState<Record<string, number>>({})
  const [priceFlash,   setPriceFlash]   = useState<Record<string, 'up' | 'down'>>({})
  const [collapsedBots,setCollapsedBots]= useState<Record<string, boolean>>({})
  const flashTimers                     = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [params, setParams] = useState({ ...EMPTY_PARAMS })

  // ── FinEventAI multi-bot state ────────────────────────────────────────────
  const [feBots,       setFeBots]       = useState<any[]>([])
  const [feMaxBots,    setFeMaxBots]    = useState(0)
  const [feTrades,     setFeTrades]     = useState<any[]>([])
  const [feLoading,    setFeLoading]    = useState(false)
  const [feParams,     setFeParams]     = useState({
    bot_name:           '',
    min_impact_score:   7,
    tickers:            ['BTC-USD', 'ETH-USD'],
    capital_per_trade:  500,
    max_trades_per_day: 10,
    balance_to_use:     1000,
    sentiment_filter:   'both',
  })
  const [feTickerInput, setFeTickerInput] = useState('BTC-USD,ETH-USD')
  const [showFePanel,  setShowFePanel]  = useState(false)
  const [feCollapsed,  setFeCollapsed]  = useState(false)
  useEffect(() => {
    Promise.allSettled([listApiKeys(), getSubscriptionLimits()])
      .then(([keysRes, limitsRes]) => {
        if (keysRes.status === 'fulfilled') {
          const keys = Array.isArray(keysRes.value.data) ? keysRes.value.data : []
          setHasApiKey(keys.some((k: { is_active: boolean }) => k.is_active))
        } else {
          setHasApiKey(false)
        }
        if (limitsRes.status === 'fulfilled') {
          setSubLimits(limitsRes.value.data)
        }
      })
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

  // When strategy switches to 'live', auto-set direction away from 'auto'
  useEffect(() => {
    if (params.strategy === 'live' && params.direction === 'auto') {
      setParams(p => ({ ...p, direction: 'buy' }))
    }
  }, [params.strategy])

  // ── FinEventAI multi-bot handlers ─────────────────────────────────────────
  const fetchFeStatus = useCallback(async () => {
    try {
      const [listRes, tRes] = await Promise.allSettled([finEventListBots(), finEventTrades(20)])
      if (listRes.status === 'fulfilled') {
        const d = listRes.value.data
        setFeBots(Array.isArray(d.bots) ? d.bots : [])
        setFeMaxBots(d.max_event_bots ?? 0)
      }
      if (tRes.status === 'fulfilled') setFeTrades(Array.isArray(tRes.value.data) ? tRes.value.data : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchFeStatus()
    const id = setInterval(fetchFeStatus, 30_000)
    return () => clearInterval(id)
  }, [fetchFeStatus])

  const handleFeStart = async () => {
    const botName = feParams.bot_name.trim() || `Bot ${feBots.length + 1}`
    setFeLoading(true)
    try {
      const tickers = feTickerInput.split(',').map(s => s.trim()).filter(Boolean)
      await finEventStart({ ...feParams, bot_name: botName, tickers })
      toast.success(`FinEventAI "${botName}" started`)
      await fetchFeStatus()
      setShowFePanel(false)
      setFeParams(p => ({ ...p, bot_name: '' }))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start FinEventAI')
    } finally { setFeLoading(false) }
  }

  const handleFeStop = async (botName: string) => {
    setFeLoading(true)
    try {
      await finEventStop(botName)
      toast.success(`FinEventAI "${botName}" stopped`)
      await fetchFeStatus()
    } catch { toast.error('Failed to stop FinEventAI') } finally { setFeLoading(false) }
  }

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, tradesRes, pnlRes] = await Promise.allSettled([
        getBotStatus(), getBotTrades(50), getBotPnlHistory(30),
      ])
      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value.data
        setStatus(_ => {
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
      // Refresh wallet balance so bot PnL is reflected in the header
      getMe().then(r => { if (r.data) setUser(r.data) }).catch(() => {})
    } catch { /* silent */ } finally { setLoading(false) }
  }, [prevPrices, setUser])

  useEffect(() => {
    fetchData()
    const interval = status.running ? 5000 : 15000
    const id = setInterval(fetchData, interval)
    return () => clearInterval(id)
  }, [fetchData, status.running])

  const handleStart = async () => {
    if (params.initial_capital < MIN_CAPITAL) {
      toast.error(`Minimum capital is $${MIN_CAPITAL} USDT.`)
      return
    }

    // Broker margin check
    const requiredMargin = (params.lot_size * 100000) / params.leverage
    if (requiredMargin > params.initial_capital) {
      toast.error(`Insufficient Capital for this Lot Size/Leverage configuration. Required margin: $${requiredMargin.toLocaleString('en-US', { maximumFractionDigits: 2 })}`)
      return
    }
    const usingBalance = params.route === '__balance__'
    const balance      = (user as unknown as { balance_usdt?: number })?.balance_usdt ?? 0
    if (usingBalance && balance < params.initial_capital) {
      toast.error(`Insufficient balance. Need $${params.initial_capital.toLocaleString()} USDT.`)
      return
    }

    // Subscription limit check (client-side preview)
    if (subLimits) {
      const runningCount = activeBots.filter(b => b.running).length
      if (runningCount >= subLimits.limits.bots) {
        toast.error(`Bot limit reached for your ${subLimits.subscription.toUpperCase()} plan (${subLimits.limits.bots} max). Upgrade to run more bots.`)
        navigate('/app/pricing')
        return
      }
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
        leverage:           params.leverage,
        sl_usdt:            params.sl_usdt,
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
  const runningBotCount = activeBots.filter(b => b.running).length
  const botLimit        = subLimits?.limits?.bots ?? 999
  const atBotLimit      = runningBotCount >= botLimit

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
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-[#eaecef]">Fin Bot</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.running ? 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 animate-pulse' : 'bg-[#2b3139] text-[#848e9c]'}`}>
            {status.running ? `● ${activeBots.length} Live` : 'Offline'}
          </span>
          {subLimits && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${atBotLimit ? 'bg-[#f6465d]/10 text-[#f6465d] border-[#f6465d]/30' : 'bg-[#2b3139] text-[#848e9c] border-[#2b3139]'}`}>
              {runningBotCount}/{botLimit === 9999 ? '∞' : botLimit} bots · {subLimits.subscription.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status.running && (
            <button onClick={() => handleStop('ALL')} disabled={!!actionLoading}
              className="flex items-center gap-1.5 text-xs bg-[#f6465d]/10 hover:bg-[#f6465d]/20 border border-[#f6465d]/30 text-[#f6465d] px-3 py-1.5 rounded-lg transition">
              <Square size={11} /> Stop All
            </button>
          )}
          <button onClick={() => { setFeCollapsed(false); setShowFePanel(s => !s) }}
            className="flex items-center gap-1.5 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] px-3 py-1.5 rounded-lg transition">
            <Brain size={11} /> FinEventAI Bots
          </button>
          {atBotLimit ? (
            <button onClick={() => navigate('/app/pricing')}
              className="flex items-center gap-1.5 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] px-3 py-1.5 rounded-lg transition">
              <Crown size={11} /> Upgrade for More Bots
            </button>
          ) : (
            <button onClick={() => setShowAddBot(v => !v)}
              className="flex items-center gap-1.5 text-xs bg-[#f0b90b] hover:bg-[#d9a60b] text-black font-semibold px-3 py-1.5 rounded-lg transition">
              <Plus size={12} /> Add Bot
            </button>
          )}
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
              {(() => {
                const isSubscriber = user?.subscription && user.subscription !== 'free'
                return (
                  <>
                    <div className="grid grid-cols-2 gap-1 bg-[#0b0e11] p-1 rounded-xl border border-[#2b3139]">
                      {([
                        ['sma',    'SMA',    true],
                        ['finlux', 'FinLux', true],
                        ['auto',   'AUTO',   false],
                        ['live',   'LIVE',   false],
                      ] as const).map(([s, label, premiumOnly]) => {
                        const locked = premiumOnly && !isSubscriber
                        return (
                          <button key={s}
                            onClick={() => {
                              if (locked) {
                                toast.error('FinLux & SMA require a paid subscription. Upgrade your plan.')
                                navigate('/app/pricing')
                                return
                              }
                              setParams(p => ({ ...p, strategy: s }))
                            }}
                            className={`relative py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5
                              ${params.strategy === s && !locked ? 'bg-[#f0b90b] text-black' :
                                locked ? 'text-[#4a5568] cursor-pointer' :
                                'text-[#848e9c] hover:text-[#eaecef]'}`}>
                            {locked && <Lock size={9} className="shrink-0" />}
                            {label}
                            {locked && <Crown size={9} className="shrink-0 text-[#f0b90b]" />}
                          </button>
                        )
                      })}
                    </div>
                    {!isSubscriber && (
                      <p className="text-[10px] text-[#f0b90b]/70 mt-1 flex items-center gap-1">
                        <Crown size={9} /> FinLux & SMA are subscriber-only strategies
                      </p>
                    )}
                    <p className="text-[10px] text-[#4a5568] mt-0.5">
                      {params.strategy === 'sma'    ? 'SMA-6 momentum crossover' :
                       params.strategy === 'finlux' ? 'LuxAlgo Trendlines with Breaks' :
                       params.strategy === 'auto'   ? 'AI selects best strategy dynamically' :
                                                     'Immediate execution — no strategy filter'}
                    </p>
                  </>
                )
              })()}
            </div>

            {/* Direction */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Bot Direction</label>
              <div className="flex gap-1 bg-[#0b0e11] p-1 rounded-xl border border-[#2b3139]">
                {(params.strategy === 'live'
                  ? [['buy', 'Buy Only', TrendingUp], ['sell', 'Sell Only', TrendingDown]] as const
                  : [['auto', 'Auto', ArrowUpDown], ['buy', 'Buy Only', TrendingUp], ['sell', 'Sell Only', TrendingDown]] as const
                ).map(([val, lbl, Icon]) => (
                  <button key={val} onClick={() => setParams(p => ({ ...p, direction: val as typeof p.direction }))}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition ${params.direction === val ? val === 'buy' ? 'bg-[#0ecb81] text-black' : val === 'sell' ? 'bg-[#f6465d] text-white' : 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                    <Icon size={10} />{lbl}
                  </button>
                ))}
              </div>
              {params.strategy === 'live' && (
                <p className="text-[10px] text-[#f0b90b] mt-1">Live mode: choose Buy or Sell direction</p>
              )}
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
              <input type="number" min={MIN_CAPITAL} step={100} value={params.initial_capital}
                onChange={e => setParams(p => ({ ...p, initial_capital: parseFloat(e.target.value) || 0 }))}
                className={`w-full bg-[#0b0e11] border rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition ${params.initial_capital < MIN_CAPITAL ? 'border-[#f6465d] focus:border-[#f6465d]' : 'border-[#2b3139] focus:border-[#f0b90b]'}`} />
              {params.initial_capital < MIN_CAPITAL && (
                <p className="text-[10px] text-[#f6465d] mt-1">Minimum capital is ${MIN_CAPITAL} USDT</p>
              )}
            </div>

            {/* Lot Size */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Lot Size</label>
              <input type="number" min={1} max={100} step={1} value={params.lot_size}
                onChange={e => setParams(p => ({ ...p, lot_size: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition" />
              <p className="text-[10px] text-[#4a5568] mt-1">Range: 1 – 100 lots</p>
            </div>

            {/* Take Profit */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Take Profit (%)</label>
              <input type="number" min={5} max={200} step={1} value={params.take_profit_pct}
                onChange={e => setParams(p => ({ ...p, take_profit_pct: Math.min(200, Math.max(5, parseFloat(e.target.value) || 5)) }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#0ecb81] rounded-xl px-3 py-2.5 text-sm font-mono text-[#0ecb81] focus:outline-none transition" />
              <p className="text-[10px] text-[#4a5568] mt-1">Range: 5% – 200%</p>
            </div>

            {/* Stop Loss */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Stop Loss (%)</label>
              <input type="number" min={5} max={100} step={1} value={params.stop_loss_pct}
                onChange={e => setParams(p => ({ ...p, stop_loss_pct: Math.min(100, Math.max(5, parseFloat(e.target.value) || 5)) }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f6465d] rounded-xl px-3 py-2.5 text-sm font-mono text-[#f6465d] focus:outline-none transition" />
              <p className="text-[10px] text-[#4a5568] mt-1">Range: 5% – 100%</p>
            </div>

            {/* Execution Cooldown */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Execution Cooldown <span className="text-[#f0b90b]">(seconds)</span></label>
              <input type="number" min={40} max={3600} step={1} value={params.execution_cooldown}
                onChange={e => setParams(p => ({ ...p, execution_cooldown: Math.max(40, parseInt(e.target.value) || 40) }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition" />
              <p className="text-[10px] text-[#4a5568] mt-1">Minimum <span className="text-[#eaecef]">40 seconds</span> wait between trades — not minutes</p>
            </div>

            {/* Leverage */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs text-[#848e9c] mb-2 block">
                Leverage: <span className={`font-bold ${params.leverage >= 100 ? 'text-[#f6465d]' : params.leverage >= 20 ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>1:{params.leverage}</span>
                {params.leverage >= 100 && <span className="ml-2 text-[#f6465d] text-[10px] font-bold">⚠ EXTREME — High liquidation risk</span>}
                {params.leverage >= 20 && params.leverage < 100 && <span className="ml-2 text-[#f0b90b] text-[10px] font-bold">⚠ High leverage</span>}
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {[1, 5, 10, 25, 50, 100, 200, 500, 1000, 1200].map(lv => (
                  <button key={lv} type="button"
                    onClick={() => setParams(p => ({ ...p, leverage: lv }))}
                    className={`text-[10px] py-2 rounded-lg border transition font-mono text-center ${params.leverage === lv ? 'bg-[#f0b90b] text-black border-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/40 hover:text-[#eaecef]'}`}>
                    1:{lv}
                  </button>
                ))}
              </div>
            </div>

            {/* Max drawdown */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Max Drawdown Stop (%)
              </label>
              <input type="number" min={1} max={50} step={1} value={params.max_drawdown_pct}
                onChange={e => setParams(p => ({ ...p, max_drawdown_pct: Math.min(50, Math.max(1, parseFloat(e.target.value) || 1)) }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f6465d] rounded-xl px-3 py-2.5 text-sm font-mono text-[#f6465d] focus:outline-none transition" />
              <p className="text-[10px] text-[#4a5568] mt-1">Stop bot when portfolio drops <span className="text-[#f6465d]">{params.max_drawdown_pct}%</span> — Range: 1% – 50%</p>
            </div>

            {/* Margin Calculator */}
            <div className="sm:col-span-2 lg:col-span-3">
              {(() => {
                const reqMargin = (params.lot_size * 100_000) / Math.max(params.leverage, 1)
                const ok = params.initial_capital >= reqMargin
                return (
                  <div className={`flex items-center gap-3 p-3 rounded-xl border ${ok ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : 'bg-[#f6465d]/5 border-[#f6465d]/20'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? 'bg-[#0ecb81]/10' : 'bg-[#f6465d]/10'}`}>
                      <Calculator size={14} className={ok ? 'text-[#0ecb81]' : 'text-[#f6465d]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[#848e9c] mb-0.5">Live Margin Required</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                        <span className={`text-sm font-bold font-mono ${ok ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          ${reqMargin.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-[#4a5568]">
                          {params.lot_size} lot × 100,000 ÷ 1:{params.leverage} = ${reqMargin.toFixed(2)}
                        </span>
                        {!ok && <span className="text-[10px] text-[#f6465d] font-semibold">⚠ Increase capital or reduce lot size</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-[#4a5568]">Capital</p>
                      <p className={`text-sm font-bold font-mono ${ok ? 'text-[#eaecef]' : 'text-[#f6465d]'}`}>${params.initial_capital.toLocaleString()}</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Summary + start */}
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 pt-2 border-t border-[#2b3139]">
              <div className="flex flex-wrap gap-3 text-xs text-[#848e9c] flex-1">
                <span><span className="text-[#4a5568]">Ticker</span> <span className="text-[#f0b90b] font-mono font-semibold">{params.ticker}</span></span>
                <span><span className="text-[#4a5568]">Strategy</span> <span className="text-[#eaecef] font-semibold uppercase">{params.strategy}</span></span>
                <span><span className="text-[#4a5568]">Direction</span> <span className="text-[#eaecef] font-semibold capitalize">{params.direction}</span></span>
                <span><span className="text-[#4a5568]">TP</span> <span className="text-[#0ecb81] font-semibold">+{params.take_profit_pct}%</span></span>
                <span><span className="text-[#4a5568]">SL</span> <span className="text-[#f6465d] font-semibold">-{params.stop_loss_pct}%</span></span>
                <span><span className="text-[#4a5568]">Leverage</span> <span className="text-[#f0b90b] font-semibold">1:{params.leverage}</span></span>
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
            const flash      = priceFlash[bot.bot_id]
            const collapsed  = !!collapsedBots[bot.bot_id]
            const toggleCollapse = () => setCollapsedBots(c => ({ ...c, [bot.bot_id]: !c[bot.bot_id] }))
            return (
              <div key={bot.bot_id} className={`bg-[#161a1e] border rounded-2xl overflow-hidden ${bot.running ? 'border-[#0ecb81]/20' : 'border-[#2b3139]'}`}>
                {/* ── Bot header (always visible) ── */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${bot.running ? 'bg-[#0ecb81]/10' : 'bg-[#2b3139]'}`}>
                      <Bot size={16} className={bot.running ? 'text-[#0ecb81]' : 'text-[#848e9c]'} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#eaecef] truncate">{bot.bot_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono text-[#f0b90b]">{bot.ticker}</span>
                        <span className="text-[10px] text-[#848e9c]">·</span>
                        <span className="text-[10px] uppercase font-semibold text-[#848e9c]">{bot.strategy}</span>
                        <span className="text-[10px] text-[#848e9c]">·</span>
                        <span className="text-[10px] capitalize text-[#848e9c]">{bot.direction}</span>
                        {bot.running && <span className="text-[10px] text-[#0ecb81] animate-pulse">● Live</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {/* Collapse toggle */}
                    <button onClick={toggleCollapse}
                      className="text-[10px] px-2 py-1 bg-[#2b3139] text-[#848e9c] rounded-lg hover:text-[#eaecef] transition flex items-center gap-0.5">
                      {collapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                    </button>
                    {bot.position > 0 && !collapsed && (
                      <button onClick={() => handleClosePosition(bot.bot_id)}
                        disabled={actionLoading === `close_${bot.bot_id}`}
                        className="text-[10px] px-2 py-1 bg-[#f0b90b]/10 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg hover:bg-[#f0b90b]/20 transition disabled:opacity-60">
                        {actionLoading === `close_${bot.bot_id}` ? '…' : 'Close'}
                      </button>
                    )}
                    <button onClick={() => handleStop(bot.bot_id)}
                      disabled={!!actionLoading}
                      className="text-[10px] px-2 py-1 bg-[#f6465d]/10 border border-[#f6465d]/30 text-[#f6465d] rounded-lg hover:bg-[#f6465d]/20 transition disabled:opacity-60">
                      {actionLoading === bot.bot_id ? '…' : 'Stop'}
                    </button>
                  </div>
                </div>

                {/* Collapsed summary row */}
                {collapsed && (
                  <div className="flex items-center gap-4 px-4 pb-3 text-xs">
                    <div>
                      <span className="text-[#848e9c]">Price </span>
                      <span className={`font-mono font-semibold ${flash === 'up' ? 'text-[#0ecb81]' : flash === 'down' ? 'text-[#f6465d]' : 'text-[#eaecef]'}`}>
                        ${bot.current_price < 1 ? bot.current_price.toFixed(5) : fmt(bot.current_price)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#848e9c]">P&L </span>
                      <span className={`font-mono font-semibold ${bot.realized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {bot.realized_pnl >= 0 ? '+' : ''}${fmt(bot.realized_pnl)}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${bot.signal === 'BULLISH' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : bot.signal === 'BEARISH' ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                      {bot.signal}
                    </span>
                  </div>
                )}

                {/* ── Expanded content ── */}
                {!collapsed && (
                  <div className="px-4 pb-4 space-y-3">
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
                        <p className="text-[10px] text-[#848e9c] mt-1">TP: +{bot.take_profit_pct}% · SL: -{bot.stop_loss_pct ?? 50}% · {(bot.leverage ?? 200)}x lev</p>
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
                        { l: 'Balance',    v: `$${fmtC(bot.balance)}`,   c: 'text-[#eaecef]', full: `$${fmt(bot.balance)}` },
                        { l: 'Realized',   v: `${bot.realized_pnl >= 0 ? '+' : ''}$${fmtC(bot.realized_pnl)}`, c: bot.realized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]', full: `${bot.realized_pnl >= 0 ? '+' : ''}$${fmt(bot.realized_pnl)}` },
                        { l: 'Unrealized', v: bot.position > 0 ? `${bot.unrealized_pnl >= 0 ? '+' : ''}$${fmtC(bot.unrealized_pnl)}` : '—', c: bot.unrealized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]', full: `${bot.unrealized_pnl >= 0 ? '+' : ''}$${fmt(bot.unrealized_pnl)}` },
                        { l: 'Win Rate',   v: `${bot.win_rate.toFixed(1)}%`, c: bot.win_rate >= 50 ? 'text-[#0ecb81]' : 'text-[#f6465d]', full: '' },
                      ].map(s => (
                        <div key={s.l} title={s.full || s.v} className="bg-[#0b0e11] rounded-lg p-2 text-center">
                          <p className="text-[9px] text-[#4a5568] uppercase tracking-wide mb-1 truncate">{s.l}</p>
                          <p className={`text-xs font-bold font-mono truncate ${s.c}`}>{s.v}</p>
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
                          <span className="text-[#848e9c]">Leverage</span>
                          <span className="font-mono text-[#eaecef]">{(bot.leverage ?? 200).toFixed(0)}x</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#848e9c]">Margin Used</span>
                          <span className="font-mono text-[#eaecef]">${(bot.open_margin ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#0ecb81]">TP Target</span>
                          <span className="font-mono text-[#0ecb81]">+${((bot.open_margin ?? 0) * (bot.take_profit_pct ?? 50) / 100).toFixed(2)} (+{bot.take_profit_pct ?? 50}%)</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#f6465d]">SL Target</span>
                          <span className="font-mono text-[#f6465d]">-${((bot.open_margin ?? 0) * (bot.stop_loss_pct ?? 30) / 100).toFixed(2)} (-{bot.stop_loss_pct ?? 30}%)</span>
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
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── FinEventAI Multi-Bot Section ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
          onClick={() => setFeCollapsed(c => !c)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center">
              <Brain size={18} className="text-[#f0b90b]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#eaecef]">FinEventAI Bots</p>
              <p className="text-xs text-[#848e9c]">Multiple bots trading on high-impact financial news events</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#f0b90b]/10 text-[#f0b90b]">
              {feBots.filter(b => b.running).length} running / {feMaxBots} slots
            </span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={fetchFeStatus} className="p-2 rounded-lg text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition">
              <RefreshCw size={13} />
            </button>
            {feMaxBots > 0 && feBots.some(b => b.running) && showFePanel && (
              <button onClick={() => setShowFePanel(false)}
                className="p-2 rounded-lg text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition">
                <X size={13} />
              </button>
            )}
            {feBots.some(b => b.running) && (
              <button onClick={() => setFeCollapsed(c => !c)} className="p-2 rounded-lg text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition">
                {feCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible body */}
        {!feCollapsed && (
          <>
            {/* Running bots list */}
            {feBots.length > 0 && (
              <div className="border-t border-[#2b3139] divide-y divide-[#2b3139]/50">
                {feBots.map(bot => (
                  <div key={bot.bot_name} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bot.running ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#2b3139]'}`} />
                      <span className="text-xs font-semibold text-[#eaecef] truncate capitalize">{bot.bot_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${bot.running ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                        {bot.running ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#848e9c]">
                      <span>Trades: <span className="text-[#eaecef] font-mono">{bot.trades_today ?? 0}/{bot.max_trades_per_day ?? 10}</span></span>
                      <span>Impact: <span className="text-[#eaecef] font-mono">≥{bot.min_impact_score ?? 7}</span></span>
                      <span>Capital: <span className="text-[#eaecef] font-mono">${(bot.capital_per_trade ?? 500).toFixed(0)}</span></span>
                    </div>
                    {bot.running && (
                      <button onClick={() => handleFeStop(bot.bot_name)} disabled={feLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f6465d]/10 hover:bg-[#f6465d]/20 border border-[#f6465d]/30 text-[#f6465d] text-xs font-semibold transition disabled:opacity-60">
                        <Square size={10} /> Stop
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Config panel for new bot */}
            {showFePanel && (
              <div className="px-5 py-5 space-y-4 border-t border-[#2b3139]">
                <p className="text-xs font-semibold text-[#f0b90b]">Configure New FinEventAI Bot</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Bot Name</label>
                    <input value={feParams.bot_name} onChange={e => setFeParams(p => ({ ...p, bot_name: e.target.value }))}
                      placeholder={`Bot ${feBots.length + 1}`}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Min Impact Score (1–10)</label>
                    <input type="number" min={1} max={10} value={feParams.min_impact_score}
                      onChange={e => setFeParams(p => ({ ...p, min_impact_score: Number(e.target.value) }))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Capital Per Trade (USDT)</label>
                    <input type="number" min={10} value={feParams.capital_per_trade}
                      onChange={e => setFeParams(p => ({ ...p, capital_per_trade: Number(e.target.value) }))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Max Trades / Day</label>
                    <input type="number" min={1} max={100} value={feParams.max_trades_per_day}
                      onChange={e => setFeParams(p => ({ ...p, max_trades_per_day: Number(e.target.value) }))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Tickers (comma-separated)</label>
                    <input value={feTickerInput} onChange={e => setFeTickerInput(e.target.value)}
                      placeholder="BTC-USD,ETH-USD,SOL-USD"
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] font-mono focus:outline-none focus:border-[#f0b90b]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#848e9c] mb-1.5 block">Sentiment Filter</label>
                    <div className="relative">
                      <select value={feParams.sentiment_filter}
                        onChange={e => setFeParams(p => ({ ...p, sentiment_filter: e.target.value }))}
                        className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] appearance-none pr-9 cursor-pointer">
                        <option value="both">Both (Bullish + Bearish)</option>
                        <option value="bullish">Bullish only (BUY)</option>
                        <option value="bearish">Bearish only (SELL)</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={handleFeStart} disabled={feLoading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#f0b90b] hover:bg-[#d9a60b] disabled:opacity-60 text-black rounded-xl text-sm font-semibold transition">
                    {feLoading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                    {feLoading ? 'Starting…' : 'Launch Bot'}
                  </button>
                  <p className="text-xs text-[#848e9c]">{feBots.filter(b => b.running).length}/{feMaxBots} bot slots used</p>
                </div>
              </div>
            )}

            {/* Recent event trades — deposit-history card style */}
            {feTrades.length > 0 && (
              <div className="border-t border-[#2b3139]">
                <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#848e9c] uppercase tracking-wide">Recent Event Trades</p>
                  <span className="text-xs text-[#4a5568]">{feTrades.length} trades</span>
                </div>
                <div className="divide-y divide-[#2b3139]/50 max-h-80 overflow-y-auto">
                  {feTrades.map((t, i) => (
                    <div key={t.id ?? i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[#1e2329] transition">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 border-[#0ecb81]/20' : 'bg-[#f6465d]/10 border-[#f6465d]/20'}`}>
                        {t.action === 'BUY'
                          ? <TrendingUp size={14} className="text-[#0ecb81]" />
                          : <TrendingDown size={14} className="text-[#f6465d]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#eaecef] flex items-center gap-1.5">
                            <span className="font-mono text-[#f0b90b]">{t.ticker}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.action}</span>
                          </p>
                          <p className={`text-sm font-bold font-mono ${t.action === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                            ${t.price < 1 ? Number(t.price).toFixed(5) : Number(t.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[10px] text-[#848e9c]">Qty: <span className="font-mono">{Number(t.qty ?? 0).toFixed(6)}</span> · {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</p>
                          {t.pnl != null
                            ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.pnl >= 0 ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-medium">Open</span>}
                        </div>
                        {t.reason && <p className="text-[10px] text-[#4a5568] mt-1 truncate">{(t.reason || '').replace('FinEventAI | ', '')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {feBots.length === 0 && feTrades.length === 0 && !showFePanel && (
              <div className="py-10 text-center border-t border-[#2b3139]">
                <div className="w-16 h-16 rounded-full bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center mx-auto mb-3">
                  <Brain size={26} className="text-[#f0b90b]" />
                </div>
                {feMaxBots === 0 ? (
                  <>
                    <p className="text-sm text-[#848e9c] font-semibold">FinEventAI bots require a Pro plan or higher</p>
                    <p className="text-xs text-[#4a5568] mt-1">Upgrade your plan to unlock up to 50 bots</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#848e9c] font-semibold">No FinEventAI bots running</p>
                    <p className="text-xs text-[#4a5568] mt-1">Your plan allows {feMaxBots} bot{feMaxBots !== 1 ? 's' : ''}</p>
                    <button onClick={() => { setShowFePanel(true); setFeCollapsed(false) }}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] text-sm font-semibold transition">
                      <Plus size={13} /> Add Bot
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Summary P&L stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Realized P&L',    value: `${totalPnl >= 0 ? '+' : ''}$${fmtC(totalPnl)}`,       sub: `${pnlTrades.length} closed`,              up: totalPnl >= 0,             icon: TrendingUp   },
          { label: 'Unrealized P&L',  value: totalUnrealized !== 0 ? `${totalUnrealized >= 0 ? '+' : ''}$${fmtC(totalUnrealized)}` : '—', sub: activeBots.filter(b => b.position > 0).length + ' open', up: totalUnrealized >= 0, icon: Activity },
          { label: 'Win Rate',        value: `${winRate}%`,                                          sub: `${winningTrades} of ${pnlTrades.length}`, up: parseFloat(winRate as string) > 50, icon: Cpu },
          { label: 'Portfolio Value', value: totalPortfolio > 0 ? `$${fmtC(totalPortfolio)}` : '—', sub: `${activeBots.length} active bots`,         up: true,                      icon: DollarSign   },
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

      {/* ── Full trade log — deposit-history card style ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#f0b90b]" />
            <h2 className="text-sm font-semibold text-[#eaecef]">Live Trade Log</h2>
            {status.running && <span className="text-[10px] bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
          </div>
          <span className="text-xs text-[#848e9c]">{Math.min(trades.filter(t => !t.reason?.toLowerCase().includes('trading terminal')).length, 10)} AI trades</span>
        </div>

        {trades.filter(t => !t.reason?.toLowerCase().includes('trading terminal')).length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-2">
            <Bot size={28} className="text-[#2b3139]" />
            <p className="text-sm text-[#848e9c]">No AI trades yet — start a bot to begin</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2b3139]/50">
            {trades.filter(t => !t.reason?.toLowerCase().includes('trading terminal')).slice(0, 10).map((t, i) => (
              <div key={t.id ?? i} className="px-4 py-3.5 flex items-start gap-3 hover:bg-[#1e2329] transition">
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 border-[#0ecb81]/20' : 'bg-[#f6465d]/10 border-[#f6465d]/20'}`}>
                  {t.action === 'BUY'
                    ? <TrendingUp size={14} className="text-[#0ecb81]" />
                    : <TrendingDown size={14} className="text-[#f6465d]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#eaecef] flex items-center gap-1.5">
                      <span className="font-mono text-[#f0b90b]">{t.ticker}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.action}</span>
                      <span className="text-[10px] text-[#848e9c] font-normal">{t.exchange}</span>
                    </p>
                    <p className={`text-sm font-bold font-mono ${t.action === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      ${t.price < 1 ? t.price.toFixed(5) : fmt(t.price)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-[#848e9c]">
                      Qty: <span className="font-mono">{t.qty.toFixed(6)}</span>
                      {' · '}{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                    </p>
                    {t.pnl !== null
                      ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.pnl >= 0 ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-medium">Open</span>}
                  </div>
                  {t.reason && <p className="text-[10px] text-[#4a5568] mt-1 truncate">{(t.reason ?? '').replace(/_/g, ' ')}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {trades.length > 0 && (
          <div className="px-4 py-3 border-t border-[#2b3139] flex justify-center">
            <button onClick={() => navigate('/app/transactions')}
              className="flex items-center gap-1.5 text-xs text-[#f0b90b] hover:text-[#eaecef] border border-[#f0b90b]/30 hover:border-[#f0b90b]/60 bg-[#f0b90b]/5 hover:bg-[#f0b90b]/10 px-4 py-2 rounded-lg transition font-medium">
              <ArrowRight size={11} /> View All AI Trade History
            </button>
          </div>
        )}
      </div>
    </div>
  )
}