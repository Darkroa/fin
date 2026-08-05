import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Bot, Plus, MessageSquare, Trash2, Lock, ChevronLeft, Zap, Clock,
  ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useLanguage } from '../contexts/LanguageContext'
import { submitChatFeedback } from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'ai'; text: string; time: string; msgId?: string; feedback?: 'like' | 'dislike' | null }
interface Conversation { id: string; title: string; messages: Message[]; createdAt: string }

// ── Response styler ───────────────────────────────────────────────────────────
const BEAR_RE = /\b(sell|short|bearish|resistance|stop.?loss|stop|breakdown|downtrend|decline|drop|fall|risk|warn(?:ing)?|caution|overbought|reversal|reject(?:ion)?|lower)\b/gi
const BULL_RE = /\b(buy|long|bullish|support|breakout|uptrend|rally|rise|profit|target|strong|momentum|accumulate|oversold|opportunity|bounce)\b/gi
const NUM_RE  = /(\$[\d,]+(?:\.\d+)?[KkMmBbTt]?|[\d,]+(?:\.\d+)?%|\b[\d]{1,3}(?:,\d{3})*(?:\.\d+)?\b)/g

function styleLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let key = 0

  const COMBINED = new RegExp(`(${NUM_RE.source})|(${BEAR_RE.source})|(${BULL_RE.source})`, 'gi')
  let lastIndex = 0
  let m: RegExpExecArray | null
  COMBINED.lastIndex = 0

  while ((m = COMBINED.exec(line)) !== null) {
    if (m.index > lastIndex) parts.push(<span key={key++}>{line.slice(lastIndex, m.index)}</span>)
    const match = m[0]
    NUM_RE.lastIndex = 0; BEAR_RE.lastIndex = 0; BULL_RE.lastIndex = 0
    if (NUM_RE.test(match)) {
      parts.push(<span key={key++} style={{ color: '#f0b90b', fontWeight: 600 }}>{match}</span>)
    } else if (BEAR_RE.test(match)) {
      parts.push(<span key={key++} style={{ color: '#f6465d', fontWeight: 600 }}>{match}</span>)
    } else {
      parts.push(<span key={key++} style={{ color: '#0ecb81', fontWeight: 600 }}>{match}</span>)
    }
    NUM_RE.lastIndex = 0; BEAR_RE.lastIndex = 0; BULL_RE.lastIndex = 0
    lastIndex = COMBINED.lastIndex
  }
  if (lastIndex < line.length) parts.push(<span key={key++}>{line.slice(lastIndex)}</span>)
  return <>{parts}</>
}

function parseBoldInline(raw: string): React.ReactNode {
  const boldRe = /\*\*(.+?)\*\*/g
  const segments: Array<{ bold: boolean; text: string }> = []
  let last = 0; let m: RegExpExecArray | null
  while ((m = boldRe.exec(raw)) !== null) {
    if (m.index > last) segments.push({ bold: false, text: raw.slice(last, m.index) })
    segments.push({ bold: true, text: m[1] })
    last = boldRe.lastIndex
  }
  if (last < raw.length) segments.push({ bold: false, text: raw.slice(last) })
  return (
    <>
      {segments.map((s, i) =>
        s.bold
          ? <span key={i} style={{ color: '#f0b90b', fontWeight: 700 }}>{s.text}</span>
          : <span key={i}>{styleLine(s.text)}</span>
      )}
    </>
  )
}

function StyledResponse({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="text-sm text-[#eaecef] leading-relaxed space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // ### H3 header
        if (/^###\s+/.test(trimmed)) {
          const heading = trimmed.replace(/^###\s+/, '')
          return (
            <div key={i} className="flex items-center gap-2 mt-3 mb-1 pb-1 border-b border-[#f0b90b]/20">
              <span className="text-[#f0b90b] font-bold text-xs tracking-wide">{parseBoldInline(heading)}</span>
            </div>
          )
        }

        // ## H2 / # H1 / ─── / ━━━ section dividers
        if (/^[━─#]+/.test(trimmed) && trimmed.length < 80) {
          const heading = trimmed.replace(/^[━─#*\s]+/, '').replace(/[━─#*\s]+$/, '')
          if (!heading) return <div key={i} className="h-px bg-[#2b3139] my-2" />
          return (
            <div key={i} className="text-[#f0b90b] font-bold text-xs tracking-wide mt-3 mb-1 border-b border-[#2b3139] pb-0.5">
              {parseBoldInline(heading)}
            </div>
          )
        }

        // Key | Value row (e.g. "Entry Zone: | $63,000" or "Support Level | $60,000")
        if (/\|/.test(trimmed) && !/^[|─]+$/.test(trimmed)) {
          const [rawKey, ...rest] = trimmed.split('|')
          const key = rawKey.replace(/^[•\-*·\s]+/, '').replace(/:$/, '').trim()
          const val = rest.join('|').trim().replace(/^:?\s*/, '')
          if (key && val) {
            return (
              <div key={i} className="flex items-baseline justify-between gap-2 py-0.5 border-b border-[#2b3139]/40">
                <span className="text-[10px] text-[#848e9c] flex-shrink-0">{key}</span>
                <span className="text-xs font-semibold text-right">{styleLine(val)}</span>
              </div>
            )
          }
        }

        // "Key: Value" rows (label with colon and non-empty value on same line)
        const kvMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9\s\/&-]{2,30}):\s+(.+)$/)
        if (kvMatch && !kvMatch[1].includes('  ')) {
          const [, k, v] = kvMatch
          return (
            <div key={i} className="flex items-baseline justify-between gap-2 py-0.5">
              <span className="text-[10px] text-[#848e9c] flex-shrink-0">{k}</span>
              <span className="text-xs font-semibold text-right">{parseBoldInline(v)}</span>
            </div>
          )
        }

        // Bullet lines
        if (/^[\s]*[•\-*·]\s/.test(line)) {
          const content = line.replace(/^[\s]*[•\-*·]\s/, '')
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-[#f0b90b] flex-shrink-0 mt-0.5">·</span>
              <span>{parseBoldInline(content)}</span>
            </div>
          )
        }

        // Empty line
        if (trimmed === '') return <div key={i} className="h-1.5" />

        // All-caps label ending with colon (e.g. "TRADE IDEA:")
        if (/^[A-Z][A-Z\s\/&(🧠📑)]{3,}:?\s*$/.test(trimmed)) {
          return (
            <div key={i} className="text-[#f0b90b] font-bold text-xs tracking-wide mt-3 mb-1 border-b border-[#2b3139] pb-0.5">
              {trimmed}
            </div>
          )
        }

        // Normal line
        return (
          <div key={i} className="text-[#eaecef]">
            {parseBoldInline(line)}
          </div>
        )
      })}
    </div>
  )
}

interface SessionInfo   { tokyo: boolean; london: boolean; new_york: boolean }
interface DateInfo      { utc: string; day: string; is_weekend: boolean; sessions: SessionInfo }

const QUICK_CHIPS = [
  'BTC analysis right now',
  'What time is it and what session is open?',
  'EUR/USD outlook today',
  'S&P 500 — buy or sell?',
  'Gold XAU/USD analysis',
  'WTI Oil price and trend',
  'Best crypto to trade this session',
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeId()  { return Math.random().toString(36).slice(2) }
function makeTitle(msg: string) { return msg.slice(0, 40) + (msg.length > 40 ? '…' : '') }

const WELCOME: Message = {
  role: 'ai',
  text: "Hello! I'm Chat Fin — your AI financial assistant with live market data. I know today's date, time, open trading sessions, live crypto prices, FX rates, and stock indexes. Ask me anything!",
  time: new Date().toLocaleTimeString(),
}

const MAX_CONVOS = 20                  // cap stored conversations
const MAX_MESSAGES_PER_CONVO = 100

function loadConversations(): Conversation[] {
  try {
    const raw = JSON.parse(localStorage.getItem('chatfin-convos') || '[]')
    if (!Array.isArray(raw)) return []
    return raw.slice(-MAX_CONVOS).map((c) => ({
      ...c,
      messages: Array.isArray(c.messages) ? c.messages.slice(-MAX_MESSAGES_PER_CONVO) : [],
    }))
  } catch {
    return []
  }
}
function saveConversations(c: Conversation[]) {
  // Trim before persisting so the storage entry can't grow unbounded.
  const trimmed = c.slice(-MAX_CONVOS).map((conv) => ({
    ...conv,
    messages: (conv.messages || []).slice(-MAX_MESSAGES_PER_CONVO),
  }))
  localStorage.setItem('chatfin-convos', JSON.stringify(trimmed))
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ChatFinPage() {
  const navigate = useNavigate()
  const { token, user } = useAuthStore()
  const { t }   = useLanguage()
  const isSubscriber = (user?.account_tier ?? 0) >= 1

  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [activeId, setActiveId] = useState<string | null>(() => {
    const s = loadConversations(); return s.length > 0 ? s[0].id : null
  })
  const [input,  setInput]  = useState('')
  const [typing, setTyping] = useState(false)

  // Date/time state (from backend)
  const [dateInfo,    setDateInfo]    = useState<DateInfo | null>(null)
  const [mktLoading,  setMktLoading]  = useState(true)

  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeConvo = conversations.find(c => c.id === activeId) ?? null
  const messages    = activeConvo?.messages ?? [WELCOME]

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  // ── Fetch all market data ──
  const fetchMarketData = useCallback(async () => {
    setMktLoading(true)
    try {
      const extRes  = await fetch('/api/public/market-extended')
      const extData = await extRes.json()
      if (extData?.datetime) setDateInfo(extData.datetime)
    } catch {
      /* keep stale data */
    } finally {
      setMktLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMarketData()
    const id = setInterval(fetchMarketData, 60_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation helpers ──
  const persistConvos = useCallback((c: Conversation[]) => { setConversations(c); saveConversations(c) }, [])

  const newConversation = useCallback(() => {
    const id = makeId()
    persistConvos([{ id, title: 'New conversation', messages: [{ ...WELCOME, time: new Date().toLocaleTimeString() }], createdAt: new Date().toISOString() }, ...conversations])
    setActiveId(id)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [conversations, persistConvos])

  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter(c => c.id !== id)
    persistConvos(updated)
    if (activeId === id) setActiveId(updated[0]?.id ?? null)
  }, [conversations, activeId, persistConvos])

  // ── Send message ──
  const sendMessage = async (text: string) => {
    const q = text.trim()
    if (!q) return
    setInput('')

    const userMsg: Message = { role: 'user', text: q, time: new Date().toLocaleTimeString() }
    let targetId      = activeId
    let updatedConvos = [...conversations]

    if (!targetId) {
      const id = makeId()
      updatedConvos = [{ id, title: makeTitle(q), messages: [{ ...WELCOME, time: new Date().toLocaleTimeString() }, userMsg], createdAt: new Date().toISOString() }, ...updatedConvos]
      persistConvos(updatedConvos)
      setActiveId(id)
      targetId = id
    } else {
      updatedConvos = updatedConvos.map(c => {
        if (c.id !== targetId) return c
        const isFirst = c.messages.filter(m => m.role === 'user').length === 0
        return { ...c, title: isFirst ? makeTitle(q) : c.title, messages: [...c.messages, userMsg] }
      })
      persistConvos(updatedConvos)
    }

    setTyping(true)
    try {
      const body: Record<string, unknown> = { message: q }
      const res  = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      const aiMsg: Message = { role: 'ai', text: data.reply || 'Sorry, I could not process that.', time: new Date().toLocaleTimeString() }
      updatedConvos = updatedConvos.map(c => c.id === targetId ? { ...c, messages: [...c.messages, aiMsg] } : c)
      persistConvos(updatedConvos)
    } catch {
      const errMsg: Message = { role: 'ai', text: 'Connection error — please try again.', time: new Date().toLocaleTimeString() }
      updatedConvos = updatedConvos.map(c => c.id === targetId ? { ...c, messages: [...c.messages, errMsg] } : c)
      persistConvos(updatedConvos)
    } finally { setTyping(false) }
  }

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input) }

  const handleFeedback = useCallback(async (msgIdx: number, fb: 'like' | 'dislike') => {
    if (!activeId) return
    const hash = (() => {
      const msg = (conversations.find(c => c.id === activeId)?.messages ?? [])[msgIdx]
      if (!msg) return ''
      let h = 0
      const s = msg.text.slice(0, 200)
      for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
      return Math.abs(h).toString(36) + s.length.toString(36)
    })()
    const updated = conversations.map(c => {
      if (c.id !== activeId) return c
      return { ...c, messages: c.messages.map((m, i) => i === msgIdx ? { ...m, feedback: m.feedback === fb ? null : fb } : m) }
    })
    persistConvos(updated)
    try { await submitChatFeedback(hash, fb) } catch { /* silent */ }
  }, [activeId, conversations, persistConvos])

  // ── Paywall ──
  if (!isSubscriber) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center mx-auto mb-5">
            <Lock size={28} className="text-[#f0b90b]" />
          </div>
          <h2 className="text-lg font-bold text-[#eaecef] mb-2">Chat Fin is available to subscribers</h2>
          <p className="text-sm text-[#848e9c] leading-relaxed mb-6">
            Upgrade your account to unlock Chat Fin — your AI financial assistant for real-time market analysis, trading signals, and strategy advice.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => navigate('/app/pricing')}
              className="inline-flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-6 py-2.5 rounded-xl text-sm transition">
              <Zap size={14} /> See Pricing &amp; Upgrade
            </button>
            <button onClick={() => navigate('/app/support')}
              className="inline-flex items-center justify-center text-xs text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139] px-4 py-2.5 rounded-xl transition">
              Contact support
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Session badge helper ──
  const sessionBadges = dateInfo ? [
    { label: 'Tokyo',    open: dateInfo.sessions.tokyo    },
    { label: 'London',   open: dateInfo.sessions.london   },
    { label: 'New York', open: dateInfo.sessions.new_york },
  ] : []

  return (
    <div className="fixed inset-x-0 flex flex-col bg-[#0b0e11] z-20" style={{ top: '56px', bottom: '56px' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#2b3139] bg-[#0b0e11] flex-shrink-0">
        <button onClick={() => navigate('/app/dashboard')}
          className="flex items-center gap-1 text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium">
          <ChevronLeft size={16} /><span>{t('chat.dashboard')}</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#f0b90b] flex items-center justify-center">
            <Bot size={12} className="text-black" />
          </div>
          <p className="text-sm font-bold text-[#eaecef]">Chat Fin</p>
          <span className="w-1.5 h-1.5 bg-[#0ecb81] rounded-full animate-pulse" />
        </div>
        <button onClick={newConversation}
          className="flex items-center gap-1 text-xs text-[#f0b90b] border border-[#f0b90b]/30 bg-[#f0b90b]/10 px-3 py-1.5 rounded-xl hover:bg-[#f0b90b]/20 transition">
          <Plus size={12} /> {t('btn.newchat')}
        </button>
      </div>

      {/* ── Date / Session strip ── */}
      {(dateInfo || mktLoading) && (
        <div className="flex-shrink-0 bg-[#161a1e] border-b border-[#2b3139] px-3 py-1.5 flex items-center gap-3 overflow-x-auto scrollbar-none">
          {mktLoading && !dateInfo ? (
            <div className="h-4 w-40 bg-[#2b3139] rounded animate-pulse" />
          ) : dateInfo && (
            <>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock size={9} className="text-[#848e9c]" />
                <span className="text-[10px] text-[#848e9c]">{dateInfo.utc} UTC · {dateInfo.day}</span>
              </div>
              {sessionBadges.map(s => (
                <span key={s.label}
                  className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.open ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#2b3139] text-[#4a5568]'}`}>
                  {s.label} {s.open ? '●' : '○'}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar — desktop only */}
        <aside className="hidden sm:flex w-56 flex-shrink-0 bg-[#161a1e] border-r border-[#2b3139] flex-col">
          <div className="flex-1 overflow-y-auto py-2">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <MessageSquare size={20} className="text-[#2b3139]" />
                <p className="text-xs text-[#848e9c]">No conversations yet</p>
              </div>
            )}
            {conversations.map(convo => (
              <div key={convo.id}
                className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition mb-0.5 ${
                  activeId === convo.id ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20' : 'hover:bg-[#2b3139]/60'
                }`}
                onClick={() => setActiveId(convo.id)}>
                <MessageSquare size={13} className={activeId === convo.id ? 'text-[#f0b90b] flex-shrink-0' : 'text-[#848e9c] flex-shrink-0'} />
                <p className={`text-xs flex-1 truncate ${activeId === convo.id ? 'text-[#eaecef] font-medium' : 'text-[#848e9c]'}`}>
                  {convo.title}
                </p>
                <button onClick={e => { e.stopPropagation(); deleteConversation(convo.id) }}
                  className="opacity-0 group-hover:opacity-100 transition text-[#4a5568] hover:text-[#f6465d] flex-shrink-0">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e11]">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

            {/* Quick chips — only on fresh conversation */}
            {messages.filter(m => m.role === 'user').length === 0 && (
              <div className="pb-2">
                <p className="text-[10px] text-[#4a5568] mb-2 text-center">Suggested questions</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {QUICK_CHIPS.map(chip => (
                    <button key={chip} onClick={() => sendMessage(chip)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/40 hover:text-[#eaecef] hover:bg-[#f0b90b]/5 transition">
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-[#f0b90b] flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <Bot size={13} className="text-black" />
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user' ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20' : 'bg-[#1e2329] border border-[#2b3139]'
                  }`}>
                    {msg.role === 'ai'
                      ? <StyledResponse text={msg.text} />
                      : <p className="text-sm text-[#eaecef] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    }
                    <p className="text-[9px] text-[#4a5568] mt-1">{msg.time}</p>
                  </div>
                </div>
                {/* Like / dislike (AI messages only, not the welcome message) */}
                {msg.role === 'ai' && i > 0 && (
                  <div className="flex items-center gap-1.5 ml-9 mt-1.5">
                    <button onClick={() => handleFeedback(i, 'like')}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition ${
                        msg.feedback === 'like'
                          ? 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/30 font-medium'
                          : 'text-[#4a5568] hover:text-[#0ecb81] hover:bg-[#0ecb81]/10 border-transparent'
                      }`}>
                      <ThumbsUp size={10} />
                      {msg.feedback === 'like' && <span>Helpful</span>}
                    </button>
                    <button onClick={() => handleFeedback(i, 'dislike')}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition ${
                        msg.feedback === 'dislike'
                          ? 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30 font-medium'
                          : 'text-[#4a5568] hover:text-[#f6465d] hover:bg-[#f6465d]/10 border-transparent'
                      }`}>
                      <ThumbsDown size={10} />
                      {msg.feedback === 'dislike' && <span>Not helpful</span>}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-[#f0b90b] flex items-center justify-center mr-2 flex-shrink-0">
                  <Bot size={13} className="text-black" />
                </div>
                <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-[#848e9c] rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-[#2b3139] px-4 pt-3 pb-3 bg-[#161a1e] flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                placeholder={t('chat.placeholder')}
                className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
              <button type="submit" disabled={typing || !input.trim()}
                className="w-12 h-12 flex items-center justify-center bg-[#f0b90b] hover:bg-[#d9a60b] disabled:opacity-50 text-black rounded-xl transition flex-shrink-0">
                <Send size={16} />
              </button>
            </form>
            <p className="text-[10px] text-[#4a5568] text-center mt-2">
              {t('chat.disclaimer')} ·{' '}
              <a href="mailto:supportfinaibot@gmail.com" className="hover:text-[#848e9c] transition">
                supportfinaibot@gmail.com
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
