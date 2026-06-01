import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Zap, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Message {
  role: 'user' | 'ai'
  text: string
  time: string
}

const WELCOME: Message = {
  role: 'ai',
  text: "Hi! I'm FinAi — your AI financial assistant. Ask me about market signals, strategies, or portfolio analysis.",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}

const SUGGESTIONS = [
  'BTC price outlook?',
  'Best strategy for volatile markets?',
  'Explain RSI to me',
  'How to manage risk?',
]

export default function FinAiChatInline() {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const isSubscriber = (user?.account_tier ?? 0) >= 1

  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendMessage = async (text: string) => {
    const q = text.trim()
    if (!q || typing) return
    setInput('')

    const userMsg: Message = {
      role: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    setTyping(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: q }),
      })
      const data = await res.json() as { reply?: string }
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: data.reply || 'Sorry, I could not process that.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Connection error — please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage(input)
  }

  return (
    <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139] bg-[#0b0e11]/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#f0b90b] flex items-center justify-center">
            <Zap size={13} className="text-black" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#eaecef]">FinAi Assistant</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] inline-block animate-pulse" />
              <span className="text-[9px] text-[#0ecb81]">AI Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/app/chat')}
          className="text-[10px] text-[#848e9c] hover:text-[#f0b90b] transition flex items-center gap-1"
        >
          Open full chat →
        </button>
      </div>

      {/* Paywall for free users */}
      {!isSubscriber ? (
        <div className="px-5 py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center mx-auto mb-3">
            <Lock size={20} className="text-[#f0b90b]" />
          </div>
          <p className="text-sm font-bold text-[#eaecef] mb-1.5">
            FinAi is available to subscribers
          </p>
          <p className="text-xs text-[#848e9c] leading-relaxed mb-5 max-w-xs mx-auto">
            Upgrade your account to unlock the power of FinAi — real-time AI market analysis, signals, and trading advice.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-[#f0b90b]/20"
            >
              <Zap size={13} />
              See Pricing &amp; Upgrade
            </button>
            <button
              onClick={() => navigate('/app/support')}
              className="inline-flex items-center justify-center text-xs text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139] hover:border-[#3c4451] px-4 py-2.5 rounded-xl transition"
            >
              Contact support
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages area */}
          <div className="h-60 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-md bg-[#f0b90b] flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                    <Bot size={11} className="text-black" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20'
                    : 'bg-[#1e2329] border border-[#2b3139]'
                }`}>
                  <p className="text-xs text-[#eaecef] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <p className="text-[9px] text-[#4a5568] mt-0.5">{msg.time}</p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-md bg-[#f0b90b] flex items-center justify-center mr-2 flex-shrink-0">
                  <Bot size={11} className="text-black" />
                </div>
                <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl px-3 py-2.5">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(d => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 bg-[#848e9c] rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick suggestion chips */}
          {messages.length <= 1 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => void sendMessage(s)}
                  className="text-[10px] text-[#848e9c] border border-[#2b3139] hover:border-[#f0b90b]/30 hover:text-[#f0b90b] px-2.5 py-1 rounded-lg transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#2b3139] p-3 bg-[#0b0e11]/30">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about markets, strategies, signals…"
                className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-xs text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition"
              />
              <button
                type="submit"
                disabled={typing || !input.trim()}
                className="px-3 py-2 bg-[#f0b90b] hover:bg-[#d9a60b] disabled:opacity-50 text-black rounded-xl transition"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
