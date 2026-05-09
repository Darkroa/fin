import { useState, useRef, useEffect } from 'react'
import { Zap, X, TrendingUp, TrendingDown, Activity, Send, Bot, ChevronDown } from 'lucide-react'
import { useLivePrices } from '../hooks/useLivePrices'

interface Message { role: 'user' | 'ai'; text: string; time: string }

const AI_SIGNALS = [
  { ticker: 'BTC/USDT', signal: 'BUY', confidence: 78, reason: 'Bullish engulfing + RSI oversold bounce at $66,800 support.' },
  { ticker: 'ETH/USDT', signal: 'HOLD', confidence: 61, reason: 'Consolidation phase. Watch $3,400 for breakout confirmation.' },
  { ticker: 'NVDA',     signal: 'BUY', confidence: 84, reason: 'Strong earnings beat. Momentum intact above 20-day EMA.' },
  { ticker: 'SPY',      signal: 'HOLD', confidence: 55, reason: 'Mixed macro signals. Neutral stance ahead of FOMC.' },
]

const AI_RESPONSES = [
  (q: string) => `Based on current market conditions, ${q.includes('BTC') ? 'Bitcoin' : 'the market'} shows ${Math.random() > 0.5 ? 'bullish' : 'mixed'} signals. My models suggest watching key support levels before entering positions.`,
  (q: string) => `Analyzing your query: "${q}" — Current AI signals indicate moderate risk. Diversification across assets is recommended.`,
  (q: string) => `For "${q}", technical analysis shows RSI at ${Math.floor(Math.random() * 40 + 40)} with MACD convergence. Short-term outlook is ${Math.random() > 0.5 ? 'positive' : 'cautious'}.`,
]

export default function FloatingAI() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'signals' | 'chat'>('signals')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hello! I\'m your FinAi assistant. Ask me about market signals, trading strategies, or analysis.', time: new Date().toLocaleTimeString() }
  ])
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { btcPrice, btcChange, ethPrice, ethChange } = useLivePrices(60000)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', text: input, time: new Date().toLocaleTimeString() }
    setMessages(m => [...m, userMsg])
    const q = input
    setInput('')
    setTyping(true)
    try {
      const token = localStorage.getItem('finai_token')
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: q }),
      })
      const data = await res.json()
      const aiMsg: Message = { role: 'ai', text: data.reply || 'Sorry, I could not process that.', time: new Date().toLocaleTimeString() }
      setMessages(m => [...m, aiMsg])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Connection error — please try again.', time: new Date().toLocaleTimeString() }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${open ? 'bg-[#2b3139] rotate-0' : 'bg-[#f0b90b] hover:bg-[#d4a30a]'}`}
      >
        {open
          ? <X size={20} className="text-[#eaecef]" />
          : <Zap size={22} className="text-black" />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0ecb81] rounded-full flex items-center justify-center animate-pulse">
            <span className="w-2 h-2 bg-[#0ecb81] rounded-full" />
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#161a1e] border border-[#2b3139] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '70vh', minHeight: 400 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139] bg-[#1e2329]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#f0b90b] flex items-center justify-center">
                <Bot size={14} className="text-black" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#eaecef]">FinAi Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#0ecb81] rounded-full animate-pulse" />
                  <span className="text-[10px] text-[#0ecb81]">Online</span>
                </div>
              </div>
            </div>
            {/* Live prices mini */}
            <div className="text-right text-[10px]">
              <p className="text-[#848e9c]">BTC <span className={`font-mono ${(btcChange ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>${(btcPrice ?? 67432).toLocaleString()}</span></p>
              <p className="text-[#848e9c]">ETH <span className={`font-mono ${(ethChange ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>${(ethPrice ?? 3521).toLocaleString()}</span></p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-[#2b3139]">
            <button onClick={() => setView('signals')}
              className={`flex-1 py-2 text-xs font-medium transition ${view === 'signals' ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
              AI Signals
            </button>
            <button onClick={() => setView('chat')}
              className={`flex-1 py-2 text-xs font-medium transition ${view === 'chat' ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
              Chat
            </button>
          </div>

          {/* Signals view */}
          {view === 'signals' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {AI_SIGNALS.map(s => (
                <div key={s.ticker} className={`rounded-xl p-3 border ${s.signal === 'BUY' ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : s.signal === 'SELL' ? 'bg-[#f6465d]/5 border-[#f6465d]/20' : 'bg-[#f0b90b]/5 border-[#f0b90b]/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#eaecef]">{s.ticker}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.signal === 'BUY' ? 'bg-[#0ecb81]/20 text-[#0ecb81]' : s.signal === 'SELL' ? 'bg-[#f6465d]/20 text-[#f6465d]' : 'bg-[#f0b90b]/20 text-[#f0b90b]'}`}>
                        {s.signal === 'BUY' ? <TrendingUp size={9} className="inline mr-0.5" /> : s.signal === 'SELL' ? <TrendingDown size={9} className="inline mr-0.5" /> : <Activity size={9} className="inline mr-0.5" />}
                        {s.signal}
                      </span>
                      <span className="text-[10px] text-[#848e9c]">{s.confidence}% conf.</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#848e9c] leading-relaxed">{s.reason}</p>
                  {/* Confidence bar */}
                  <div className="mt-2 h-1 bg-[#2b3139] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${s.signal === 'BUY' ? 'bg-[#0ecb81]' : s.signal === 'SELL' ? 'bg-[#f6465d]' : 'bg-[#f0b90b]'}`}
                      style={{ width: `${s.confidence}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-[#4a5568] text-center pt-1">Signals refresh every 60s · Not financial advice</p>
            </div>
          )}

          {/* Chat view */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${msg.role === 'user' ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20' : 'bg-[#1e2329] border border-[#2b3139]'}`}>
                      <p className="text-xs text-[#eaecef] leading-relaxed">{msg.text}</p>
                      <p className="text-[9px] text-[#4a5568] mt-1">{msg.time}</p>
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl px-3 py-2">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-[#848e9c] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#848e9c] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#848e9c] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <form onSubmit={sendMessage} className="p-3 border-t border-[#2b3139] flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} required placeholder="Ask about markets..."
                  className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
                <button type="submit" disabled={typing} className="p-2 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black rounded-xl transition">
                  <Send size={13} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
