import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  Zap, History, CalendarDays, Bell, ShoppingBag, Server,
  Newspaper, TrendingUp, Bot, Home, Wallet, KeyRound,
  MessageSquare, Crown, Settings, Store, Link2, BarChart2,
  ChevronLeft, ChevronRight, Lock, Grid2X2,
} from 'lucide-react'
import { getAllActiveAds } from '../lib/api'
import toast from 'react-hot-toast'

interface Ad { id: number; title: string; description: string; image_base64: string; link_url: string; ad_type: string }

const MORE_ACTIONS = [
  { label: 'Signals',    icon: Zap,           path: '/app/recommendations', pro: false },
  { label: 'History',    icon: History,        path: '/app/transactions',    pro: false },
  { label: 'Calendar',   icon: CalendarDays,   path: '/app/calendar',        pro: true  },
  { label: 'Alerts',     icon: Bell,           path: '/app/alerts',          pro: true  },
  { label: 'Buy Asset',  icon: ShoppingBag,    path: '/app/store',           pro: false },
  { label: 'Rent VPS',   icon: Server,         path: '/app/store',           pro: false },
  { label: 'AI Events',  icon: BarChart2,      path: '/app/dashboard',       pro: false },
  { label: 'News',       icon: Newspaper,      path: '/app/news',            pro: false },
  { label: 'Trades',     icon: TrendingUp,     path: '/app/trade',           pro: false },
  { label: 'FIN BOT',    icon: Bot,            path: '/app/bots',            pro: false },
  { label: 'Dashboard',  icon: Home,           path: '/app/dashboard',       pro: false },
  { label: 'Wallet',     icon: Wallet,         path: '/app/wallet',          pro: false },
  { label: 'FinApi',     icon: KeyRound,       path: '/app/profile',         pro: false },
  { label: 'Store',      icon: Store,          path: '/app/store',           pro: false },
  { label: 'Chat Fin',   icon: MessageSquare,  path: '/app/chat',            pro: false },
  { label: 'Notify',     icon: Bell,           path: '/app/notifications',   pro: false },
  { label: 'Settings',   icon: Settings,       path: '/app/settings',        pro: false },
  { label: 'Support',    icon: MessageSquare,  path: '/app/support',         pro: false },
  { label: 'Pricing',    icon: Crown,          path: '/app/pricing',         pro: false },
  { label: 'Markets',    icon: Grid2X2,        path: '/app/markets',         pro: false },
]

export default function MorePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isPro = (user?.account_tier ?? 0) >= 1

  const [ads, setAds] = useState<Ad[]>([])
  const [adIdx, setAdIdx] = useState(0)
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAds = useCallback(async () => {
    try {
      const res = await getAllActiveAds()
      const all: Ad[] = Array.isArray(res.data) ? res.data : []
      const moreBanners = all.filter(a => a.ad_type === 'more-banner')
      setAds(moreBanners.length > 0 ? moreBanners : all)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchAds() }, [fetchAds])

  useEffect(() => {
    if (ads.length <= 1) return
    slideTimer.current = setInterval(() => {
      setAdIdx(i => (i + 1) % ads.length)
    }, 50000)
    return () => { if (slideTimer.current) clearInterval(slideTimer.current) }
  }, [ads.length])

  const ad = ads[adIdx]

  const handleAction = (path: string, pro: boolean) => {
    if (pro && !isPro) {
      toast.error('This feature requires a Pro subscription')
      navigate('/app/pricing')
      return
    }
    navigate(path)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#eaecef]">More</h1>

      {/* Ads sliding card */}
      {ads.length > 0 && (
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e2329 0%, #161a1e 60%, #1a1d23 100%)',
            borderBottom: '1px solid #2b3139',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(ellipse at top left, rgba(240,185,11,0.12) 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            {ad.image_base64 ? (
              <div className="relative">
                <img
                  src={ad.image_base64}
                  alt={ad.title}
                  className="w-full object-cover rounded-2xl"
                  style={{ maxHeight: 200 }}
                  onClick={() => { if (ad.link_url) window.open(ad.link_url, '_blank') }}
                />
                {(ad.title || ad.description) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 rounded-b-2xl">
                    {ad.title && <p className="text-sm font-bold text-white">{ad.title}</p>}
                    {ad.description && <p className="text-xs text-white/70 mt-0.5">{ad.description}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-6">
                <p className="text-sm font-bold text-[#eaecef]">{ad.title}</p>
                {ad.description && <p className="text-xs text-[#848e9c] mt-1">{ad.description}</p>}
                {ad.link_url && (
                  <a href={ad.link_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-[#f0b90b] hover:underline">
                    <Link2 size={10} /> {ad.link_url}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Slide controls */}
          {ads.length > 1 && (
            <div className="absolute bottom-2 right-3 flex items-center gap-1.5 z-10">
              <button
                onClick={() => setAdIdx(i => (i - 1 + ads.length) % ads.length)}
                className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                <ChevronLeft size={11} className="text-white" />
              </button>
              <div className="flex gap-1">
                {ads.map((_, i) => (
                  <button key={i} onClick={() => setAdIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === adIdx ? 'bg-[#f0b90b] w-3' : 'bg-white/40'}`} />
                ))}
              </div>
              <button
                onClick={() => setAdIdx(i => (i + 1) % ads.length)}
                className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                <ChevronRight size={11} className="text-white" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* More Actions grid — 5 per row */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4">
        <p className="text-xs font-bold text-[#eaecef] mb-3">More Actions</p>
        <div className="grid grid-cols-5 gap-2">
          {MORE_ACTIONS.map(({ label, icon: Icon, path, pro }) => (
            <button
              key={label}
              onClick={() => handleAction(path, pro)}
              className="relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1e2329] hover:bg-[#252d35] active:scale-95 transition border border-[#2b3139] hover:border-[#f0b90b]/20"
            >
              {pro && !isPro && (
                <div className="absolute top-1 right-1">
                  <Lock size={7} className="text-[#f0b90b]" />
                </div>
              )}
              <Icon size={17} className={pro && !isPro ? 'text-[#848e9c]' : 'text-[#f0b90b]'} />
              <span className="text-[9px] text-[#848e9c] text-center font-medium leading-tight px-0.5">{label}</span>
            </button>
          ))}
        </div>
        {!isPro && (
          <button onClick={() => navigate('/app/pricing')}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#f0b90b]/20 bg-[#f0b90b]/5 text-xs text-[#f0b90b] hover:bg-[#f0b90b]/10 transition">
            <Crown size={11} />
            <span>Unlock Pro for Calendar &amp; Alerts</span>
          </button>
        )}
      </div>
    </div>
  )
}
