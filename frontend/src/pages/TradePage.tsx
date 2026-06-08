import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ArrowUpDown, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Wifi, WifiOff, Link2, RefreshCw, Clock, CheckCircle2, X,
  Target, AlertTriangle, ArrowRight, Zap, Minus, Plus,
  MessageSquare, Tv, Bot, Settings, Radio, BarChart2, Maximize2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { executeTrade, getBotTrades, getOpenPositions, closeManualTrade } from '../lib/api'

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
interface OpenPosition { id: number; ticker: string; price: number; qty: number; exchange: string; created_at: string; current_price: number; unrealized_pnl: number; leverage?: number; pnl_pct?: number }

// ── FinChat panel ─────────────────────────────────────────────────────────────
function FinChatPanel({ pair, livePrice, liveChange, collapsed, onToggle }: {
  pair: string; livePrice: number; liveChange: number; collapsed: boolean; onToggle: () => void
}) {
  const asset = pair.split('/')[0]
  const isUp  = liveChange >= 0
  const [chatInput, setChatInput] = useState('')
  const [userMessages, setUserMessages] = useState<{ id: number; text: string; reply: string }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [userMessages])

  const baseMessages = useMemo(() => {
    if (livePrice <= 0) return []
    const p   = livePrice
    const sup = (p * (isUp ? 0.985 : 0.992)).toFixed(2)
    const res = (p * (isUp ? 1.018 : 1.008)).toFixed(2)
    const t1  = (p * (isUp ? 1.035 : 0.965)).toFixed(2)
    const rsi = (isUp ? 52 + Math.round(Math.random()*12) : 38 + Math.round(Math.random()*10)).toString()
    return [
      { id:'a1', role:'signal' as const, time:'2m',  signal: isUp ? 'BUY' : 'SELL', conf: 68+Math.round(Math.random()*14), price: p },
      { id:'a2', role:'ai'     as const, time:'4m',  text: `${pair} RSI(14) at ${rsi} — ${isUp ? 'bullish momentum building above EMA-20' : 'bearish pressure below EMA-50'}. Watch for candle close confirmation.` },
      { id:'a3', role:'ai'     as const, time:'9m',  text: `Key levels: Support $${sup} · Resistance $${res}. ${isUp ? 'Bulls defending the 4H demand zone.' : 'Bears pushing through 4H supply zone.'}` },
      { id:'a4', role:'signal' as const, time:'15m', signal:'NEUTRAL', conf:51, price: p*0.998 },
      { id:'a5', role:'ai'     as const, time:'22m', text: `Volume profile: ${isUp ? 'rising buy volume confirms trend strength' : 'declining volume with falling price — distribution pattern'}. Target: $${t1}.` },
      { id:'a6', role:'ai'     as const, time:'38m', text: `${asset} correlation with broader market is ${isUp ? 'positive' : 'diverging'}. Trend bias: ${isUp ? 'Long' : 'Short'}. Next confluence: $${t1}.` },
      { id:'a7', role:'signal' as const, time:'1h',  signal: isUp ? 'BUY' : 'SELL', conf:74, price: p*0.994 },
    ]
  }, [pair, livePrice, isUp, asset])

  const handleSend = () => {
    const text = chatInput.trim()
    if (!text) return
    const replies = [
      `Analyzing ${pair} — current trend is ${isUp ? 'bullish' : 'bearish'} with ${Math.abs(liveChange).toFixed(2)}% move in 24h.`,
      `Based on technicals, ${asset} shows ${isUp ? 'strong buy' : 'strong sell'} signal at $${livePrice.toLocaleString('en-US',{maximumFractionDigits:2})}.`,
      `Risk tip: set stop-loss at ${isUp ? '1.5–2%' : '1–1.5%'} below entry for this trade.`,
      `${pair} volume is ${isUp ? 'above' : 'below'} the 20-period average — ${isUp ? 'confirming' : 'not confirming'} the price action.`,
    ]
    setUserMessages(prev => [...prev, { id: Date.now(), text, reply: replies[Math.floor(Math.random()*replies.length)] }])
    setChatInput('')
  }

  return (
    <div className={`bg-[#161a1e] border border-[#2b3139] rounded-xl flex flex-col overflow-hidden transition-all ${collapsed ? 'lg:col-span-0' : 'lg:col-span-1'}`} style={{ minHeight: collapsed ? 'auto' : 420 }}>
      {/* Header — always visible */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] flex-shrink-0">
        <div className="w-6 h-6 rounded-lg bg-[#f0b90b]/15 flex items-center justify-center">
          <MessageSquare size={12} className="text-[#f0b90b]" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#eaecef] leading-none">FinChat</p>
          <p className="text-[9px] text-[#848e9c] leading-none mt-0.5">powered by FinAi</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
          <span className="text-[10px] text-[#0ecb81]">Live</span>
        </div>
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition"
          title={collapsed ? 'Expand FinChat' : 'Collapse FinChat'}
        >
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Pair context */}
          <div className="px-4 py-2 bg-[#0b0e11]/50 border-b border-[#2b3139]/60 flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-[#f0b90b]">{pair}</span>
            <span className="text-[10px] text-[#848e9c]">·</span>
            <span className={`text-[10px] font-semibold ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {isUp ? '+' : ''}{liveChange.toFixed(2)}%
            </span>
            <span className="text-[10px] text-[#848e9c] ml-auto">AI Analysis</span>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {baseMessages.map(msg =>
              msg.role === 'signal' ? (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${msg.signal==='BUY' ? 'bg-[#0ecb81]' : msg.signal==='SELL' ? 'bg-[#f6465d]' : 'bg-[#848e9c]'}`} />
                  <div className={`flex-1 rounded-lg px-3 py-2 border ${msg.signal==='BUY' ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : msg.signal==='SELL' ? 'bg-[#f6465d]/5 border-[#f6465d]/20' : 'bg-[#2b3139]/30 border-[#2b3139]'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold tracking-wide ${msg.signal==='BUY' ? 'text-[#0ecb81]' : msg.signal==='SELL' ? 'text-[#f6465d]' : 'text-[#848e9c]'}`}>
                        {msg.signal} SIGNAL
                      </span>
                      <span className="text-[9px] text-[#4a5568]">{msg.time} ago</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#848e9c]">@ ${msg.price.toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[9px] text-[#848e9c]">Conf.</span>
                        <div className="w-16 h-1.5 bg-[#2b3139] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${msg.signal==='BUY' ? 'bg-[#0ecb81]' : msg.signal==='SELL' ? 'bg-[#f6465d]' : 'bg-[#848e9c]'}`} style={{ width:`${msg.conf}%` }} />
                        </div>
                        <span className={`text-[9px] font-bold ${msg.signal==='BUY' ? 'text-[#0ecb81]' : msg.signal==='SELL' ? 'text-[#f6465d]' : 'text-[#848e9c]'}`}>{msg.conf}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={10} className="text-[#f0b90b]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-[#f0b90b]">FinAi</span>
                      <span className="text-[9px] text-[#4a5568]">{msg.time} ago</span>
                    </div>
                    <p className="text-[11px] text-[#848e9c] leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              )
            )}
            {userMessages.map(um => (
              <div key={um.id}>
                <div className="flex justify-end mb-1.5">
                  <div className="bg-[#f0b90b]/10 border border-[#f0b90b]/20 rounded-lg px-3 py-2 max-w-[85%]">
                    <p className="text-[11px] text-[#eaecef]">{um.text}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={10} className="text-[#f0b90b]" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-semibold text-[#f0b90b]">FinAi</span>
                    <p className="text-[11px] text-[#848e9c] leading-relaxed mt-0.5">{um.reply}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-3 py-3 border-t border-[#2b3139] flex-shrink-0">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={`Ask about ${pair}…`}
                className="flex-1 bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b]/40 rounded-lg px-3 py-2 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none transition"
              />
              <button onClick={handleSend} className="px-3 py-2 rounded-lg bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-[#f0b90b] hover:bg-[#f0b90b]/20 transition">
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </>
      )}
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
  const [leverageIdx, setLeverageIdx] = useState(0)
  const [lotSize, setLotSize]       = useState('0.01')

  // Chart / UI state
  const [tvStyle, setTvStyle]       = useState('1')       // TradingView chart style
  const [showPrefs, setShowPrefs]   = useState(false)
  const [pair, setPair]             = useState('BTC/USDT')
  const [showPairs, setShowP]       = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [selExchange, setSelExch]   = useState<string>('__balance__')
  const [showOrderBook, setShowOrderBook] = useState(false)
  const [showBuySell, setShowBuySell] = useState(true)
  const [showEntryLines, setShowEntryLines] = useState(() => localStorage.getItem('finai-entry-lines') !== 'false')
  const [orderFormCollapsed, setOrderFormCollapsed] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Data state
  const [orderLoading, setLoading]  = useState(false)
  const [bottomTab, setBottomTab]   = useState<'history' | 'positions'>('positions')
  const [tradeHistory, setHistory]  = useState<TradeRecord[]>([])
  const [openPositions, setOpenPos] = useState<OpenPosition[]>([])
  const [histLoading, setHistLoad]  = useState(false)
  const [closingId, setClosingId]   = useState<number | null>(null)

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
    setHistLoad(true)
    try {
      const [tradesRes, posRes] = await Promise.allSettled([getBotTrades(100), getOpenPositions()])
      const trades: TradeRecord[] = tradesRes.status === 'fulfilled' ? (tradesRes.value.data?.trades ?? []) : []
      setHistory(trades)

      let positions: OpenPosition[] = posRes.status === 'fulfilled' ? (posRes.value.data?.positions ?? []) : []
      if (positions.length === 0 && trades.length > 0) {
        const posMap: Record<string, { qty: number; totalCost: number; trade: TradeRecord }> = {}
        for (const t of [...trades].reverse()) {
          const sym = t.ticker ?? ''; if (!sym) continue
          if (!posMap[sym]) posMap[sym] = { qty: 0, totalCost: 0, trade: t }
          if (t.action?.toUpperCase() === 'BUY') { posMap[sym].totalCost += (t.price??0)*(t.qty??0); posMap[sym].qty += t.qty??0 }
          else { posMap[sym].qty -= t.qty??0; if (posMap[sym].qty < 0) posMap[sym].qty = 0 }
        }
        positions = Object.entries(posMap).filter(([,p]) => p.qty > 0.000001).map(([sym,p]) => {
          const avg = p.totalCost / p.qty
          const cur = FALLBACKS[sym.replace('-', '/')]?.price ?? avg
          return { id: p.trade.id, ticker: sym, price: avg, qty: p.qty, exchange: p.trade.exchange, created_at: p.trade.created_at, current_price: cur, unrealized_pnl: (cur-avg)*p.qty } as OpenPosition
        })
      }
      setOpenPos(positions)
    } catch { /* silent */ } finally { setHistLoad(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const unrealizedPnl = useMemo(() => openPositions.reduce((s,p) => s + (p.unrealized_pnl??0), 0), [openPositions])
  const realizedPnl   = useMemo(() => tradeHistory.filter(t => t.pnl !== null).reduce((s,t) => s + (t.pnl ?? 0), 0), [tradeHistory])
  const totalPositionValue = useMemo(() => openPositions.reduce((s,p) => s + (p.qty * (p.current_price || p.price)), 0), [openPositions])

  const { price: livePrice, change: liveChange, live: isLive } = useTradeLivePrice(pair)
  const orderBook = makeOrderBook(livePrice)

  const prevPair      = useRef(pair)
  const priceInitRef  = useRef(false)
  const userEditedRef = useRef(false)
  const prefsRef      = useRef<HTMLDivElement>(null)

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
  const pnlDelta = wsBalance !== null ? wsBalance - userBalance : null

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault()
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
      fetchHistory(); setBottomTab('positions')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Order failed')
    } finally { setLoading(false) }
  }

  const handleQuickTrade = async (quickSide: 'buy' | 'sell') => {
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

  const handleClosePosition = async (tradeId: number) => {
    setClosingId(tradeId)
    try {
      const res = await closeManualTrade(tradeId)
      const d = res.data; const pnl = d.pnl ?? 0
      toast.success(`Position closed @ $${d.close_price?.toLocaleString('en-US',{maximumFractionDigits:2})} — P&L: ${pnl>=0?'+':''}$${pnl.toFixed(2)}`, { duration: 5000 })
      if (d.new_balance !== undefined) useAuthStore.getState().setUser({ ...useAuthStore.getState().user!, balance_usdt: d.new_balance })
      fetchHistory()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to close position')
    } finally { setClosingId(null) }
  }

  return (
    <div className="space-y-3">

      {/* ── Pair Selector + Quick Buy/Sell (tap-hold 3.5s to hide) ──────── */}
      <div
        className="sticky top-0 z-20 bg-[#161a1e] border-b border-[#2b3139] -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 overflow-visible select-none"
        onMouseDown={() => { holdTimerRef.current = setTimeout(() => setShowBuySell(v => !v), 3500) }}
        onMouseUp={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
        onMouseLeave={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
        onTouchStart={() => { holdTimerRef.current = setTimeout(() => setShowBuySell(v => !v), 3500) }}
        onTouchEnd={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
        onTouchCancel={() => { if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null } }}
      >
        {/* Row 1: pair + price + change + live + 24h stats + WS */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
          <div className="relative">
            <button
              onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
              onClick={() => setShowP(v => !v)}
              className="flex items-center gap-1.5 hover:bg-[#2b3139]/60 rounded-lg px-1.5 py-1 transition">
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
          <span className="text-[10px] text-[#848e9c] ml-auto hidden sm:inline">
            24h H <span className="text-[#eaecef] font-mono">${high24}</span>
            <span className="mx-1.5 text-[#2b3139]">|</span>
            24h L <span className="text-[#eaecef] font-mono">${low24}</span>
          </span>
          {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse flex-shrink-0" />}
        </div>

        {/* 24h H/L for mobile */}
        <div className="sm:hidden px-3 pb-1.5 text-[10px] text-[#848e9c]">
          24h H <span className="text-[#eaecef] font-mono">${high24}</span>
          <span className="mx-2 text-[#2b3139]">|</span>
          24h L <span className="text-[#eaecef] font-mono">${low24}</span>
        </div>

        {/* Buy/Sell quick bar (hidden by tap-and-hold on card) */}
        {showBuySell && (
          <div
            className="border-t border-[#2b3139] px-3 py-2 flex items-center gap-2"
            onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
          >
            <button type="button" disabled={orderLoading}
              onClick={() => handleQuickTrade('sell')}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#f6465d]/10 border border-[#f6465d]/30 text-[#f6465d] hover:bg-[#f6465d] hover:text-white disabled:opacity-50 transition active:scale-[0.98]">
              Sell
            </button>
            <div className="flex items-center bg-[#0b0e11] border border-[#2b3139] rounded-lg overflow-hidden flex-shrink-0"
              onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
              <button type="button" onClick={() => {
                const next = Math.max(0.01, parseFloat(lotSize||'0.01') - 0.01)
                const s = next.toFixed(2); setLotSize(s); setAmount(s)
              }} className="px-2 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition">
                <Minus size={9} />
              </button>
              <span className="w-14 text-center text-xs font-mono text-[#eaecef] font-bold py-1.5">{lotSize}</span>
              <button type="button" onClick={() => {
                const next = Math.min(100, parseFloat(lotSize||'0.01') + 0.01)
                const s = next.toFixed(2); setLotSize(s); setAmount(s)
              }} className="px-2 py-1.5 text-[#848e9c] hover:text-[#eaecef] hover:bg-[#2b3139] transition">
                <Plus size={9} />
              </button>
            </div>
            <button type="button" disabled={orderLoading}
              onClick={() => handleQuickTrade('buy')}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#0ecb81]/10 border border-[#0ecb81]/30 text-[#0ecb81] hover:bg-[#0ecb81] hover:text-black disabled:opacity-50 transition active:scale-[0.98]">
              Buy
            </button>
          </div>
        )}
      </div>

      {/* ── Open Positions Summary ──────────────────────────────────── */}
      {openPositions.length > 0 && (
        <div className="bg-[#161a1e] border border-[#f0b90b]/20 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#f0b90b]/10 flex items-center justify-center">
                <BarChart2 size={10} className="text-[#f0b90b]" />
              </div>
              <span className="text-xs font-semibold text-[#eaecef]">
                {openPositions.length} Open Position{openPositions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#848e9c]'}`} />
              <span className="text-[9px] text-[#848e9c]">live</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0b0e11]/60 rounded-lg px-3 py-2">
              <p className="text-[9px] text-[#848e9c] mb-0.5">Total Positions</p>
              <p className="text-xs font-bold font-mono text-[#eaecef]">{openPositions.length}</p>
            </div>
            <div className="bg-[#0b0e11]/60 rounded-lg px-3 py-2">
              <p className="text-[9px] text-[#848e9c] mb-0.5">Position Value</p>
              <p className="text-xs font-bold font-mono text-[#eaecef]">
                ${totalPositionValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#0b0e11]/60 rounded-lg px-3 py-2">
              <p className="text-[9px] text-[#848e9c] mb-0.5">Unrealized P&L</p>
              <p className={`text-xs font-bold font-mono ${unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
              </p>
            </div>
            <div className="bg-[#0b0e11]/60 rounded-lg px-3 py-2">
              <p className="text-[9px] text-[#848e9c] mb-0.5">Realized P&L</p>
              <p className={`text-xs font-bold font-mono ${realizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/app/positions')}
            className="mt-2.5 w-full flex items-center justify-center gap-1 text-xs text-[#f0b90b] hover:text-[#f0b90b]/80 py-1 border-t border-[#2b3139]/60 transition">
            View All <ArrowRight size={11} />
          </button>
        </div>
      )}

      {/* ── Chart + FinChat grid ─────────────────────────────────────── */}
      <div className={`grid grid-cols-1 gap-3 ${chatCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>

        {/* TradingView chart */}
        <div ref={chartContainerRef} className={`bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden flex flex-col ${chatCollapsed ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
          {/* Chart toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2b3139] flex-shrink-0">
            {/* TV brand */}
            <div className="flex items-center gap-1.5 text-xs text-[#848e9c]">
              <Tv size={12} className="text-[#f0b90b]" />
              <span className="font-medium">TradingView</span>
            </div>

            {/* Preferences dropdown */}
            <div className="ml-auto relative" ref={prefsRef}>
              <button onClick={() => setShowPrefs(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${showPrefs ? 'bg-[#2b3139] border-[#f0b90b]/30 text-[#eaecef]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] hover:border-[#3c4451]'}`}>
                <Settings size={11} /> Preferences
              </button>
              {showPrefs && (
                <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-[#1e2329] border border-[#2b3139] rounded-xl shadow-xl shadow-black/50 p-3">
                  <p className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Chart Style</p>
                  <div className="space-y-0.5">
                    {TV_STYLES.map(s => (
                      <button key={s.value} onClick={() => { setTvStyle(s.value); setShowPrefs(false) }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${tvStyle === s.value ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-semibold' : 'text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef]'}`}>
                        {s.label}
                        {tvStyle === s.value && <span className="float-right text-[#f0b90b]">✓</span>}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#2b3139]">
                    <p className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">FinChat</p>
                    <button onClick={() => { setChatCollapsed(v => !v); setShowPrefs(false) }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                      {chatCollapsed ? 'Show FinChat' : 'Hide FinChat'}
                      <MessageSquare size={10} />
                    </button>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#2b3139]">
                    <p className="text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Overlays</p>
                    <button onClick={() => { const v = !showEntryLines; setShowEntryLines(v); localStorage.setItem('finai-entry-lines', String(v)); setShowPrefs(false) }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef] transition flex items-center justify-between">
                      {showEntryLines ? 'Hide Entry Lines' : 'Show Entry Lines'}
                      <Target size={10} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen?.()
                } else {
                  chartContainerRef.current?.requestFullscreen?.()
                }
              }}
              title="Fullscreen chart"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#2b3139] bg-[#0b0e11] text-[#848e9c] hover:text-[#eaecef] hover:border-[#3c4451] transition">
              <Maximize2 size={11} />
            </button>
          </div>

          {/* Entry lines strip — shown when positions exist for this pair */}
          {showEntryLines && (() => {
            const pairPos = openPositions.filter(p =>
              p.ticker === pair || p.ticker === pair.replace('/', '') || p.ticker === pair.replace('/', '-')
            )
            if (pairPos.length === 0) return null
            return (
              <div className="px-3 py-1.5 border-b border-[#2b3139] bg-[#0b0e11]/60 flex flex-wrap gap-3">
                {pairPos.map(pos => (
                  <div key={pos.id} className="flex items-center gap-1.5">
                    <div className="w-4 border-t-2 border-dashed border-[#f0b90b]" />
                    <span className="text-[9px] text-[#848e9c]">Entry</span>
                    <span className="text-[9px] font-mono font-bold text-[#f0b90b]">
                      ${pos.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </span>
                    <span className={`text-[9px] font-semibold ${(pos.unrealized_pnl ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {(pos.unrealized_pnl ?? 0) >= 0 ? '+' : ''}${(pos.unrealized_pnl ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* TV iframe — always shown */}
          <div className="flex-1">
            <iframe
              key={`${pair}-${tvStyle}`}
              src={`https://s.tradingview.com/widgetembed/?symbol=${TV_SYMBOLS[pair] ?? 'BINANCE:BTCUSDT'}&theme=dark&style=${tvStyle}&locale=en&toolbar_bg=%230b0e11&withdateranges=1&hide_side_toolbar=0&allow_symbol_change=0&save_image=0&show_popup_button=0`}
              width="100%"
              height={chatCollapsed ? '520' : '420'}
              style={{ border: 'none', display: 'block' }}
              allowFullScreen
              title="TradingView Chart"
            />
          </div>
        </div>

        {/* FinChat panel */}
        {!chatCollapsed && (
          <FinChatPanel
            pair={pair} livePrice={livePrice} liveChange={liveChange}
            collapsed={false} onToggle={() => setChatCollapsed(true)}
          />
        )}

        {/* Collapsed FinChat strip */}
        {chatCollapsed && (
          <div className="hidden lg:flex items-center justify-center">
            <button onClick={() => setChatCollapsed(false)}
              className="flex flex-col items-center gap-2 bg-[#161a1e] border border-[#2b3139] hover:border-[#f0b90b]/30 rounded-xl px-3 py-4 transition text-[#848e9c] hover:text-[#eaecef]"
              title="Expand FinChat">
              <MessageSquare size={14} className="text-[#f0b90b]" />
              <span className="text-[9px] font-semibold tracking-widest" style={{ writingMode: 'vertical-rl' }}>FinChat</span>
            </button>
          </div>
        )}
      </div>

      {/* ── OctaFX-style Order Form ─────────────────────────────────── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        {/* Collapsible header */}
        <button type="button" onClick={() => setOrderFormCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1e2329] transition border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${side === 'buy' ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`} />
            <span className="text-xs font-semibold text-[#eaecef]">Order Form</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${side === 'buy' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
              {side === 'buy' ? 'BUY' : 'SELL'} · {orderType}
            </span>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); setOrderFormCollapsed(v => !v) }}
            className="p-1 rounded-lg hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition">
            {orderFormCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </button>

        {!orderFormCollapsed && (
      <form onSubmit={handleTrade} className="p-4">

        {/* Row 1: Buy/Sell + Order type + Route + Balance */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">

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

      {/* ── Order Book (collapsible) ─────────────────────────────────── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <button onClick={() => setShowOrderBook(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1e2329] transition">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#848e9c]">
            <ArrowUpDown size={11} /> Order Book
          </span>
          <span className="text-[10px] text-[#4a5568]">{showOrderBook ? 'hide' : 'show'}</span>
        </button>
        {showOrderBook && (
          <div className="px-4 pb-4">
            <div className="flex justify-between text-[10px] text-[#4a5568] mb-2">
              <span>Price (USDT)</span><span>Size ({asset})</span>
            </div>
            <div className="space-y-0.5">
              {orderBook.asks.slice(0,5).reverse().map((a, i) => (
                <div key={i} className="relative flex justify-between text-[11px] px-0.5 py-1">
                  <div className="absolute inset-0 right-0 bg-[#f6465d]/8 rounded" style={{ width:`${Math.min(a.size/2*100,100)}%`, marginLeft:'auto' }} />
                  <span className="text-[#f6465d] font-mono relative">${a.price.toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                  <span className="text-[#848e9c] font-mono relative">{a.size.toFixed(4)}</span>
                </div>
              ))}
              <div className="py-1.5 text-center text-sm font-bold font-mono text-[#eaecef] bg-[#0b0e11] rounded-lg my-1">
                ${livePrice > 0 ? livePrice.toLocaleString('en-US',{maximumFractionDigits:2}) : '—'}
              </div>
              {orderBook.bids.slice(0,5).map((b, i) => (
                <div key={i} className="relative flex justify-between text-[11px] px-0.5 py-1">
                  <div className="absolute inset-0 bg-[#0ecb81]/8 rounded" style={{ width:`${Math.min(b.size/2*100,100)}%` }} />
                  <span className="text-[#0ecb81] font-mono relative">${b.price.toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                  <span className="text-[#848e9c] font-mono relative">{b.size.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Positions + History ──────────────────────────────────────── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 px-5 py-3 border-b border-[#2b3139]">
          <button onClick={() => setBottomTab('positions')}
            className={`text-xs font-semibold pb-1 border-b-2 transition mr-3 ${bottomTab==='positions' ? 'text-[#eaecef] border-[#f0b90b]' : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'}`}>
            Open Positions {openPositions.length > 0 && (
              <span className="ml-1 bg-[#f0b90b]/20 text-[#f0b90b] text-[10px] px-1.5 py-0.5 rounded-full">{openPositions.length}</span>
            )}
          </button>
          <button onClick={() => setBottomTab('history')}
            className={`text-xs font-semibold pb-1 border-b-2 transition ${bottomTab==='history' ? 'text-[#eaecef] border-[#f0b90b]' : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'}`}>
            Order History
          </button>
          <button onClick={fetchHistory} className="ml-auto text-[#848e9c] hover:text-[#eaecef] transition p-1">
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
              <div className="hidden sm:grid grid-cols-8 gap-2 px-5 py-2 text-[10px] text-[#4a5568] uppercase tracking-widest border-b border-[#2b3139]/50">
                <span>Pair</span><span className="text-right">Entry</span><span className="text-right">Qty</span>
                <span className="text-right">Current</span><span className="text-right">Lev</span>
                <span className="text-right col-span-2">Unrealized P&L</span><span className="text-right">Action</span>
              </div>
              <div className="divide-y divide-[#2b3139]/50 max-h-64 overflow-y-auto">
                {openPositions.map(pos => {
                  const pairFmt  = pos.ticker.replace(/-USD$/, '/USD').replace('-', '/')
                  const pnlColor = pos.unrealized_pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                  const pnlBg   = pos.unrealized_pnl >= 0 ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : 'bg-[#f6465d]/5 border-[#f6465d]/20'
                  const timeStr = pos.created_at ? new Date(pos.created_at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
                  const lev     = pos.leverage ?? 1
                  const pnlPct  = pos.pnl_pct ?? 0
                  return (
                    <div key={pos.id}>
                      <div className={`hidden sm:grid grid-cols-8 gap-2 px-5 py-2.5 text-xs items-center border-l-2 ${pnlBg} border-b border-[#2b3139]/50`}
                        style={{ borderLeftColor: pos.unrealized_pnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                        <span className="font-mono font-semibold text-[#eaecef]">{pairFmt}</span>
                        <span className="font-mono text-right text-[#848e9c]">${(pos.price??0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        <span className="font-mono text-right text-[#eaecef]">{(pos.qty??0).toFixed(6)}</span>
                        <span className="font-mono text-right text-[#eaecef]">${(pos.current_price??0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        <span className="font-mono text-right text-[#f0b90b] text-[11px]">{lev > 1 ? `${lev}x` : '—'}</span>
                        <span className={`font-mono font-semibold text-right col-span-2 ${pnlColor}`}>
                          {pos.unrealized_pnl>=0?'+':''}${pos.unrealized_pnl.toFixed(2)}
                          {lev > 1 && <span className="text-[10px] ml-1 opacity-70">({pnlPct>=0?'+':''}{pnlPct.toFixed(1)}%)</span>}
                        </span>
                        <div className="flex justify-end">
                          <button onClick={() => handleClosePosition(pos.id)} disabled={closingId === pos.id}
                            className="text-[10px] px-2.5 py-1.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg font-semibold transition disabled:opacity-60 flex items-center gap-1">
                            {closingId===pos.id ? <><RefreshCw size={9} className="animate-spin" /> Closing…</> : <><X size={9} /> Close</>}
                          </button>
                        </div>
                      </div>
                      <div className={`sm:hidden px-4 py-3 border-l-2 ${pnlBg}`} style={{ borderLeftColor: pos.unrealized_pnl>=0?'#0ecb81':'#f6465d' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-bold font-mono text-[#eaecef]">{pairFmt}</span>
                            {lev > 1 && <span className="ml-2 text-[10px] font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-1.5 py-0.5 rounded-md">{lev}x</span>}
                            <p className="text-[10px] text-[#848e9c]">{timeStr}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-bold font-mono ${pnlColor}`}>
                              {pos.unrealized_pnl>=0?'+':''}${pos.unrealized_pnl.toFixed(2)}
                            </span>
                            {lev > 1 && <p className={`text-[10px] font-semibold ${pnlColor}`}>{pnlPct>=0?'+':''}{pnlPct.toFixed(1)}% on margin</p>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-[#848e9c] space-y-0.5">
                            <p>Entry: <span className="text-[#eaecef] font-mono">${(pos.price??0).toLocaleString('en-US',{maximumFractionDigits:2})}</span></p>
                            <p>Now: <span className="text-[#eaecef] font-mono">${(pos.current_price??0).toLocaleString('en-US',{maximumFractionDigits:2})}</span></p>
                          </div>
                          <button onClick={() => handleClosePosition(pos.id)} disabled={closingId===pos.id}
                            className="text-xs px-3 py-2 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] rounded-lg font-semibold transition disabled:opacity-60">
                            {closingId===pos.id ? 'Closing…' : 'Close Position'}
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
                <span>Pair</span><span>Side</span><span className="text-right">Price</span>
                <span className="text-right">Amount</span><span className="text-right">Total</span>
                <span>Route</span><span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-[#2b3139]/50 max-h-64 overflow-y-auto">
                {tradeHistory.map(t => {
                  const isBuy   = t.action?.toUpperCase() === 'BUY'
                  const total_v = (t.price??0) * (t.qty??0)
                  const pairFmt = t.ticker?.replace('-', '/') ?? '—'
                  const timeStr = t.created_at ? new Date(t.created_at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
                  const exchLbl = t.exchange==='internal'||t.exchange==='manual' ? 'Balance' : (t.exchange??'—').toUpperCase()
                  return (
                    <div key={t.id}>
                      <div className="hidden sm:grid grid-cols-7 gap-2 px-5 py-2.5 text-xs hover:bg-[#1e2329] transition items-center">
                        <span className="font-mono font-semibold text-[#eaecef]">{pairFmt}</span>
                        <span className={`font-bold flex items-center gap-1 ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {isBuy ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {isBuy ? 'Buy' : 'Sell'}
                        </span>
                        <span className="font-mono text-[#eaecef] text-right">${(t.price??0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        <span className="font-mono text-[#eaecef] text-right">{(t.qty??0).toFixed(6)}</span>
                        <span className={`font-mono text-right font-semibold ${isBuy ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
                          {isBuy?'−':'+'}${total_v.toLocaleString('en-US',{maximumFractionDigits:2})}
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
                            <span className={`text-[10px] font-bold ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{isBuy?'Buy':'Sell'}</span>
                          </div>
                          <span className="text-[10px] text-[#848e9c]">{(t.qty??0).toFixed(6)} @ ${(t.price??0).toLocaleString('en-US',{maximumFractionDigits:2})}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-mono font-semibold ${isBuy ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>{isBuy?'−':'+'}${total_v.toLocaleString('en-US',{maximumFractionDigits:2})}</p>
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
