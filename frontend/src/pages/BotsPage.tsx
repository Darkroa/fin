import { useEffect, useState, useCallback, useRef } from 'react'
import { getBotStatus, startBot, stopBot, getBotTrades, updateBotParams, getBotPnlHistory, listApiKeys } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Bot, Play, Square, RefreshCw, TrendingUp, Activity, Zap, Brain,
  Settings, Save, ChevronDown, BarChart2, Lock, KeyRound, ArrowRight,
  TrendingDown, DollarSign, Cpu,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useNavigate } from 'react-router-dom'

interface TradeLog {
  id: number; ticker: string; action: string; price: number; qty: number
  pnl: number | null; reason: string | null; exchange: string; created_at: string
}

interface BotDetail {
  running: boolean
  ticker: string
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
  recent_trades: {
    time: string; action: string; price: number; qty: number; pnl: number | null; reason: string
  }[]
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

export default function BotsPage() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const exchanges  = (user as unknown as { exchange_connections?: { exchange: string; label: string; api_key_masked?: string }[] })?.exchange_connections ?? []

  const [status,       setStatus]       = useState<BotStatus>({ running: false })
  const [trades,       setTrades]       = useState<TradeLog[]>([])
  const [pnlHistory,   setPnlHistory]   = useState<PnlPoint[]>([])
  const [loading,      setLoading]      = useState(true)
  const [actionLoading,setActionLoading]= useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [savingParams, setSavingParams] = useState(false)
  const [showTickerDD, setShowTickerDD] = useState(false)
  const [showRouteDD,  setShowRouteDD]  = useState(false)
  const [hasApiKey,    setHasApiKey]    = useState<boolean | null>(null)
  const [prevPrice,    setPrevPrice]    = useState<number>(0)
  const [priceFlash,   setPriceFlash]   = useState<'up'|'down'|null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    listApiKeys()
      .then(res => {
        const keys = Array.isArray(res.data) ? res.data : []
        setHasApiKey(keys.some((k: { is_active: boolean }) => k.is_active))
      })
      .catch(() => setHasApiKey(false))
  }, [])

  const [params, setParams] = useState({
    ticker: 'BTC-USD',
    route: '__balance__',
    initial_capital: (user as unknown as { default_capital?: number })?.default_capital || 1000,
    risk_per_trade_pct: (user as unknown as { risk_per_trade?: number })?.risk_per_trade || 1.0,
    max_drawdown_pct:   (user as unknown as { max_drawdown?: number })?.max_drawdown || 10.0,
  })

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, tradesRes, pnlRes] = await Promise.allSettled([
        getBotStatus(), getBotTrades(50), getBotPnlHistory(30),
      ])
      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value.data
        setStatus(prev => {
          // Detect price change for flash effect
          const botKeys = Object.keys(d.bots ?? {})
          if (botKeys.length > 0) {
            const bot = (d.bots as Record<string, BotDetail>)[botKeys[0]]
            const newPrice = bot?.current_price ?? 0
            if (prevPrice && newPrice !== prevPrice) {
              const dir = newPrice > prevPrice ? 'up' : 'down'
              setPriceFlash(dir)
              if (flashTimer.current) clearTimeout(flashTimer.current)
              flashTimer.current = setTimeout(() => setPriceFlash(null), 600)
            }
            setPrevPrice(newPrice)
          }
          return { running: d.running, bots: d.bots, capital: d.capital }
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
  }, [prevPrice])

  // Fast poll when running (5s), slow when idle (15s)
  useEffect(() => {
    fetchData()
    const interval = status.running ? 5000 : 15000
    const id = setInterval(fetchData, interval)
    return () => clearInterval(id)
  }, [fetchData, status.running])

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

  const handleStart = async () => {
    const usingBalance  = params.route === '__balance__'
    const balanceUsdt   = (user as unknown as { balance_usdt?: number })?.balance_usdt ?? 0
    if (usingBalance && balanceUsdt < params.initial_capital) {
      toast.error(`Insufficient balance. Need $${params.initial_capital.toLocaleString()} USDT.`)
      return
    }
    setActionLoading(true)
    try {
      const payload = {
        ticker: params.ticker, paper: false,
        initial_capital: params.initial_capital,
        risk_per_trade_pct: params.risk_per_trade_pct,
        max_drawdown_pct:   params.max_drawdown_pct,
        exchange_label: usingBalance ? undefined : params.route,
      }
      const res = await startBot(payload)
      setStatus(s => ({ ...s, running: true }))
      toast.success(res.data?.message || 'Bot started successfully')
      fetchData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to start bot')
    } finally { setActionLoading(false) }
  }

  const handleStop = async () => {
    setActionLoading(true)
    try {
      await stopBot()
      setStatus(s => ({ ...s, running: false }))
      toast.success('All bots stopped')
      fetchData()
    } catch { toast.error('Failed to stop bot') } finally { setActionLoading(false) }
  }

  const handleSaveParams = async () => {
    setSavingParams(true)
    try {
      await updateBotParams({
        default_capital:  params.initial_capital,
        risk_per_trade:   params.risk_per_trade_pct,
        max_drawdown:     params.max_drawdown_pct,
        preferred_tickers:[params.ticker],
      })
      toast.success('Bot parameters saved')
    } catch { toast.error('Failed to save parameters') } finally { setSavingParams(false) }
  }

  // Aggregate across all bots for summary stats
  const activeBots    = Object.values(status.bots ?? {}) as BotDetail[]
  const firstBot      = activeBots[0] ?? null
  const pnlTrades     = trades.filter(t => t.pnl !== null)
  const totalPnl      = pnlTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
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
          <p className="text-sm text-[#848e9c] max-w-md">
            To access the AI Trading Bot, you need a FinAi API key. This key authenticates your bot session and keeps your trading activity secure.
          </p>
        </div>
        <div className="bg-[#161a1e] border border-[#f0b90b]/20 rounded-2xl p-6 max-w-sm w-full space-y-3 text-left">
          <p className="text-xs font-semibold text-[#f0b90b] uppercase tracking-widest">How to get access</p>
          <ol className="space-y-2 text-sm text-[#848e9c]">
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">1.</span> Go to your Profile page</li>
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">2.</span> Open the <span className="text-[#eaecef] font-medium">FinAPI</span> tab</li>
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">3.</span> Create a new API key with name <span className="font-mono text-[#eaecef]">bot</span></li>
            <li className="flex gap-2"><span className="text-[#f0b90b] font-bold">4.</span> Return here to start trading</li>
          </ol>
        </div>
        <button
          onClick={() => navigate('/app/profile')}
          className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d9a60b] text-black font-bold px-6 py-3 rounded-xl transition">
          <KeyRound size={16} /> Go to Profile — Create Key
          <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#eaecef]">AI Trading Bots</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.running ? 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 animate-pulse' : 'bg-[#2b3139] text-[#848e9c]'}`}>
            {status.running ? '● Live' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${showSettings ? 'bg-[#f0b90b]/10 border-[#f0b90b]/40 text-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'}`}>
            <Settings size={12} /> Configure
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#161a1e] border border-[#f0b90b]/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2">
              <Settings size={14} className="text-[#f0b90b]" /> Bot Configuration
            </h3>
            <button onClick={handleSaveParams} disabled={savingParams}
              className="flex items-center gap-1.5 text-xs bg-[#f0b90b] hover:bg-[#d9a60b] disabled:opacity-60 text-black font-semibold px-3 py-1.5 rounded-lg transition">
              <Save size={11} /> {savingParams ? 'Saving...' : 'Save Defaults'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Route */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">Trade Route</label>
              <div className="relative">
                <button onClick={() => { setShowRouteDD(v => !v); setShowTickerDD(false) }}
                  className="w-full flex items-center justify-between bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] transition">
                  <span className="flex items-center gap-2">
                    {params.route === '__balance__'
                      ? <><span className="w-2 h-2 rounded-full bg-[#0ecb81]" /> Platform Balance</>
                      : <><span className="w-2 h-2 rounded-full bg-[#f0b90b]" /> {routeLabel}</>
                    }
                  </span>
                  <ChevronDown size={12} className="text-[#848e9c]" />
                </button>
                {showRouteDD && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-[#1e2329] border border-[#2b3139] rounded-xl z-20 shadow-xl overflow-hidden">
                    <button onClick={() => { setParams(p => ({ ...p, route: '__balance__' })); setShowRouteDD(false) }}
                      className={`w-full text-left px-4 py-3 text-sm transition hover:bg-[#2b3139] flex items-center gap-3 ${params.route === '__balance__' ? 'text-[#0ecb81] font-semibold' : 'text-[#eaecef]'}`}>
                      <span className="w-2 h-2 rounded-full bg-[#0ecb81] flex-shrink-0" />
                      <div>
                        <p className="font-medium">Platform Balance</p>
                        <p className="text-[10px] text-[#848e9c] mt-0.5">Trade via your FinAi wallet USDT balance</p>
                      </div>
                    </button>
                    {exchanges.map(ex => (
                      <button key={ex.exchange} onClick={() => { setParams(p => ({ ...p, route: ex.label || ex.exchange })); setShowRouteDD(false) }}
                        className={`w-full text-left px-4 py-3 text-sm transition hover:bg-[#2b3139] flex items-center gap-3 border-t border-[#2b3139] ${params.route === (ex.label || ex.exchange) ? 'text-[#f0b90b] font-semibold' : 'text-[#eaecef]'}`}>
                        <span className="w-2 h-2 rounded-full bg-[#f0b90b] flex-shrink-0" />
                        <div>
                          <p className="font-medium">{ex.label || ex.exchange}</p>
                          <p className="text-[10px] text-[#848e9c] mt-0.5">Live API · {ex.api_key_masked ?? '••••••••'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Capital */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Initial Capital (USDT)
                <span className="ml-2 text-[#4a5568]">Balance: ${((user as unknown as { balance_usdt?: number })?.balance_usdt ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </label>
              <input type="number" min={10} step={100} value={params.initial_capital}
                onChange={e => setParams(p => ({ ...p, initial_capital: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none transition" />
            </div>

            {/* Risk per trade */}
            <div>
              <label className="text-xs text-[#848e9c] mb-1.5 block">
                Risk Per Trade: <span className="text-[#f0b90b] font-semibold">{params.risk_per_trade_pct}%</span>
              </label>
              <input type="range" min={0.1} max={10} step={0.1} value={params.risk_per_trade_pct}
                onChange={e => setParams(p => ({ ...p, risk_per_trade_pct: parseFloat(e.target.value) }))}
                className="w-full accent-[#f0b90b]" />
              <div className="flex justify-between text-[10px] text-[#4a5568] mt-1">
                <span>0.1%</span><span>Conservative ← → Aggressive</span><span>10%</span>
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
                <span>1%</span><span>Auto-stop when loss hits this level</span><span>50%</span>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#0b0e11] rounded-xl p-3 text-xs space-y-1.5 border border-[#2b3139]">
              <p className="text-[#848e9c] font-semibold mb-1">Strategy Summary</p>
              <div className="flex justify-between"><span className="text-[#4a5568]">Ticker</span><span className="text-[#f0b90b] font-mono">{params.ticker}</span></div>
              <div className="flex justify-between"><span className="text-[#4a5568]">Route</span><span className="text-[#eaecef] font-medium truncate max-w-[120px]">{routeLabel}</span></div>
              <div className="flex justify-between"><span className="text-[#4a5568]">Capital</span><span className="text-[#eaecef] font-mono">${params.initial_capital.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[#4a5568]">Risk/trade</span><span className="text-[#0ecb81] font-mono">{params.risk_per_trade_pct}% = ${(params.initial_capital * params.risk_per_trade_pct / 100).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#4a5568]">Stop at</span><span className="text-[#f6465d] font-mono">-{params.max_drawdown_pct}%</span></div>
              <div className="flex justify-between"><span className="text-[#4a5568]">Mode</span><span className="text-[#f6465d] font-semibold">LIVE</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Bot control + P&L stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bot control card */}
        <div className="md:col-span-1 bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5">
          <div className="flex flex-col items-center text-center gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              status.running
                ? 'bg-[#0ecb81]/10 border-2 border-[#0ecb81]/40 shadow-lg shadow-[#0ecb81]/10'
                : 'bg-[#2b3139] border-2 border-[#3c4451]'
            }`}>
              <Bot size={32} className={status.running ? 'text-[#0ecb81]' : 'text-[#848e9c]'} />
            </div>

            <div>
              <h2 className="font-semibold text-[#eaecef]">FinAi Trading Bot</h2>
              <p className="text-xs text-[#848e9c] mt-0.5">
                {firstBot ? `${firstBot.ticker} · ${firstBot.mode}` : `${params.ticker} · Live · Grok AI`}
              </p>
            </div>

            {/* Live price ticker */}
            {firstBot && firstBot.current_price > 0 && (
              <div className="w-full bg-[#0b0e11] rounded-xl px-4 py-3 border border-[#2b3139]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#848e9c] uppercase tracking-widest">Live Price</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    firstBot.signal === 'BULLISH' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                    firstBot.signal === 'BEARISH' ? 'bg-[#f6465d]/10 text-[#f6465d]' :
                    'bg-[#2b3139] text-[#848e9c]'
                  }`}>{firstBot.signal}</span>
                </div>
                <p className={`text-2xl font-bold font-mono transition-colors duration-300 ${
                  priceFlash === 'up' ? 'text-[#0ecb81]' :
                  priceFlash === 'down' ? 'text-[#f6465d]' :
                  'text-[#eaecef]'
                }`}>
                  ${firstBot.current_price < 1 ? firstBot.current_price.toFixed(5) : fmt(firstBot.current_price)}
                </p>
                {firstBot.position > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#2b3139] space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Entry</span>
                      <span className="font-mono text-[#eaecef]">${fmt(firstBot.entry_price)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Position</span>
                      <span className="font-mono text-[#f0b90b]">{firstBot.position.toFixed(6)} {firstBot.ticker.replace('-USD','')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Unrealized P&L</span>
                      <span className={`font-mono font-semibold ${firstBot.unrealized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {firstBot.unrealized_pnl >= 0 ? '+' : ''}${fmt(firstBot.unrealized_pnl)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {status.running ? (
              <button onClick={handleStop} disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition">
                <Square size={14}/> Stop All Bots
              </button>
            ) : (
              <button onClick={handleStart} disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#0ecb81] hover:bg-[#0ab56f] disabled:opacity-60 text-black font-semibold py-3 rounded-xl text-sm transition">
                <Play size={14}/> {actionLoading ? 'Starting...' : 'Start Bot'}
              </button>
            )}

            <div className="w-full bg-[#0b0e11] rounded-xl p-3 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Ticker</span>
                <span className="text-[#f0b90b] font-mono font-medium">{firstBot?.ticker ?? params.ticker}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Route</span>
                <span className="text-[#eaecef] font-medium truncate max-w-[130px]">{routeLabel}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Mode</span>
                <span className="text-[#f6465d] font-semibold">LIVE Trading</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Bot Capital</span>
                <span className="text-[#0ecb81] font-mono font-medium">
                  ${firstBot ? fmt(firstBot.balance) : params.initial_capital.toLocaleString()}
                </span>
              </div>
              {firstBot && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#848e9c]">Portfolio</span>
                  <span className="font-mono text-[#eaecef]">${fmt(firstBot.portfolio_value)}</span>
                </div>
              )}
              {firstBot && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#848e9c]">Drawdown</span>
                  <span className={`font-mono ${firstBot.current_drawdown_pct > 5 ? 'text-[#f6465d]' : 'text-[#848e9c]'}`}>
                    -{firstBot.current_drawdown_pct.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            <button onClick={() => setShowSettings(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-[#848e9c] hover:text-[#f0b90b] border border-[#2b3139] hover:border-[#f0b90b]/40 py-2 rounded-xl transition">
              <Settings size={12} /> {showSettings ? 'Hide Settings' : 'Configure Bot'}
            </button>
          </div>
        </div>

        {/* P&L stats grid */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {[
            {
              label: 'Realized P&L',
              value: `${totalPnl >= 0 ? '+' : ''}$${fmt(totalPnl)}`,
              sub: `${pnlTrades.length} closed trades`,
              up: totalPnl >= 0,
              icon: TrendingUp,
            },
            {
              label: 'Unrealized P&L',
              value: totalUnrealized !== 0
                ? `${totalUnrealized >= 0 ? '+' : ''}$${fmt(totalUnrealized)}`
                : status.running ? 'No position' : '—',
              sub: firstBot?.position ? `${firstBot.position.toFixed(6)} ${firstBot.ticker.replace('-USD','')} held` : 'No open position',
              up: totalUnrealized >= 0,
              icon: totalUnrealized >= 0 ? TrendingUp : TrendingDown,
            },
            {
              label: 'Win Rate',
              value: `${winRate}%`,
              sub: `${winningTrades} of ${pnlTrades.length} winning`,
              up: parseFloat(winRate as string) > 50,
              icon: Activity,
            },
            {
              label: 'Portfolio Value',
              value: totalPortfolio > 0 ? `$${fmt(totalPortfolio)}` : status.running ? 'Waiting...' : '—',
              sub: status.running ? 'Bot capital + position value' : 'Start bot to begin',
              up: totalPortfolio >= (firstBot?.balance ?? 0),
              icon: DollarSign,
            },
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

          {/* Live bot signal bar — only when running */}
          {status.running && firstBot && (
            <div className="col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={13} className="text-[#f0b90b]" />
                <span className="text-xs font-semibold text-[#eaecef]">Live Bot Activity</span>
                <span className="ml-auto text-[10px] text-[#848e9c]">updates every 5s</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                {[
                  { label: 'Signal',    val: firstBot.signal,                         color: firstBot.signal === 'BULLISH' ? 'text-[#0ecb81]' : firstBot.signal === 'BEARISH' ? 'text-[#f6465d]' : 'text-[#848e9c]' },
                  { label: 'Trades',    val: String(firstBot.total_trades),            color: 'text-[#eaecef]' },
                  { label: 'Win Rate',  val: `${firstBot.win_rate.toFixed(1)}%`,       color: firstBot.win_rate >= 50 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                  { label: 'Realized',  val: `${firstBot.realized_pnl >= 0 ? '+' : ''}$${fmt(firstBot.realized_pnl)}`, color: firstBot.realized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                  { label: 'Drawdown',  val: `-${firstBot.current_drawdown_pct.toFixed(1)}%`, color: firstBot.current_drawdown_pct > 5 ? 'text-[#f6465d]' : 'text-[#848e9c]' },
                  { label: 'Position',  val: firstBot.position > 0 ? `${firstBot.position.toFixed(4)}` : 'None', color: firstBot.position > 0 ? 'text-[#f0b90b]' : 'text-[#848e9c]' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-[#0b0e11] rounded-lg p-2">
                    <p className="text-[9px] text-[#4a5568] uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-xs font-bold font-mono ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time P&L chart */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[#f0b90b]" />
            <h3 className="text-sm font-semibold text-[#eaecef]">Cumulative P&L (30 days)</h3>
          </div>
          {pnlHistory.length > 0 && (
            <span className={`text-xs font-bold font-mono ${pnlHistory[pnlHistory.length - 1]?.cumulative >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {pnlHistory[pnlHistory.length - 1]?.cumulative >= 0 ? '+' : ''}${pnlHistory[pnlHistory.length - 1]?.cumulative.toFixed(2)}
            </span>
          )}
        </div>
        {pnlHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 gap-2">
            <BarChart2 size={24} className="text-[#2b3139]" />
            <p className="text-xs text-[#848e9c]">No P&L data yet — run bots to see your chart</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pnlHistory} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ecb81" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0ecb81" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pnlGradRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f6465d" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f6465d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
              <XAxis dataKey="date" tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v as number).toFixed(0)}`} width={52} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 10, fontSize: 11 }}
                labelStyle={{ color: '#848e9c' }}
                formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'Cumulative P&L']}
              />
              <ReferenceLine y={0} stroke="#2b3139" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="cumulative"
                stroke={totalPnl >= 0 ? '#0ecb81' : '#f6465d'} strokeWidth={2}
                fill={totalPnl >= 0 ? 'url(#pnlGrad)' : 'url(#pnlGradRed)'}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* AI training notice */}
      <div className="flex items-start gap-3 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-4 py-3">
        <Brain size={16} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#848e9c]">
          <span className="text-[#f0b90b] font-semibold">SMA Momentum Strategy:</span> The bot fetches live prices from Binance every 12 seconds.
          It buys when price crosses above the 6-period SMA and sells on bearish crossover, 4% take-profit, or 3% hard stop-loss.
          All trades are live — no paper mode. P&L updates in real-time every 5 seconds.
        </p>
      </div>

      {/* Live in-memory trades from running bot + DB trades */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#f0b90b]" />
            <h2 className="text-sm font-semibold text-[#eaecef]">Live Trade Log</h2>
            {status.running && (
              <span className="text-[10px] bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 px-2 py-0.5 rounded-full animate-pulse">
                LIVE
              </span>
            )}
          </div>
          <span className="text-xs text-[#848e9c]">
            {firstBot && firstBot.recent_trades.length > 0
              ? `${firstBot.recent_trades.length} bot trades`
              : `${trades.length} total`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                <th className="text-left px-4 py-3 font-medium">Time</th>
                <th className="text-left px-4 py-3 font-medium">Asset</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">P&amp;L</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {/* Prefer in-memory bot trades when running (most fresh), fallback to DB trades */}
              {(() => {
                const botTrades = firstBot?.recent_trades ?? []
                const rows = botTrades.length > 0 ? botTrades : null

                if (loading && !rows) {
                  return <tr><td colSpan={7} className="px-4 py-8 text-center text-[#848e9c] text-sm">Loading...</td></tr>
                }
                if (rows && rows.length > 0) {
                  return rows.map((t, i) => (
                    <tr key={i} className={`border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition ${i === 0 && status.running ? 'bg-[#1e2329]' : ''}`}>
                      <td className="px-4 py-3 text-xs text-[#848e9c] whitespace-nowrap">
                        {new Date(t.time).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-[#f0b90b]">{firstBot?.ticker}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'
                        }`}>{t.action}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">
                        ${t.price < 1 ? t.price.toFixed(5) : fmt(t.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">
                        {t.qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {t.pnl !== null
                          ? <span className={t.pnl >= 0 ? 'text-[#0ecb81] font-semibold' : 'text-[#f6465d] font-semibold'}>
                              {t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}
                            </span>
                          : <span className="text-[#848e9c]">Open</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-[#848e9c]">
                        {(t.reason ?? '').replace(/_/g, ' ')}
                      </td>
                    </tr>
                  ))
                }
                if (trades.length > 0) {
                  return trades.map((t, i) => (
                    <tr key={t.id ?? i} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                      <td className="px-4 py-3 text-xs text-[#848e9c] whitespace-nowrap">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-[#f0b90b]">{t.ticker}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'
                        }`}>{t.action}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">
                        ${t.price < 1 ? t.price.toFixed(5) : fmt(t.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">
                        {t.qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {t.pnl !== null
                          ? <span className={t.pnl >= 0 ? 'text-[#0ecb81] font-semibold' : 'text-[#f6465d] font-semibold'}>
                              {t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}
                            </span>
                          : <span className="text-[#848e9c]">Open</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-[#848e9c]">
                        {(t.reason ?? '').replace(/_/g, ' ')}
                      </td>
                    </tr>
                  ))
                }
                return (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Bot size={28} className="text-[#2b3139]" />
                        <p className="text-sm text-[#848e9c]">No trades yet</p>
                        <p className="text-xs text-[#4a5568]">Bot will trade automatically once price signals trigger</p>
                      </div>
                    </td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
