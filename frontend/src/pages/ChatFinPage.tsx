import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, Zap, Plus, MessageSquare, Trash2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Message {
  role: 'user' | 'ai'
  text: string
  time: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

function makeTitle(firstMsg: string) {
  return firstMsg.slice(0, 40) + (firstMsg.length > 40 ? '…' : '')
}

const WELCOME: Message = {
  role: 'ai',
  text: "Hello! I'm Chat Fin — your AI financial assistant. Ask me about market signals, trading strategies, portfolio analysis, or anything finance-related.",
  time: new Date().toLocaleTimeString(),
}

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem('chatfin-convos') || '[]')
  } catch {
    return []
  }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem('chatfin-convos', JSON.stringify(convos))
}

export default function ChatFinPage() {
  const navigate = useNavigate()
  const { token, user } = useAuthStore()
  const isSubscriber = (user?.account_tier ?? 0) >= 1
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadConversations()
    return saved.length > 0 ? saved[0].id : null
  })
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeConvo = conversations.find(c => c.id === activeId) ?? null
  const messages = activeConvo?.messages ?? [WELCOME]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const persistConvos = useCallback((convos: Conversation[]) => {
    setConversations(convos)
    saveConversations(convos)
  }, [])

  const newConversation = useCallback(() => {
    const id = makeId()
    const convo: Conversation = {
      id,
      title: 'New conversation',
      messages: [{ ...WELCOME, time: new Date().toLocaleTimeString() }],
      createdAt: new Date().toISOString(),
    }
    const updated = [convo, ...conversations]
    persistConvos(updated)
    setActiveId(id)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [conversations, persistConvos])

  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter(c => c.id !== id)
    persistConvos(updated)
    if (activeId === id) setActiveId(updated[0]?.id ?? null)
  }, [conversations, activeId, persistConvos])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg: Message = { role: 'user', text: input, time: new Date().toLocaleTimeString() }
    const q = input
    setInput('')

    let targetId = activeId
    let updatedConvos = [...conversations]

    if (!targetId) {
      const id = makeId()
      const convo: Conversation = {
        id,
        title: makeTitle(q),
        messages: [{ ...WELCOME, time: new Date().toLocaleTimeString() }, userMsg],
        createdAt: new Date().toISOString(),
      }
      updatedConvos = [convo, ...updatedConvos]
      persistConvos(updatedConvos)
      setActiveId(id)
      targetId = id
    } else {
      updatedConvos = updatedConvos.map(c => {
        if (c.id !== targetId) return c
        const isFirst = c.messages.filter(m => m.role === 'user').length === 0
        return {
          ...c,
          title: isFirst ? makeTitle(q) : c.title,
          messages: [...c.messages, userMsg],
        }
      })
      persistConvos(updatedConvos)
    }

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
      const data = await res.json()
      const aiMsg: Message = {
        role: 'ai',
        text: data.reply || 'Sorry, I could not process that.',
        time: new Date().toLocaleTimeString(),
      }
      updatedConvos = updatedConvos.map(c =>
        c.id === targetId ? { ...c, messages: [...c.messages, aiMsg] } : c
      )
      persistConvos(updatedConvos)
    } catch {
      const errMsg: Message = {
        role: 'ai',
        text: 'Connection error — please try again.',
        time: new Date().toLocaleTimeString(),
      }
      updatedConvos = updatedConvos.map(c =>
        c.id === targetId ? { ...c, messages: [...c.messages, errMsg] } : c
      )
      persistConvos(updatedConvos)
    } finally {
      setTyping(false)
    }
  }

  const unreadDot = (convo: Conversation) => {
    const last = convo.messages[convo.messages.length - 1]
    return last?.role === 'ai' && convo.id !== activeId
  }

  if (!isSubscriber) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center mx-auto mb-5">
            <Lock size={28} className="text-[#f0b90b]" />
          </div>
          <h2 className="text-lg font-bold text-[#eaecef] mb-2">
            FinAi is available to subscribers
          </h2>
          <p className="text-sm text-[#848e9c] leading-relaxed mb-6">
            Upgrade your account to unlock the full power of FinAi — your AI-powered financial assistant for real-time market analysis, trading signals, and strategy advice.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-[#f0b90b]/20"
            >
              <Zap size={14} />
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
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] -mx-4 sm:-mx-5 lg:-mx-6 -mt-4 sm:-mt-5 lg:-mt-6">

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#161a1e] border-r border-[#2b3139] flex flex-col hidden sm:flex">
        {/* Logo header */}
        <div className="h-16 flex items-center justify-center border-b border-[#2b3139] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f0b90b] flex items-center justify-center">
              <Zap size={16} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-lg tracking-tight">Chat Fin</span>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3 border-b border-[#2b3139]">
          <button onClick={newConversation}
            className="w-full flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d9a60b] text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition">
            <Plus size={14} /> New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <MessageSquare size={20} className="text-[#2b3139]" />
              <p className="text-xs text-[#848e9c]">No conversations yet</p>
            </div>
          )}
          {conversations.map(convo => (
            <div key={convo.id}
              className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition mb-0.5 ${activeId === convo.id ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20' : 'hover:bg-[#2b3139]/60'}`}
              onClick={() => setActiveId(convo.id)}>
              <div className="relative flex-shrink-0">
                <MessageSquare size={14} className={activeId === convo.id ? 'text-[#f0b90b]' : 'text-[#848e9c]'} />
                {unreadDot(convo) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#0ecb81] rounded-full" />
                )}
              </div>
              <p className={`text-xs flex-1 truncate ${activeId === convo.id ? 'text-[#eaecef] font-medium' : 'text-[#848e9c]'}`}>
                {convo.title}
              </p>
              <button
                onClick={e => { e.stopPropagation(); deleteConversation(convo.id) }}
                className="opacity-0 group-hover:opacity-100 transition text-[#4a5568] hover:text-[#f6465d]">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div className="h-16 border-b border-[#2b3139] bg-[#161a1e] flex items-center justify-center flex-shrink-0 relative">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f0b90b] flex items-center justify-center">
              <Bot size={16} className="text-black" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-[#eaecef]">Chat Fin</p>
              <div className="flex items-center gap-1 justify-center">
                <span className="w-1.5 h-1.5 bg-[#0ecb81] rounded-full animate-pulse" />
                <span className="text-[10px] text-[#0ecb81]">AI Online</span>
              </div>
            </div>
          </div>
          {/* Mobile new chat */}
          <button onClick={newConversation}
            className="absolute right-4 sm:hidden flex items-center gap-1.5 text-xs text-[#f0b90b] border border-[#f0b90b]/30 bg-[#f0b90b]/10 px-3 py-1.5 rounded-xl">
            <Plus size={12} /> New
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-[#f0b90b] flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                  <Bot size={13} className="text-black" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.role === 'user'
                ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20'
                : 'bg-[#1e2329] border border-[#2b3139]'}`}>
                <p className="text-sm text-[#eaecef] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <p className="text-[9px] text-[#4a5568] mt-1">{msg.time}</p>
              </div>
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
                    <span key={d} className="w-1.5 h-1.5 bg-[#848e9c] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2b3139] p-4 bg-[#161a1e]">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about markets, strategies, signals..."
              className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition"
            />
            <button type="submit" disabled={typing || !input.trim()}
              className="px-4 py-3 bg-[#f0b90b] hover:bg-[#d9a60b] disabled:opacity-50 text-black rounded-xl transition font-semibold">
              <Send size={16} />
            </button>
          </form>
          <p className="text-[10px] text-[#4a5568] text-center mt-2">Chat Fin is AI-powered · Not financial advice · <a href="mailto:supportfinaibot@gmail.com" className="hover:text-[#848e9c] transition">supportfinaibot@gmail.com</a></p>
        </div>
      </div>
    </div>
  )
}
