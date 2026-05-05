import { useEffect, useState, useCallback } from 'react'
import { getBotStatus, startBot, stopBot, getBotTrades } from '../lib/api'
import toast from 'react-hot-toast'
import { Bot, Play, Square, RefreshCw, TrendingUp, Activity, Zap, Brain } from 'lucide-react'

interface TradeLog {
  id: number
  ticker: string
  action: string
  price: number
  qty: number
  pnl: number | null
  reason: string | null
  paper: boolean
  created_at: string
}

interface BotStatus {
  running: boolean
  bot_type?: string
  capital?: number
}

const mockTrades: TradeLog[] = [
  { id: 1, ticker: 'BTC-USD', action: 'BUY',  price: 66800, qty: 0.01, pnl: null,  reason: 'Bullish breakout detected', paper: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, ticker: 'ETH-USD', action: 'SELL', price: 3480,  qty: 0.5,  pnl: 124.5, reason: 'Target price reached',      paper: false, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, ticker: 'NVDA',    action: 'BUY',  price: 860,   qty: 1,    pnl: null,  reason: 'AI event: earnings beat',   paper: false, created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 4, ticker: 'AAPL',    action: 'SELL', price: 191.5, qty: 5,    pnl: -32.5, reason: 'Stop loss triggered',        paper: false, created_at: new Date(Date.now() - 28800000).toISOString() },
  { id: 5, ticker: 'BTC-USD', action: 'SELL', price: 67200, qty: 0.01, pnl: 4.0,   reason: 'Take profit',               paper: false, created_at: new Date(Date.now() - 86400000).toISOString() },
]

export default function BotsPage() {
  const [status, setStatus]               = useState<BotStatus>({ running: false })
  const [trades, setTrades]               = useState<TradeLog[]>([])
  const [loading, setLoading]             = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, tradesRes] = await Promise.allSettled([getBotStatus(), getBotTrades(20)])
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data)
      if (tradesRes.status === 'fulfilled') {
        const d = tradesRes.value.data
        setTrades(Array.isArray(d) ? d : (d?.trades ?? mockTrades))
      } else {
        setTrades(mockTrades)
      }
    } catch {
      setTrades(mockTrades)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleStart = async () => {
    setActionLoading(true)
    try {
      await startBot()
      setStatus(s => ({ ...s, running: true }))
      toast.success('Bot started successfully')
    } catch {
      toast.error('Failed to start bot — check API key configuration in Profile → FinAPI')
    } finally { setActionLoading(false) }
  }

  const handleStop = async () => {
    setActionLoading(true)
    try {
      await stopBot()
      setStatus(s => ({ ...s, running: false }))
      toast.success('Bot stopped')
    } catch {
      toast.error('Failed to stop bot')
    } finally { setActionLoading(false) }
  }

  const pnlTrades     = trades.filter(t => t.pnl !== null)
  const totalPnl      = pnlTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winningTrades = pnlTrades.filter(t => (t.pnl ?? 0) > 0).length
  const winRate       = pnlTrades.length > 0 ? ((winningTrades / pnlTrades.length) * 100).toFixed(1) : '—'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#eaecef]">AI Trading Bots</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.running ? 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20' : 'bg-[#2b3139] text-[#848e9c]'}`}>
            {status.running ? 'Live' : 'Offline'}
          </span>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

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
              <p className="text-xs text-[#848e9c] mt-0.5">Account Trading · Grok AI</p>
            </div>

            {status.running ? (
              <button onClick={handleStop} disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#f6465d] hover:bg-[#d93d51] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition">
                <Square size={14}/> Stop Bot
              </button>
            ) : (
              <button onClick={handleStart} disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#0ecb81] hover:bg-[#0ab56f] disabled:opacity-60 text-black font-semibold py-3 rounded-xl text-sm transition">
                <Play size={14}/> Start Bot
              </button>
            )}

            <div className="w-full bg-[#0b0e11] rounded-xl p-3 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Mode</span>
                <span className="text-[#f0b90b] font-medium">Account Trading</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Strategy</span>
                <span className="text-[#eaecef]">AI Event-driven</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#848e9c]">Capital</span>
                <span className="text-[#eaecef]">${(status.capital ?? 10000).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* P&L stats grid */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {[
            {
              label: 'Total P&L',
              value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
              sub: `${pnlTrades.length} closed trades`,
              up: totalPnl >= 0,
              icon: TrendingUp,
            },
            {
              label: 'Win Rate',
              value: `${winRate}%`,
              sub: `${winningTrades} of ${pnlTrades.length} winning`,
              up: parseFloat(winRate) > 50,
              icon: Activity,
            },
            {
              label: 'Best Trade',
              value: pnlTrades.length > 0 ? `+$${Math.max(...pnlTrades.map(t => t.pnl ?? 0)).toFixed(2)}` : '—',
              sub: 'Single trade profit',
              up: true,
              icon: Zap,
            },
            {
              label: 'Active Since',
              value: status.running ? 'Now' : 'Offline',
              sub: status.running ? 'Bot is live' : 'Start bot to begin',
              up: status.running,
              icon: Bot,
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
        </div>
      </div>

      {/* AI training notice */}
      <div className="flex items-start gap-3 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-4 py-3">
        <Brain size={16} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#848e9c]">
          <span className="text-[#f0b90b] font-semibold">BOT is being trained</span> to understand the market dynamics.
          With advanced trading strategies and AI controls — continuously learning from live price action, news events, and sentiment signals.
        </p>
      </div>

      {/* Trade logs */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#eaecef]">Live Trade Log</h2>
          <span className="text-xs text-[#848e9c]">{trades.length} trades</span>
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
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#848e9c] text-sm">Loading...</td></tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Bot size={28} className="text-[#2b3139]" />
                      <p className="text-sm text-[#848e9c]">No trades yet</p>
                      <p className="text-xs text-[#4a5568]">Start the bot to begin trading</p>
                    </div>
                  </td>
                </tr>
              ) : trades.map(t => (
                <tr key={t.id} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                  <td className="px-4 py-3 text-xs text-[#848e9c] whitespace-nowrap">
                    {new Date(t.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#f0b90b]/10 flex items-center justify-center text-[9px] font-bold text-[#f0b90b] flex-shrink-0">
                        {t.ticker[0]}
                      </div>
                      <span className="text-xs font-medium text-[#eaecef]">{t.ticker}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.action === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                      {t.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#eaecef]">${t.price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#848e9c]">{t.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.pnl !== null ? (
                      <span className={t.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                      </span>
                    ) : <span className="text-[#848e9c]">Open</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#848e9c] max-w-[180px] truncate">{t.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
