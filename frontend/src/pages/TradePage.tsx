import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ArrowUpDown, TrendingUp, ChevronDown, ChevronUp,
  Wifi, WifiOff, Link2, Clock, CheckCircle2, 
  Target, AlertTriangle, ArrowRight, Zap, Minus, Plus,
  MessageSquare, Tv, Bot, Settings, BarChart2, Maximize2, X,
  SlidersHorizontal, Loader2, Sparkles, Lock, Crown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { executeTrade, getBotTrades, getOpenPositions } from '../lib/api'

const PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT',
  'LINK/USDT', 'DOT/USDT', 'UNI/USDT', 'MATIC/USDT',
  'LTC/USDT', 'XLM/USDT',
  'XAU/USD', 'XAG/USD', 'OIL/WTI',
  'AAPL', 'TSLA', 'NVDA', 'MSFT', 'SPY',
]

const TV_SYMBOLS: Record<string, string> = {
  'BTC/USDT':  'BINANCE:BTCUSDT',
  'ETH/USDT':  'BINANCE:ETHUSDT',
  'BNB/USDT':  'BINANCE:BNBUSDT',
  'SOL/USDT':  'BINANCE:SOLUSDT',
  'XRP/USDT':  'BINANCE:XRPUSDT',
  'DOGE/USDT': 'BINANCE:DOGEUSDT',
  'ADA/USDT':  'BINANCE:ADAUSDT',
  'AVAX/USDT': 'BINANCE:AVAXUSDT',
  'LINK/USDT': 'BINANCE:LINKUSDT',
  'DOT/USDT':  'BINANCE:DOTUSDT',
  'UNI/USDT':  'BINANCE:UNIUSDT',
  'MATIC/USDT':'BINANCE:MATICUSDT',
  'LTC/USDT':  'BINANCE:LTCUSDT',
  'XLM/USDT':  'BINANCE:XLMUSDT',
  'XAU/USD':   'TVC:GOLD',
  'XAG/USD':   'TVC:SILVER',
  'OIL/WTI':   'TVC:USOIL',
  'AAPL':      'NASDAQ:AAPL',
  'TSLA':      'NASDAQ:TSLA',
  'NVDA':      'NASDAQ:NVDA',
  'MSFT':      'NASDAQ:MSFT',
  'SPY':       'AMEX:SPY',
}

const FALLBACKS: Record<string, { price: number; change: number }> = {
  'BTC/USDT':   { price: 97000, change: 2.4  },
  'ETH/USDT':   { price: 3200,  change: 1.8  },
  'BNB/USDT':   { price: 628,   change: 0.9  },
  'SOL/USDT':   { price: 155,   change: 1.2  },
  'XRP/USDT':   { price: 0.52,  change: 0.7  },
  'DOGE/USDT':  { price: 0.12,  change: 1.1  },
  'ADA/USDT':   { price: 0.45,  change: 0.5  },
  'AVAX/USDT':  { price: 38,    change: 1.4  },
  'LINK/USDT':  { price: 14,    change: 0.8  },
  'DOT/USDT':   { price: 7.2,   change: 0.6  },
  'UNI/USDT':   { price: 8.5,   change: 1.0  },
  'MATIC/USDT': { price: 0.90,  change: 0.4  },
  'LTC/USDT':   { price: 85,    change: 0.3  },
  'XLM/USDT':   { price: 0.11,  change: 0.2  },
  'XAU/USD':    { price: 3290,  change: 0.5  },
  'XAG/USD':    { price: 32.80, change: 0.4  },
  'OIL/WTI':    { price: 78.40, change: -0.3 },
  'AAPL':       { price: 195,   change: 0.6  },
  'TSLA':       { price: 175,   change: 1.2  },
  'NVDA':       { price: 875,   change: 1.8  },
  'MSFT':       { price: 415,   change: 0.7  },
  'SPY':        { price: 526,   change: 0.4  },
}

const LEVERAGE_STEPS = [1, 2, 5, 10, 20, 50, 100, 125]

const TV_STYLES: { value: string; label: string }[] = [
  { value: '1', label: 'Candlestick' },
  { value: '2', label: 'Line' },
  { value: '3', label: 'Mountain / Area' },
  { value: '8', label: 'Heikin-Ashi' },
  { value: '9', label: 'Hollow Candles' },
]

// ── WebSocket live-balance hook ──────────────────────────────────────────────
function useWsBalance(token: string | null) {
  const [balance, setBalance]   = useState<number | null>(null)
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
            if (d.type === 'balance' && typeof d.balance_usdt === 'number')
              setBalance(d.balance_usdt)
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    connect()
    return () => { alive = false; wsRef.current?.close() }
  }, [token])

  return { balance, connected }
}

// ── Live price hook (polls /api/public/prices every 8s) ──────────────────────
function useTradeLivePrice(pair: string) {
  const cryptoMap: Record<string, string> = {
    'BTC/USDT': 'bitcoin', 'ETH/USDT': 'ethereum', 'BNB/USDT': 'binancecoin',
    'SOL/USDT': 'solana',  'XRP/USDT': 'ripple',   'DOGE/USDT': 'dogecoin',
    'ADA/USDT': 'cardano', 'AVAX/USDT': 'avalanche-2', 'LINK/USDT': 'chainlink',
    'DOT/USDT': 'polkadot','UNI/USDT': 'uniswap',  'MATIC/USDT': 'matic-network',
    'LTC/USDT': 'litecoin','XLM/USDT': 'stellar',
  }
  const metalsMap: Record<string, string> = { 'XAU/USD': 'gold', 'XAG/USD': 'silver' }

  const [data, setData] = useState<{ price: number; change: number; live: boolean }>({
    ...FALLBACKS[pair] ?? { price: 100, change: 0 }, live: false,
  })
  const pairRef = useRef(pair)
  pairRef.current = pair

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/public/prices')
      if (!res.ok) return
      const json = await res.json()
      const p = pairRef.current
      if (cryptoMap[p] && json[cryptoMap[p]])
        setData({ price: json[cryptoMap[p]].usd, change: json[cryptoMap[p]].usd_24h_change, live: true })
      else if (metalsMap[p] && json.metals?.[metalsMap[p]])
        setData({ price: json.metals[metalsMap[p]].usd, change: json.metals[metalsMap[p]].usd_24h_change, live: true })
      else if (p === 'OIL/WTI' && json.metals?.oil_wti)
        setData({ price: json.metals.oil_wti.usd, change: json.metals.oil_wti.usd_24h_change, live: true })
      else if (json.stocks?.[p])
        setData({ price: json.stocks[p].usd, change: json.stocks[p].usd_24h_change, live: true })
    } catch { /* keep previous */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setData({ ...FALLBACKS[pair] ?? { price: 100, change: 0 }, live: false })
    fetch_()
  }, [pair, fetch_])
  useEffect(() => { const id = setInterval(fetch_, 8000); return () => clearInterval(id) }, [fetch_])
  return data
}

function makeOrderBook(base: number) {
  return {
    asks: Array.from({ length: 5 }, (_, i) => ({ price: base + (i+1)*(base*0.00012), size: +(Math.random()*2).toFixed(4) })),
    bids: Array.from({ length: 5 }, (_, i) => ({ price: base - i*(base*0.00012),     size: +(Math.random()*2).toFixed(4) })),
  }
}

interface ExchangeConn { exchange: string; label: string; api_key_masked: string }
interface TradeRecord  { id: number; ticker: string; action: string; price: number; qty: number; pnl: number | null; exchange: string; paper: boolean; created_at: string }
interface OpenPosition {
  id: number
  ticker: string
  side: string         // "LONG" | "SHORT"
  action: string       // "BUY" | "SELL"
  price: number
  qty: number
  lot_size: number
  contract_size: number
  leverage: number
  margin: number
  exchange: string
  exchange_label?: string
  broker_order_id?: string
  broker_error?: string
  stop_loss?: number
  take_profit?: number
  paper: boolean
  created_at: string
  current_price: number
  unrealized_pnl: number
  pnl_pct: number
  is_liquidated?: boolean
}

// ── FinChat panel ─────────────────────────────────────────────────────────────
// ── FinChatPanel types ────────────────────────────────────────────────────────
interface TradeSugg {
  side: 'buy' | 'sell'
  entry: number
  sl?: number
  tp?: number
  conf: number
}
interface FinMsg {
  id: string
  role: 'user' | 'ai'
  text: string
  suggestion?: TradeSugg
}

function extractPrice(text: string, patterns: RegExp[]): number | undefined {
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return parseFloat(m[1].replace(/,/g, ''))
  }
  return undefined
}

function parseTradeSuggestion(text: string, livePrice: number): TradeSugg | null {
  const hasBuy  = /\b(buy|long|bullish|go long)\b/i.test(text)
  const hasSell = /\b(sell|short|bearish|go short)\b/i.test(text)
  const hasEntry = /entry|enter|stop.loss|take.profit|\bsl\b|\btp\b|target/i.test(text)
  if ((!hasBuy && !hasSell) || !hasEntry) return null
  const side: 'buy' | 'sell' = hasBuy ? 'buy' : 'sell'
  const entry = extractPrice(text, [
    /entry\s*(?:zone|price|point)?[:\s]+\$?([\d,]+\.?\d*)/i,
    /enter\s*(?:at|around|near)?[:\s]+\$?([\d,]+\.?\d*)/i,
    /(?:buy|sell)\s+(?:at|@|around|near)\s+\$?([\d,]+\.?\d*)/i,
  ]) ?? livePrice
  const sl = extractPrice(text, [
    /stop[- ]loss[:\s]+\$?([\d,]+\.?\d*)/i,
    /\bsl[:\s]+\$?([\d,]+\.?\d*)/i,
    /stop[:\s]+\$?([\d,]+\.?\d*)/i,
  ])
  const tp = extractPrice(text, [
    /take[- ]profit\s*(?:\d)?[:\s]+\$?([\d,]+\.?\d*)/i,
    /\btp\s*(?:\d)?[:\s]+\$?([\d,]+\.?\d*)/i,
    /target\s*(?:\d)?[:\s]+\$?([\d,]+\.?\d*)/i,
  ])
  const confMatch = /(\d{2,3})\s*%\s*conf/i.exec(text)
  const conf = confMatch ? parseInt(confMatch[1]) : 72
  return { side, entry, sl, tp, conf }
}

function FinChatPanel({ pair, livePrice, liveChange, collapsed, onToggle, usingBalance, selExchange }: {
  pair: string; livePrice: number; liveChange: number; collapsed: boolean
  onToggle: () => void; usingBalance: boolean; selExchange: string
}) {
  const navigate = useNavigate()
  const isUp = liveChange >= 0
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<FinMsg[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [execId, setExecId] = useState<string | null>(null)
  const [chatLot, setChatLot]       = useState('0.01')
  const [chatLevIdx, setChatLevIdx] = useState(0)
  const chatLeverage = LEVERAGE_STEPS[chatLevIdx]
  const chatEndRef = useRef<HTMLDivElement>(null)
  const bodyRef    = useRef<HTMLDivElement>(null)
  const [bodyHeight, setBodyHeight] = useState(0)
  const { token, user } = useAuthStore()
  const isSubscriber = (user?.account_tier ?? 0) >= 1 || !!(user?.subscription && user.subscription !== 'free')
  const today        = new Date().toDateString()
  const freeKey      = `finai-free-chat-${pair.replace(/\//g, '-')}-${today}`
  const [freeUsed, setFreeUsed] = useState(() => parseInt(localStorage.getItem(freeKey) || '0'))
  const canSend = isSubscriber || freeUsed < 1

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, aiLoading])
  useEffect(() => {
    if (!collapsed && bodyRef.current) setBodyHeight(bodyRef.current.scrollHeight)
  })

  // Reset messages when pair changes
  useEffect(() => { setMessages([]) }, [pair])

  const callAI = async (userText: string) => {
    if (aiLoading || !canSend) return
    const userMsg: FinMsg = { id: `u-${Date.now()}`, role: 'user', text: userText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message:    userText,
          pair:       pair,
          price:      livePrice || undefined,
          change_24h: liveChange || undefined,
        }),
      })
      const data = await res.json()
      const replyText: string = data.reply ?? 'Fin is unavailable right now.'
      const suggestion = livePrice > 0 ? parseTradeSuggestion(replyText, livePrice) : null
      const aiMsg: FinMsg = { id: `a-${Date.now()}`, role: 'ai', text: replyText, suggestion: suggestion ?? undefined }
      setMessages(prev => [...prev, aiMsg])
      // Track free usage
      if (!isSubscriber) {
        const used = freeUsed + 1
        localStorage.setItem(freeKey, String(used))
        setFreeUsed(used)
      }
    } catch {
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'ai', text: 'Connection error — please try again.' }])
    } finally {
      setAiLoading(false)
    }
  }

  const handleSend = () => { const t = input.trim(); if (t && canSend) callAI(t) }

  const handleSuggestTrade = () => {
    const prompt = `Suggest a trade for ${pair} right now at $${livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}. Give me a clear BUY or SELL direction with entry price, stop-loss, and take-profit levels.`
    callAI(prompt)
  }

  const handleExecute = async (sugg: TradeSugg, msgId: string) => {
    const lotQty = parseFloat(chatLot) || 0.01
    setExecId(msgId)
    try {
      const res = await executeTrade({
        pair,
        side:           sugg.side,
        order_type:     'market',
        price:          livePrice || sugg.entry,
        amount:         lotQty,
        paper:          false,
        exchange_label: usingBalance ? undefined : selExchange,
        stop_loss:      sugg.sl,
        take_profit:    sugg.tp,
        leverage:       chatLeverage > 1 ? chatLeverage : undefined,
        lot_size:       lotQty,
      })
      const d = res.data
      toast.success(
        `${sugg.side === 'buy' ? '📈 Buy' : '📉 Sell'} order placed for ${pair}!`,
        { duration: 4000 }
      )
      if (d?.trade?.new_balance !== undefined) {
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          balance_usdt: d.trade.new_balance,
        })
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Order failed'
      )
    } finally {
      setExecId(null)
    }
  }

  return (
    <div className="bg-[#161a1e] sm:rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] flex-shrink-0">
        <div className="w-6 h-6 rounded-lg bg-[#f0b90b]/15 flex items-center justify-center">
          <Bot size={12} className="text-[#f0b90b]" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#eaecef] leading-none">Fin AI</p>
          <p className="text-[9px] text-[#848e9c] leading-none mt-0.5">Trade assistant · powered by FinAi</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
          <span className="text-[10px] text-[#0ecb81]">Live</span>
        </div>
        <button
          onClick={onToggle}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#f6465d]/10 text-[#848e9c] hover:text-[#f6465d] transition group"
          title="Close Fin AI"
        >
          <X size={11} />
          <span className="text-[9px] font-semibold hidden group-hover:inline">close</span>
        </button>
      </div>

      {/* Collapsible body */}
      <div
        ref={bodyRef}
        style={{
          maxHeight: collapsed ? 0 : (bodyHeight > 0 ? bodyHeight : 640),
          opacity:   collapsed ? 0 : 1,
          overflow:  'hidden',
          transition: 'max-height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
        }}
      >
        {/* Pair context bar */}
        <div className="px-4 py-2 bg-[#0b0e11]/50 border-b border-[#2b3139]/60 flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-[#f0b90b]">{pair}</span>
          <span className="text-[10px] text-[#848e9c]">·</span>
          <span className="text-[10px] text-[#eaecef] font-medium">
            ${livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
          </span>
          <span className={`text-[10px] font-semibold ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {isUp ? '+' : ''}{liveChange.toFixed(2)}%
          </span>
          <button
            onClick={handleSuggestTrade}
            disabled={aiLoading || livePrice <= 0}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f0b90b]/10 border border-[#f0b90b]/25 text-[#f0b90b] hover:bg-[#f0b90b]/20 transition text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles size={10} />
            Suggest trade
          </button>
        </div>

        {/* Lot size + Leverage controls */}
        <div className="px-3 py-2 bg-[#0b0e11]/30 border-b border-[#2b3139]/50 flex items-center gap-3 flex-shrink-0">
          {/* Lot size */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[#848e9c] font-medium">Lot</span>
            <button
              type="button"
              onClick={() => { const n = Math.max(0.01, parseFloat(chatLot || '0.01') - 0.01); setChatLot(n.toFixed(2)) }}
              className="w-5 h-5 rounded bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] hover:bg-[#3a424e] transition"
            ><Minus size={8} /></button>
            <input
              type="number"
              value={chatLot}
              onChange={e => setChatLot(e.target.value)}
              onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) setChatLot(Math.min(100, Math.max(0.01, n)).toFixed(2)) }}
              className="w-14 bg-[#1e2329] border border-[#2b3139] focus:border-[#f0b90b]/40 rounded px-1.5 py-0.5 text-[10px] font-mono text-[#f0b90b] text-center focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { const n = Math.min(100, parseFloat(chatLot || '0.01') + 0.01); setChatLot(n.toFixed(2)) }}
              className="w-5 h-5 rounded bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] hover:bg-[#3a424e] transition"
            ><Plus size={8} /></button>
          </div>

          {/* Divider */}
          <span className="text-[#2b3139]">|</span>

          {/* Leverage */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[#848e9c] font-medium">Lev</span>
            <button
              type="button"
              onClick={() => setChatLevIdx(i => Math.max(0, i - 1))}
              className="w-5 h-5 rounded bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] hover:bg-[#3a424e] transition"
            ><Minus size={8} /></button>
            <span className="w-10 text-center text-[10px] font-bold font-mono text-[#f0b90b]">{chatLeverage}x</span>
            <button
              type="button"
              onClick={() => setChatLevIdx(i => Math.min(LEVERAGE_STEPS.length - 1, i + 1))}
              className="w-5 h-5 rounded bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] hover:bg-[#3a424e] transition"
            ><Plus size={8} /></button>
          </div>

          {/* Exchange badge */}
          <span className="ml-auto text-[9px] text-[#848e9c] truncate max-w-[80px]">
            {usingBalance ? 'Platform Bal.' : selExchange}
          </span>
        </div>

        {/* Messages */}
        <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: 360 }}>
          {messages.length === 0 && !aiLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-[#f0b90b]/10 flex items-center justify-center">
                <Bot size={20} className="text-[#f0b90b]" />
              </div>
              <p className="text-xs font-semibold text-[#eaecef]">Ask Fin about {pair}</p>
              <p className="text-[10px] text-[#848e9c] max-w-[220px]">
                Click <span className="text-[#f0b90b] font-semibold">Suggest trade</span> for an AI trade idea, or type any question below.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                /* User bubble */
                <div className="flex justify-end">
                  <div className="bg-[#f0b90b]/10 border border-[#f0b90b]/20 rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                    <p className="text-[11px] text-[#eaecef] leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ) : (
                /* AI bubble */
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={10} className="text-[#f0b90b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-[#f0b90b]">Fin</span>
                    <p className="text-[11px] text-[#848e9c] leading-relaxed mt-0.5 whitespace-pre-wrap">{msg.text}</p>

                    {/* Trade suggestion card */}
                    {msg.suggestion && (
                      <div className={`mt-2 rounded-xl border px-3 py-2.5 ${
                        msg.suggestion.side === 'buy'
                          ? 'bg-[#0ecb81]/5 border-[#0ecb81]/25'
                          : 'bg-[#f6465d]/5 border-[#f6465d]/25'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-bold tracking-wide ${
                            msg.suggestion.side === 'buy' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                          }`}>
                            {msg.suggestion.side === 'buy' ? '📈 BUY' : '📉 SELL'} SIGNAL · {pair}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1 bg-[#2b3139] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${msg.suggestion.side === 'buy' ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}
                                style={{ width: `${msg.suggestion.conf}%` }}
                              />
                            </div>
                            <span className={`text-[9px] font-bold ${msg.suggestion.side === 'buy' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {msg.suggestion.conf}%
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2.5">
                          <div>
                            <p className="text-[9px] text-[#848e9c] mb-0.5">Entry</p>
                            <p className="text-[10px] font-semibold text-[#eaecef]">
                              ${msg.suggestion.entry.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                            </p>
                          </div>
                          {msg.suggestion.sl && (
                            <div>
                              <p className="text-[9px] text-[#848e9c] mb-0.5">Stop-Loss</p>
                              <p className="text-[10px] font-semibold text-[#f6465d]">
                                ${msg.suggestion.sl.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                              </p>
                            </div>
                          )}
                          {msg.suggestion.tp && (
                            <div>
                              <p className="text-[9px] text-[#848e9c] mb-0.5">Take-Profit</p>
                              <p className="text-[10px] font-semibold text-[#0ecb81]">
                                ${msg.suggestion.tp.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                              </p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleExecute(msg.suggestion!, msg.id)}
                          disabled={execId === msg.id}
                          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                            msg.suggestion.side === 'buy'
                              ? 'bg-[#0ecb81] hover:bg-[#0ecb81]/90 text-[#0b0e11]'
                              : 'bg-[#f6465d] hover:bg-[#f6465d]/90 text-white'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {execId === msg.id
                            ? <><Loader2 size={11} className="animate-spin" /> Placing order…</>
                            : <>{msg.suggestion.side === 'buy' ? '📈 Execute Buy' : '📉 Execute Sell'} · {pair}</>
                          }
                        </button>
                        <p className="text-[9px] text-[#848e9c] text-center mt-1.5">
                          {chatLot} lot{chatLeverage > 1 ? ` · ${chatLeverage}x` : ''} · {usingBalance ? 'Platform Balance' : selExchange} · market
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* AI typing indicator */}
          {aiLoading && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={10} className="text-[#f0b90b]" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2329] border border-[#2b3139] rounded-xl rounded-tl-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f0b90b] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#f0b90b] animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#f0b90b] animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Paywall banner for free users who have used their 1 daily message */}
        {!isSubscriber && freeUsed >= 1 && (
          <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-[#f0b90b]/8 border border-[#f0b90b]/25 flex items-center gap-3">
            <Lock size={14} className="text-[#f0b90b] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#f0b90b]">Free limit reached</p>
              <p className="text-[10px] text-[#848e9c]">1 AI message per day per pair on the free plan</p>
            </div>
            <button
              onClick={() => navigate('/app/pricing')}
              className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-black bg-[#f0b90b] hover:bg-[#d4a30a] px-2.5 py-1 rounded-lg transition"
            >
              <Crown size={9} /> Upgrade
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="px-3 py-3 border-t border-[#2b3139] flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={canSend ? `Ask Fin about ${pair}…` : 'Upgrade to continue chatting'}
              disabled={aiLoading || !canSend}
              className="flex-1 bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b]/40 rounded-lg px-3 py-2 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none transition disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={aiLoading || !input.trim() || !canSend}
              className="px-3 py-2 rounded-lg bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-[#f0b90b] hover:bg-[#f0b90b]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main TradePage ────────────────────────────────────────────────────────────
export default function TradePage() {
  const { user, token } = useAuthStore()
  
  // Order form state
  const [side, setSide]             = useState<'buy' | 'sell'>('buy')
  const [orderType, setType]        = useState<'market' | 'limit'>('limit')
  const [price, setPrice]           = useState('')
  const [amount, setAmount]         = useState('')
  const [stopLoss, setStopLoss]     = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [leverageIdx, setLeverageIdx] = useState(() => {
    const savedLev = useAuthStore.getState().user?.trade_leverage ?? 1
    const idx = LEVERAGE_STEPS.findIndex(s => s >= savedLev)
    return idx >= 0 ? idx : 0
  })
  const [lotSize, setLotSize]       = useState('0.01')

  // Chart / UI state
  const [tvStyle, setTvStyle]       = useState(() => localStorage.getItem('finai-tv-style') || '1')
  const [tvInterval, setTvInterval] = useState(() => localStorage.getItem('finai-tv-interval') || '60')
  const [tvTopBar,   setTvTopBar]   = useState(() => localStorage.getItem('finai-tv-topbar')   === 'true')
  const [tvSideBar,  setTvSideBar]  = useState(() => localStorage.getItem('finai-tv-sidebar')  === 'true')
  const [tvLegend,   setTvLegend]   = useState(() => localStorage.getItem('finai-tv-legend')   === 'true')
  const [tvDateRng,  setTvDateRng]  = useState(() => localStorage.getItem('finai-tv-daterng')  === 'true')
  const [tvTheme,    setTvTheme]    = useState<'dark'|'light'>(() =>
    localStorage.getItem('finai-theme') === 'light' ? 'light' : 'dark'
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTvTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const [showPrefs, setShowPrefs]   = useState(false)
  const [showTvSettings, setShowTvSettings] = useState(false)  // pair-header TV settings popup
  const tvSettingsRef = useRef<HTMLDivElement>(null)
  const [pair, setPair]             = useState('BTC/USDT')
  const [showPairs, setShowP]       = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(() => localStorage.getItem('finai-chat') === 'true')
  const [selExchange, setSelExch]   = useState<string>('__balance__')
  const [showOrderBook, setShowOrderBook] = useState(() => localStorage.getItem('finai-orderbook') !== 'false')
  const [showBuySell, setShowBuySell] = useState(() => localStorage.getItem('finai-buy-sell') !== 'false')
  const [showEntryLines, setShowEntryLines] = useState(() => localStorage.getItem('finai-entry-lines') !== 'false')
  const [orderFormCollapsed, setOrderFormCollapsed] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(() => localStorage.getItem('finai-order-form') === 'true')
  const [chartCollapsed, setChartCollapsed] = useState(() => localStorage.getItem('finai-chart-collapsed') === 'true')
  const [chartTab, setChartTab]     = useState<'chart' | 'orderbook' | 'trades' | 'info'>('chart')

  // Data state
  const [orderLoading, setLoading]  = useState(false)
  const [tradeHistory, setHistory]  = useState<TradeRecord[]>([])
  const [openPositions, setOpenPos] = useState<OpenPosition[]>([])
  const leverage = LEVERAGE_STEPS[leverageIdx]
  const navigate = useNavigate()

  // WebSocket live balance
  const { balance: wsBalance, connected: wsConnected } = useWsBalance(token)

  const exchanges: ExchangeConn[] =
    (user as unknown as { exchange_connections?: ExchangeConn[] })?.exchange_connections ?? []

  useEffect(() => {
    if (exchanges.length > 0 && selExchange === '__balance__') setSelExch(exchanges[0].label)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges.length])

  const fetchHistory = useCallback(async () => {
    try {
      const [posRes, tradesRes] = await Promise.allSettled([
        getOpenPositions(),
        getBotTrades(50),
      ])
      const trades: TradeRecord[] = tradesRes.status === 'fulfilled' ? (tradesRes.value.data?.trades ?? []) : []
      setHistory(trades)
      const positions: OpenPosition[] = posRes.status === 'fulfilled' ? (posRes.value.data?.positions ?? []) : []
      setOpenPos(positions)
    } catch { /* silently ignore */ }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const unrealizedPnl = useMemo(() => openPositions.reduce((s,p) => s + (p.unrealized_pnl??0), 0), [openPositions])
  const realizedPnl   = useMemo(() => tradeHistory.filter(t => t.pnl !== null).reduce((s,t) => s + (t.pnl ?? 0), 0), [tradeHistory])
  void realizedPnl
  const totalPositionValue = useMemo(() => openPositions.reduce((s,p) => s + (p.qty * (p.current_price || p.price)), 0), [openPositions])

  const { price: livePrice, change: liveChange, live: isLive } = useTradeLivePrice(pair)
  const orderBook = makeOrderBook(livePrice)

  const prevPair      = useRef(pair)
  const priceInitRef  = useRef(false)
  const userEditedRef = useRef(false)
  const prefsRef      = useRef<HTMLDivElement>(null)
  const [chartExpanded, setChartExpanded] = useState(false)

  useEffect(() => {
    const pairChanged = prevPair.current !== pair
    if (pairChanged) { userEditedRef.current = false; priceInitRef.current = false; prevPair.current = pair }
    if (livePrice > 0 && (!priceInitRef.current || orderType === 'market' || !userEditedRef.current)) {
      setPrice(livePrice.toFixed(2)); priceInitRef.current = true
    }
  }, [pair, livePrice, orderType])

  // Close prefs dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (prefsRef.current && !prefsRef.current.contains(e.target as Node)) setShowPrefs(false)
      if (tvSettingsRef.current && !tvSettingsRef.current.contains(e.target as Node)) setShowTvSettings(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const userBalance = user?.balance_usdt ?? 0
  // Use WebSocket balance if available, otherwise fall back to Zustand user balance
  const liveBalance  = wsBalance ?? userBalance
  const asset        = pair.split('/')[0]
  const numPrice     = parseFloat(price.replace(/,/g, '')) || 0
  const qty          = parseFloat(amount) || 0
  const orderNotional = numPrice && qty ? numPrice * qty : 0
  const orderTotal    = leverage > 1 ? orderNotional / leverage : orderNotional  // margin deducted
  const high24       = livePrice > 0 ? (livePrice * 1.022).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'
  const low24        = livePrice > 0 ? (livePrice * 0.978).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'
  const availCrypto  = livePrice > 0 ? liveBalance / livePrice : 0
  const usingBalance = selExchange === '__balance__'
  const selectedConn = exchanges.find(e => e.label === selExchange)

  // P&L ticker: live balance vs stored user balance

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (orderLoading) return
    if (!qty || qty <= 0)           return toast.error('Enter a valid amount')
    if (!numPrice || numPrice <= 0) return toast.error('Price must be greater than 0')
    if (usingBalance && side === 'buy' && orderTotal > liveBalance)
      return toast.error(`Insufficient balance. Need $${orderTotal.toFixed(2)} USDT margin (${leverage}x leverage).`)
    setLoading(true)
    try {
      const res = await executeTrade({ pair, side, order_type: orderType, price: numPrice, amount: qty, paper: false,
        exchange_label: usingBalance ? undefined : selExchange,
        stop_loss:   stopLoss   ? parseFloat(stopLoss)   : undefined,
        take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
        leverage:    leverage > 1 ? leverage : undefined,
        lot_size:    lotSize   ? parseFloat(lotSize)     : undefined,
      })
      const d = res.data
      const exLabel = usingBalance ? 'Platform Balance' : selectedConn?.exchange?.toUpperCase() ?? selExchange
      toast.success(side === 'buy'
        ? `Buy ${qty} ${asset} @ $${numPrice.toLocaleString()} via ${exLabel} — Filled`
        : `Sell ${qty} ${asset} @ $${numPrice.toLocaleString()} via ${exLabel} — Filled`,
        { duration: 4000 })
      if (d?.exchange_error) toast.error(`Exchange error: ${d.exchange_error}`, { duration: 7000 })
      if (d?.trade?.new_balance !== undefined) {
        useAuthStore.getState().setUser({ ...useAuthStore.getState().user!, balance_usdt: d.trade.new_balance })
      }
      setAmount(''); setStopLoss(''); setTakeProfit(''); setLeverageIdx(0); setLotSize('0.01')
      fetchHistory()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Order failed')
    } finally { setLoading(false) }
  }

  const handleQuickTrade = async (quickSide: 'buy' | 'sell') => {
    if (orderLoading) return
    const ls = parseFloat(lotSize) || 0.01
    if (ls <= 0) return toast.error('Enter a valid lot size')
    if (!livePrice) return toast.error('Price not available')
    setLoading(true)
    try {
      const res = await executeTrade({
        pair, side: quickSide, order_type: 'market', price: livePrice, amount: ls, paper: false,
        exchange_label: usingBalance ? undefined : selExchange,
        leverage: leverage > 1 ? leverage : undefined,
        lot_size: ls,
      })
      const d = res.data
      const exLabel = usingBalance ? 'Balance' : selectedConn?.exchange?.toUpperCase() ?? selExchange
      toast.success(`${quickSide === 'buy' ? 'Buy' : 'Sell'} ${ls} ${asset} @ market via ${exLabel}`, { duration: 4000 })
      if (d?.trade?.new_balance !== undefined) {
        useAuthStore.getState().setUser({ ...useAuthStore.getState().user!, balance_usdt: d.trade.new_balance })
      }
      fetchHistory()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Order failed')
    } finally { setLoading(false) }
  }


  return (
    <div className="space-y-3">



      
      {/* ── 1. Buy/Sell Card - sticky top ───────────────────────────────── */}
      {showBuySell && (
        <div className="sticky top-0 z-40 -mx-4 sm:mx-0">
        <div className="bg-[#161a1e] sm:rounded-xl px-4 py-3">
          <div className="flex items-center justify-center gap-3 w-full">
            <button type="button" disabled={orderLoading} onClick={() => handleQuickTrade('sell')}
              className="flex-1 px-7 py-2.5 rounded-xl text-sm font-bold bg-[#f6465d] hover:bg-[#d93d51] text-white transition active:scale-[0.98] disabled:opacity-50">
              Sell
            </button>

            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-[#4a5568] uppercase tracking-widest">Lot Size</span>
              <div className="flex items-center bg-[#0b0e11] border-[#2b3139] rounded-lg overflow-hidden">
                <button type="button" onClick={() => { const n = Math.max(0.01, parseFloat(lotSize||'0.01') - 0.01); const s = n.toFixed(2); setLotSize(s); setAmount(s) }}
                  className="px-2.5 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition"><Minus size={12} /></button>
                <input
                  value={lotSize}
                  onChange={e => { setLotSize(e.target.value); setAmount(e.target.value) }}
                  onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) { const s = Math.min(100, Math.max(0.01, n)).toFixed(2); setLotSize(s); setAmount(s) } }}
                  className="w-16 text-center text-xs font-mono text-[#f0b90b] font-bold py-1.5 bg-transparent focus:outline-none"
                  inputMode="decimal"
                />
                <button type="button" onClick={() => { const n = Math.min(100, parseFloat(lotSize||'1') + 0.01); const s = n.toFixed(2); setLotSize(s); setAmount(s) }}
                  className="px-2.5 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition"><Plus size={12} /></button>
              </div>
            </div>

            <button type="button" disabled={orderLoading} onClick={() => handleQuickTrade('buy')}
              className="flex-1 px-7 py-2.5 rounded-xl text-sm font-bold bg-[#0ecb81] hover:bg-[#0ab56f] text-black transition active:scale-[0.98] disabled:opacity-50">
              Buy
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── Chart + FinChat + Order (all full-width stacked) ────────── */}
      <div className="space-y-3">

        {/* Combined pair header + TradingView chart card — full-bleed on mobile */}
        <div className="-mx-4 sm:mx-0">
          <div className={`bg-[#161a1e] border-y border-[#2b3139] sm:border sm:rounded-xl overflow-hidden flex flex-col ${chartExpanded ? 'fixed inset-0 z-[9999] rounded-none border-0' : ''}`}>

            {/* ── Pair header ─────────────────────────────────────────── */}
            <div className="px-3 pt-2.5 pb-1.5 border-b border-[#2b3139]">
              {/* Row 1: pair selector + price + change + live dot */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <button onClick={() => setShowP(v => !v)}
                    className="flex items-center gap-1.5 hover:bg-[#2b3139]/60 rounded-lg px-1.5 py-0.5 transition">
                    <span className="text-sm font-bold text-[#eaecef]">{pair}</span>
                    <ChevronDown size={11} className="text-[#848e9c]" />
                  </button>
                  {showPairs && (
                    <div className="absolute top-full mt-1 left-0 bg-[#1e2329] border border-[#2b3139] rounded-xl overflow-hidden z-30 min-w-[155px] shadow-xl shadow-black/50 max-h-64 overflow-y-auto">
                      {PAIRS.map(p => (
                        <button key={p} onClick={() => { setPair(p); setShowP(false); setAmount('') }}
                          className={`w-full text-left px-3 py-2 text-xs transition hover:bg-[#2b3139] ${p === pair ? 'text-[#f0b90b] font-semibold' : 'text-[#eaecef]'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-base font-bold font-mono text-[#eaecef]">
                  ${livePrice > 0 ? livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                </span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${liveChange >= 0 ? 'text-[#0ecb81] bg-[#0ecb81]/10' : 'text-[#f6465d] bg-[#f6465d]/10'}`}>
                  {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}%
                </span>
                <span className={`text-[10px] flex items-center gap-0.5 ${isLive ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                  {isLive ? <Wifi size={8} /> : <WifiOff size={8} />}
                  {isLive ? 'live' : 'cached'}
                </span>
                {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />}

                {/* TV chart fullscreen + settings — right side of header */}
                <div className="ml-auto flex items-center gap-0.5">
                  <button onClick={() => setChartExpanded(v => !v)} title={chartExpanded ? 'Exit fullscreen' : 'Fullscreen'}
                    className={`p-1.5 rounded-lg transition ${chartExpanded ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
                    <Maximize2 size={13} />
                  </button>
                <div className="relative" ref={tvSettingsRef}>
                  <button
                    onClick={() => setShowTvSettings(v => !v)}
                    title="Chart settings"
                    className={`p-1.5 rounded-lg transition ${showTvSettings ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                  {showTvSettings && (
                    <div className="absolute right-0 top-full mt-1.5 bg-[#1e2329] border border-[#2b3139] rounded-xl shadow-2xl shadow-black/60 z-50 w-60 max-h-[480px] overflow-y-auto">

                      {/* ── Timeframe ── */}
                      <div className="px-3 pt-3 pb-2">
                        <p className="text-[9px] font-semibold text-[#848e9c] uppercase tracking-widest mb-2">Timeframe</p>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { v:'1',  l:'1m'  }, { v:'5',  l:'5m'  }, { v:'15', l:'15m' }, { v:'30', l:'30m' },
                            { v:'60', l:'1h'  }, { v:'240',l:'4h'  }, { v:'D',  l:'1D'  }, { v:'W',  l:'1W'  },
                          ].map(tf => (
                            <button key={tf.v}
                              onClick={() => { setTvInterval(tf.v); localStorage.setItem('finai-tv-interval', tf.v) }}
                              className={`py-1.5 rounded-lg text-[10px] font-mono font-semibold transition ${tvInterval === tf.v ? 'bg-[#f0b90b] text-black' : 'bg-[#0b0e11] text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
                              {tf.l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Chart Style ── */}
                      <div className="px-3 py-2 border-t border-[#2b3139]">
                        <p className="text-[9px] font-semibold text-[#848e9c] uppercase tracking-widest mb-1.5">Chart Style</p>
                        <div className="space-y-0.5">
                          {TV_STYLES.map(s => (
                            <button key={s.value}
                              onClick={() => { setTvStyle(s.value); localStorage.setItem('finai-tv-style', s.value) }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between ${tvStyle === s.value ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-semibold' : 'text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef]'}`}>
                              {s.label}
                              {tvStyle === s.value && <span className="text-[#f0b90b] text-[10px]">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── TradingView Toolbars ── */}
                      <div className="px-3 py-2 border-t border-[#2b3139]">
                        <p className="text-[9px] font-semibold text-[#848e9c] uppercase tracking-widest mb-1.5">TradingView Components</p>
                        {([
                          { label: 'Top Toolbar',  val: tvTopBar,  set: (v: boolean) => { setTvTopBar(v);  localStorage.setItem('finai-tv-topbar',  String(v)) } },
                          { label: 'Side Toolbar', val: tvSideBar, set: (v: boolean) => { setTvSideBar(v); localStorage.setItem('finai-tv-sidebar', String(v)) } },
                          { label: 'Price Legend', val: tvLegend,  set: (v: boolean) => { setTvLegend(v);  localStorage.setItem('finai-tv-legend',  String(v)) } },
                          { label: 'Date Ranges',  val: tvDateRng, set: (v: boolean) => { setTvDateRng(v); localStorage.setItem('finai-tv-daterng', String(v)) } },
                        ] as { label: string; val: boolean; set: (v: boolean) => void }[]).map(row => (
                          <button key={row.label}
                            onClick={() => row.set(!row.val)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                            {row.label}
                            <span className={`text-[10px] font-bold ${row.val ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{row.val ? 'ON' : 'OFF'}</span>
                          </button>
                        ))}
                      </div>

                      {/* ── Panels ── */}
                      <div className="px-3 py-2 pb-3 border-t border-[#2b3139]">
                        <p className="text-[9px] font-semibold text-[#848e9c] uppercase tracking-widest mb-1.5">Panels</p>
                        <button
                          onClick={() => { const v = !chatCollapsed; setChatCollapsed(v); localStorage.setItem('finai-chat', String(v)) }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                          FinChat
                          <span className={`text-[10px] font-bold ${!chatCollapsed ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{!chatCollapsed ? 'ON' : 'OFF'}</span>
                        </button>
                        <button
                          onClick={() => { const v = !showEntryLines; setShowEntryLines(v); localStorage.setItem('finai-entry-lines', String(v)) }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                          Entry Badge
                          <span className={`text-[10px] font-bold ${showEntryLines ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{showEntryLines ? 'ON' : 'OFF'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </div>{/* end ml-auto flex */}
              </div>
              {/* Row 2: 24h H / L + bid/ask — always visible */}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-[#848e9c]">
                  H <span className="text-[#eaecef] font-mono">${high24}</span>
                </span>
                <span className="text-[10px] text-[#848e9c]">
                  L <span className="text-[#eaecef] font-mono">${low24}</span>
                </span>
                <span className="text-[#2b3139] text-[10px]">|</span>
                <span className="text-[10px] text-[#f6465d] font-mono">{orderBook.bids[0] ? orderBook.bids[0].price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</span>
                <span className="text-[10px] text-[#4a5568]">bid/ask</span>
                <span className="text-[10px] text-[#0ecb81] font-mono">{orderBook.asks[0] ? orderBook.asks[0].price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</span>
              </div>
            </div>

            {/* Content switches per tab */}
            {chartCollapsed ? (
              <div className="px-4 py-4 text-center text-xs text-[#4a5568]">
                Chart collapsed — click <span className="text-[#f0b90b] font-semibold">↑</span> to expand
              </div>
            ) : chartTab === 'chart' ? (
              <div className="flex flex-col">
                {/* ── TradingView iframe + entry line overlay ── */}
                <div className="relative" style={{ lineHeight: 0 }}>
                  <iframe
                    key={`${pair}-${tvStyle}-${tvInterval}-${tvTopBar}-${tvSideBar}-${tvLegend}-${tvDateRng}-${tvTheme}`}
                    src={`https://s.tradingview.com/widgetembed/?symbol=${TV_SYMBOLS[pair] ?? 'BINANCE:BTCUSDT'}&theme=${tvTheme}&style=${tvStyle}&interval=${tvInterval}&locale=en&toolbar_bg=${tvTheme==='light'?'%23ffffff':'%230b0e11'}&withdateranges=${tvDateRng ? 1 : 0}&hide_side_toolbar=${tvSideBar ? 0 : 1}&hide_top_toolbar=${tvTopBar ? 0 : 1}&hide_legend=${tvLegend ? 0 : 1}&allow_symbol_change=0&save_image=0&show_popup_button=0`}
                    width="100%"
                    style={{ border: 'none', display: 'block', height: chartExpanded ? 'calc(100vh - 46px)' : '420px' }}
                    allowFullScreen title="TradingView Chart"
                  />
                  {/* ── Entry price lines overlaid on chart ── */}
                  {showEntryLines && (() => {
                    const base = pair.replace('/', '').toUpperCase()
                    const pairPositions = openPositions.filter(pos => {
                      const t = (pos.ticker ?? '').toUpperCase().replace(/[-/]/g, '')
                      return t === base || t === base.replace('USDT','') || t.includes(base.slice(0,3))
                    })
                    if (pairPositions.length === 0) return null
                    return (
                      <>
                        {pairPositions.map(pos => {
                          const entryPrice  = pos.price ?? 0
                          const side        = (pos.side ?? pos.action ?? 'long').toUpperCase().startsWith('S') ? 'SHORT' : 'LONG'
                          const sideColor   = side === 'LONG' ? '#0ecb81' : '#f6465d'
                          const entryLabel  = entryPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })
                          const ref         = livePrice || entryPrice
                          const span        = Math.max(ref * 0.22, 1)
                          const yPct        = Math.max(5, Math.min(92, ((ref + span / 2 - entryPrice) / span) * 100))
                          return (
                            <div key={pos.id}
                              className="absolute left-0 right-0 pointer-events-none"
                              style={{ top: `${yPct}%`, zIndex: 5 }}>
                              {/* dashed horizontal line */}
                              <div style={{ borderTop: `1.5px dashed ${sideColor}`, opacity: 0.85 }} />
                              {/* price label pinned to right edge */}
                              <div className="absolute right-0 flex items-center" style={{ top: '-10px' }}>
                                <div className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-l"
                                  style={{ background: sideColor, color: '#0b0e11', lineHeight: '16px' }}>
                                  {side[0]} {entryLabel}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              </div>
            ) : chartTab === 'orderbook' ? (
              <div className="flex-1 p-4 overflow-y-auto" style={{ minHeight: 420 }}>
                <div className="flex justify-between text-[10px] text-[#4a5568] mb-3 uppercase tracking-widest">
                  <span>Price (USDT)</span><span>Amount ({pair.split('/')[0]})</span>
                </div>
                <div className="space-y-0.5 mb-3">
                  {orderBook.asks.slice(0, 8).reverse().map((a, i) => (
                    <div key={i} className="relative flex justify-between text-xs px-1 py-1.5 rounded">
                      <div className="absolute inset-0 bg-[#f6465d]/8 rounded" style={{ width: `${Math.min(a.size / 2 * 100, 100)}%`, marginLeft: 'auto' }} />
                      <span className="text-[#f6465d] font-mono relative">${a.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      <span className="text-[#848e9c] font-mono relative">{a.size.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center text-base font-bold font-mono text-[#eaecef] bg-[#0b0e11] rounded-lg py-2 my-2">
                  ${livePrice > 0 ? livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                </div>
                <div className="space-y-0.5 mt-3">
                  {orderBook.bids.slice(0, 8).map((b, i) => (
                    <div key={i} className="relative flex justify-between text-xs px-1 py-1.5 rounded">
                      <div className="absolute inset-0 bg-[#0ecb81]/8 rounded" style={{ width: `${Math.min(b.size / 2 * 100, 100)}%` }} />
                      <span className="text-[#0ecb81] font-mono relative">${b.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      <span className="text-[#848e9c] font-mono relative">{b.size.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : chartTab === 'trades' ? (
              <div className="flex-1 overflow-y-auto" style={{ minHeight: 420 }}>
                {tradeHistory.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#848e9c]">No trades yet</div>
                ) : (
                  <div className="divide-y divide-[#2b3139]/50">
                    {tradeHistory.slice(0, 30).map(t => {
                      const isBuy = t.action?.toUpperCase() === 'BUY'
                      const timeStr = t.created_at ? new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
                      return (
                        <div key={t.id} className="flex justify-between items-center px-4 py-2 text-xs">
                          <span className={`font-semibold w-8 ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{isBuy ? 'Buy' : 'Sell'}</span>
                          <span className="font-mono text-[#eaecef]">{(t.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                          <span className="font-mono text-[#848e9c]">{(t.qty ?? 0).toFixed(4)}</span>
                          <span className="text-[#4a5568]">{timeStr}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 p-4 space-y-2" style={{ minHeight: 420 }}>
                {[
                  { label: 'Pair',       value: pair },
                  { label: 'Last Price', value: `$${livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
                  { label: '24h Change', value: `${liveChange >= 0 ? '+' : ''}${liveChange.toFixed(2)}%`, color: liveChange >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                  { label: 'Best Bid',   value: orderBook.bids[0] ? `$${orderBook.bids[0].price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—', color: 'text-[#0ecb81]' },
                  { label: 'Best Ask',   value: orderBook.asks[0] ? `$${orderBook.asks[0].price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—', color: 'text-[#f6465d]' },
                  { label: 'Source',     value: isLive ? 'CoinGecko Live' : 'Cached' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-[#2b3139]/50">
                    <span className="text-xs text-[#848e9c]">{row.label}</span>
                    <span className={`text-xs font-mono font-semibold ${row.color ?? 'text-[#eaecef]'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
            {/* ── Order Form — nested inside chart card ── */}
            {showOrderForm && (
            <div className="border-t border-[#2b3139]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
          <h3 className="text-sm font-semibold text-[#eaecef] flex items-center gap-2">
            <TrendingUp size={14} className="text-[#f0b90b]" />
            Place Order
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${side==='buy' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
              {side === 'buy' ? 'BUY' : 'SELL'} · {orderType.toUpperCase()}
            </span>
            <span className="text-[10px] text-[#848e9c] font-mono">{pair}</span>
          </h3>
          <button type="button" onClick={() => setOrderFormCollapsed(v => !v)}
            className="text-[#848e9c] hover:text-[#eaecef] transition">
            {orderFormCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!orderFormCollapsed && (
      <form onSubmit={handleTrade} className="p-5">

        {/* Row 1: Buy/Sell + Order type + Route + Balance */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex gap-1 bg-[#0b0e11] p-1 rounded-xl border border-[#2b3139]">
            <button type="button" onClick={() => setSide('buy')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition ${side==='buy' ? 'bg-[#0ecb81] text-black shadow-lg shadow-[#0ecb81]/20' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
              Buy
            </button>
            <button type="button" onClick={() => setSide('sell')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition ${side==='sell' ? 'bg-[#f6465d] text-white shadow-lg shadow-[#f6465d]/20' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
              Sell
            </button>
          </div>

          <div className="flex gap-0.5 bg-[#0b0e11] border border-[#2b3139] p-0.5 rounded-lg">
            {(['limit','market'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`text-xs px-3 py-1.5 rounded-md capitalize font-medium transition ${orderType===t ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="relative">
            <select value={selExchange} onChange={e => setSelExch(e.target.value)}
              className="bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-lg px-3 py-2 text-xs text-[#eaecef] focus:outline-none transition appearance-none pr-8 cursor-pointer">
              <option value="__balance__">Platform Balance</option>
              {exchanges.map(ex => (
                <option key={ex.label} value={ex.label}>{ex.exchange.toUpperCase()} — {ex.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
          </div>
          <p className="text-[9px] text-[#848e9c] flex items-center gap-1">
            {usingBalance ? 'Internal wallet' : <><Link2 size={9} /> Live on {selectedConn?.exchange?.toUpperCase()}</>}
          </p>

          <div className="ml-auto text-right hidden sm:block">
            <p className="text-[10px] text-[#848e9c] flex items-center justify-end gap-1">
              {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />}
              Available
            </p>
            <p className="text-sm font-mono font-bold text-[#f0b90b]">
              ${liveBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Row 2: Controls grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">

          {/* Lot Size */}
          <div>
            <label className="text-[10px] text-[#848e9c] mb-1.5 block">Lot Size</label>
            <div className="flex items-center bg-[#0b0e11] border border-[#2b3139] focus-within:border-[#f0b90b] rounded-lg overflow-hidden transition">
              <button type="button" onClick={() => {
                const next = Math.max(0.01, parseFloat(lotSize||'0.01') - 0.01)
                const s = next.toFixed(2); setLotSize(s); setAmount(s)
              }} className="px-2.5 py-2.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition flex-shrink-0">
                <Minus size={10} />
              </button>
              <input value={lotSize} onChange={e => { setLotSize(e.target.value); setAmount(e.target.value) }}
                className="flex-1 bg-transparent text-center text-xs font-mono text-[#eaecef] focus:outline-none min-w-0 py-2.5" />
              <button type="button" onClick={() => {
                const next = Math.min(100, parseFloat(lotSize||'0.01') + 0.01)
                const s = next.toFixed(2); setLotSize(s); setAmount(s)
              }} className="px-2.5 py-2.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition flex-shrink-0">
                <Plus size={10} />
              </button>
            </div>
          </div>

          {/* Leverage */}
          <div>
            <label className="text-[10px] text-[#848e9c] mb-1.5 flex items-center gap-1">
              <Zap size={9} className="text-[#f0b90b]" /> Leverage
            </label>
            <div className="flex items-center bg-[#0b0e11] border border-[#2b3139] rounded-lg overflow-hidden">
              <button type="button" onClick={() => setLeverageIdx(i => Math.max(0, i-1))}
                className="px-2.5 py-2.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition flex-shrink-0">
                <Minus size={10} />
              </button>
              <span className="flex-1 text-center text-xs font-bold font-mono text-[#f0b90b] py-2.5">{leverage}x</span>
              <button type="button" onClick={() => setLeverageIdx(i => Math.min(LEVERAGE_STEPS.length-1, i+1))}
                className="px-2.5 py-2.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition flex-shrink-0">
                <Plus size={10} />
              </button>
            </div>
          </div>

          {/* Price */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-[10px] text-[#848e9c]">{orderType === 'limit' ? 'Price (USDT)' : 'Price'}</label>
              {orderType === 'limit' && <span className="text-[9px] text-[#0ecb81]">{isLive ? 'live' : 'cached'}</span>}
            </div>
            {orderType === 'limit' ? (
              <input value={price} onChange={e => { userEditedRef.current = true; setPrice(e.target.value) }}
                className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-lg px-3 py-2.5 text-xs font-mono text-[#eaecef] focus:outline-none transition" />
            ) : (
              <div className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-xs font-mono text-[#848e9c]">Market</div>
            )}
          </div>

          {/* Amount */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-[10px] text-[#848e9c]">Amount ({asset})</label>
              <span className="text-[9px] text-[#848e9c] truncate ml-1">
                {side==='buy' ? `$${liveBalance.toFixed(0)} avail` : `${availCrypto.toFixed(4)} avail`}
              </span>
            </div>
            <input value={amount} onChange={e => {
              setAmount(e.target.value)
              const n = parseFloat(e.target.value)
              if (!isNaN(n) && n > 0) setLotSize(Math.min(100, n).toFixed(2))
            }} placeholder="0.00"
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] rounded-lg px-3 py-2.5 text-xs font-mono text-[#eaecef] focus:outline-none transition" />
          </div>

          {/* Stop Loss */}
          <div>
            <label className="text-[10px] text-[#848e9c] mb-1.5 flex items-center gap-1">
              <AlertTriangle size={9} className="text-[#f6465d]" /> Stop Loss
            </label>
            <input value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="Optional"
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f6465d]/60 rounded-lg px-3 py-2.5 text-xs font-mono text-[#eaecef] focus:outline-none transition" />
          </div>

          {/* Take Profit */}
          <div>
            <label className="text-[10px] text-[#848e9c] mb-1.5 flex items-center gap-1">
              <Target size={9} className="text-[#0ecb81]" /> Take Profit
            </label>
            <input value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="Optional"
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#0ecb81]/60 rounded-lg px-3 py-2.5 text-xs font-mono text-[#eaecef] focus:outline-none transition" />
          </div>
        </div>

        {/* Row 3: Quick fill + Cost + Submit */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] text-[#848e9c] flex-shrink-0">Quick:</span>
          {[25, 50, 75, 100].map(pct => (
            <button key={pct} type="button"
              onClick={() => {
                const newQty = side==='buy'
                  ? (numPrice > 0 ? liveBalance*pct/100/numPrice : 0)
                  : availCrypto*pct/100
                const s = newQty.toFixed(6)
                setAmount(s)
                setLotSize(Math.min(100, newQty).toFixed(2))
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[#0b0e11] hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition font-medium border border-[#2b3139]">
              {pct}%
            </button>
          ))}
        </div>

        {/* Row 4: Cost line (separate to avoid overlap) */}
        <div className="flex items-center justify-between py-2 border-t border-b border-[#2b3139] mb-3">
          <div>
            <span className="text-xs text-[#848e9c]">{side==='buy' ? (leverage > 1 ? 'Margin Required' : 'Cost') : 'Proceeds'}</span>
            {leverage > 1 && side === 'buy' && (
              <span className="ml-2 text-[10px] text-[#f0b90b]">
                Notional: ${orderNotional > 0 ? orderNotional.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00'}
              </span>
            )}
          </div>
          <span className={`text-sm font-mono font-bold ${side==='buy' ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
            {side==='buy' ? '−' : '+'}${orderTotal > 0 ? orderTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00'} USDT
          </span>
        </div>

        {/* Row 5: SL/TP/Lev badges + Submit */}
        <div className="flex flex-wrap items-center gap-2">
          {stopLoss && (
            <span className="flex items-center gap-1 bg-[#f6465d]/10 border border-[#f6465d]/20 text-[#f6465d] text-[10px] px-2 py-1 rounded-lg">
              <AlertTriangle size={9} /> SL ${parseFloat(stopLoss).toLocaleString()}
            </span>
          )}
          {takeProfit && (
            <span className="flex items-center gap-1 bg-[#0ecb81]/10 border border-[#0ecb81]/20 text-[#0ecb81] text-[10px] px-2 py-1 rounded-lg">
              <CheckCircle2 size={9} /> TP ${parseFloat(takeProfit).toLocaleString()}
            </span>
          )}
          {leverage > 1 && (
            <span className="flex items-center gap-1 bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-[#f0b90b] text-[10px] px-2 py-1 rounded-lg">
              <Zap size={9} /> {leverage}x
            </span>
          )}
          <button type="submit" disabled={orderLoading}
            className={`ml-auto px-10 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 ${
              side==='buy' ? 'bg-[#0ecb81] hover:bg-[#0ab56f] text-black shadow-lg shadow-[#0ecb81]/20'
                           : 'bg-[#f6465d] hover:bg-[#d93d51] text-white shadow-lg shadow-[#f6465d]/20'
            }`}>
            {orderLoading ? 'Placing order…' : `${side==='buy' ? 'Buy' : 'Sell'} ${asset}`}
          </button>
        </div>
              </form>
            )}
            </div>
            )}
          </div>
        </div>

        {/* Open Positions - Compact Style */}
        {openPositions.length > 0 && (
        <div className="-mx-4 sm:mx-0">
          <div className="bg-[#161a1e] border-y border-[#f0b90b]/15 sm:border sm:rounded-2xl px-3 py-2">
            <div className="flex items-center justify-between">
              {/* Left Side */}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center">
                  <BarChart2 size={13} className="text-[#f0b90b]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {openPositions.length} Open Position{openPositions.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-[#848e9c]">
                    <span>Position Value</span>
                    <span className="font-mono text-[#eaecef]">
                      ${totalPositionValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
              {/* Right Side */}
              <div className="text-right">
                <p className={`text-base font-bold font-mono ${unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}${Math.abs(unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#848e9c]'}`} />
                    <span className="text-[9px] text-[#848e9c]">live</span>
                  </div>
                  <button onClick={() => navigate('/app/positions')}
                    className="text-[#f0b90b] hover:text-[#eaecef] text-xs font-medium flex items-center gap-0.5 transition">
                    View →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Icon tab nav — full-bleed, below Open Positions ─────────── */}
        <div className="-mx-4 sm:mx-0">
        <div className="flex items-center gap-0.5 bg-[#161a1e] sm:rounded-xl px-1.5 py-1" ref={prefsRef}>
          {([
            { id: 'chart',     Icon: Tv,         title: 'Chart'      },
            { id: 'orderbook', Icon: ArrowUpDown, title: 'Order Book' },
            { id: 'trades',    Icon: Clock,       title: 'Trades'     },
            { id: 'info',      Icon: BarChart2,   title: 'Info'       },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setChartTab(tab.id)} title={tab.title}
              className={`p-2 rounded-lg transition ${chartTab === tab.id ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
              <tab.Icon size={12} />
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => { const v = !chatCollapsed; setChatCollapsed(v); localStorage.setItem('finai-chat', String(v)) }} title={chatCollapsed ? 'Show FinChat' : 'Hide FinChat'}
            className={`p-2 rounded-lg transition ${!chatCollapsed ? 'text-[#f0b90b] bg-[#f0b90b]/10' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
            <MessageSquare size={12} />
          </button>
          <button onClick={() => { const v = !showOrderForm; setShowOrderForm(v); localStorage.setItem('finai-order-form', String(v)) }} title={showOrderForm ? 'Hide Order Form' : 'Show Order Form'}
            className={`p-2 rounded-lg transition ${showOrderForm ? 'text-[#f0b90b] bg-[#f0b90b]/10' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
            <TrendingUp size={12} />
          </button>
          <button onClick={() => { const v = !chartCollapsed; setChartCollapsed(v); localStorage.setItem('finai-chart-collapsed', String(v)) }}
            title={chartCollapsed ? 'Expand chart' : 'Collapse chart'}
            className={`p-2 rounded-lg transition ${chartCollapsed ? 'text-[#f0b90b] bg-[#f0b90b]/10' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
            {chartCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          <div className="relative">
            <button onClick={() => setShowPrefs(v => !v)} title="Settings"
              className={`p-2 rounded-lg transition ${showPrefs ? 'text-[#eaecef] bg-[#2b3139]' : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139]'}`}>
              <Settings size={12} />
            </button>
            {showPrefs && (
              <div className="absolute right-0 bottom-full mb-1 p-3 bg-[#1e2329] border border-[#2b3139] rounded-xl shadow-2xl z-50 w-[270px] max-h-[400px] overflow-y-auto">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Show / Hide</p>
                <div className="space-y-0.5 mb-3">
                  <button onClick={() => { const v = !showBuySell; setShowBuySell(v); localStorage.setItem('finai-buy-sell', String(v)) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                    Buy / Sell Bar <span className={showBuySell ? 'text-[#0ecb81] text-[10px] font-bold' : 'text-[#f6465d] text-[10px] font-bold'}>{showBuySell ? 'ON' : 'OFF'}</span>
                  </button>
                  <button onClick={() => { const v = !chatCollapsed; setChatCollapsed(v); localStorage.setItem('finai-chat', String(v)) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                    FinChat Panel <span className={!chatCollapsed ? 'text-[#0ecb81] text-[10px] font-bold' : 'text-[#f6465d] text-[10px] font-bold'}>{!chatCollapsed ? 'ON' : 'OFF'}</span>
                  </button>
                  <button onClick={() => { const v = !showOrderForm; setShowOrderForm(v); localStorage.setItem('finai-order-form', String(v)) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                    Order Form <span className={showOrderForm ? 'text-[#0ecb81] text-[10px] font-bold' : 'text-[#f6465d] text-[10px] font-bold'}>{showOrderForm ? 'ON' : 'OFF'}</span>
                  </button>
                  <button onClick={() => { const v = !chartCollapsed; setChartCollapsed(v); localStorage.setItem('finai-chart-collapsed', String(v)) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                    Chart <span className={!chartCollapsed ? 'text-[#0ecb81] text-[10px] font-bold' : 'text-[#f6465d] text-[10px] font-bold'}>{!chartCollapsed ? 'ON' : 'OFF'}</span>
                  </button>
                  <button onClick={() => { const v = !showEntryLines; setShowEntryLines(v); localStorage.setItem('finai-entry-lines', String(v)) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                    Entry Lines <span className={showEntryLines ? 'text-[#0ecb81] text-[10px] font-bold' : 'text-[#f6465d] text-[10px] font-bold'}>{showEntryLines ? 'ON' : 'OFF'}</span>
                  </button>
                  <button onClick={() => { const v = !showOrderBook; setShowOrderBook(v); localStorage.setItem('finai-orderbook', String(v)) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                    Bid &amp; Ask <span className={showOrderBook ? 'text-[#0ecb81] text-[10px] font-bold' : 'text-[#f6465d] text-[10px] font-bold'}>{showOrderBook ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
                <div className="pt-2 border-t border-[#2b3139]">
                  <p className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Chart Style</p>
                  <div className="space-y-0.5">
                    {TV_STYLES.map(s => (
                      <button key={s.value} onClick={() => { setTvStyle(s.value); setShowPrefs(false) }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${tvStyle === s.value ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-semibold' : 'text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef]'}`}>
                        {s.label}{tvStyle === s.value && <span className="float-right text-[#f0b90b]">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-[#2b3139]">
                  <p className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Default Lot Size</p>
                  <div className="flex items-center bg-[#0b0e11] border border-[#2b3139] rounded-lg overflow-hidden">
                    <button type="button" onClick={() => { const n = Math.max(0.01, parseFloat(lotSize||'0.01') - 0.01); const s = n.toFixed(2); setLotSize(s); setAmount(s) }}
                      className="px-2 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition"><Minus size={9} /></button>
                    <input value={lotSize} onChange={e => { setLotSize(e.target.value); setAmount(e.target.value) }}
                      className="flex-1 bg-transparent text-center text-xs font-mono text-[#eaecef] focus:outline-none min-w-0 py-1.5 w-16" />
                    <button type="button" onClick={() => { const n = Math.min(100, parseFloat(lotSize||'1') + 1); const s = n.toFixed(2); setLotSize(s); setAmount(s) }}
                      className="px-2 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition"><Plus size={9} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

      {/* FinChat — full-width below chart */}
      <div className="-mx-4 sm:mx-0">
        <FinChatPanel
          pair={pair} livePrice={livePrice} liveChange={liveChange}
          collapsed={chatCollapsed} onToggle={() => { const v = !chatCollapsed; setChatCollapsed(v); localStorage.setItem('finai-chat', String(v)) }}
          usingBalance={usingBalance} selExchange={selExchange}
        />
      </div>
      </div>
    </div>
      
    
  )
}
