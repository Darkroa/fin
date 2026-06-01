import { useNavigate } from 'react-router-dom'
import {
  Zap, TrendingUp, Shield, BarChart2, Bot, Globe,
  ArrowRight, Activity, Lock, Cpu, Check, Menu, X,
  Star, Crown, Infinity
} from 'lucide-react'
import { useState } from 'react'
import { useTickerPrices } from '../hooks/useTickerPrices'

const features = [
  { icon: Bot,        title: 'AI-Powered Bots',   desc: 'Automated strategies driven by Grok AI that react to live market events in real-time.' },
  { icon: BarChart2,  title: 'Live Market Data',   desc: 'Real-time price feeds for crypto and stocks. Monitor BTC, ETH, SPY, NVDA and more.' },
  { icon: TrendingUp, title: 'Trendline Analysis', desc: 'AI-generated price predictions from advanced technical and sentiment analysis.' },
  { icon: Shield,     title: 'Risk Management',    desc: 'Configurable stop-loss, max drawdown, and position sizing to protect your capital.' },
  { icon: Activity,   title: 'Event Detection',    desc: 'AI scans thousands of news sources to flag high-impact events before prices move.' },
  { icon: Globe,      title: 'Multi-Asset',        desc: 'Trade crypto on Binance, stocks via Alpaca, with alerts on Telegram and WhatsApp.' },
]

const stats = [
  { value: '$2.4B+', label: 'Volume Analyzed' },
  { value: '68%',    label: 'Avg Win Rate'    },
  { value: '15ms',   label: 'Signal Latency'  },
  { value: '24/7',   label: 'Always Running'  },
]

const plans = [
  {
    name: 'Free', price: 0, period: 'Forever free',
    icon: Zap, color: '#848e9c', highlight: false,
    features: [
      '1 AI trading bot',
      '0 EventBots',
      '1 API key',
      'Basic market data',
      'Email alerts',
      'Community support',
      '$500/day withdrawal limit',
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Pro', price: 500, period: '/month',
    icon: Star, color: '#f0b90b', highlight: true,
    features: [
      '10 AI trading bots',
      '4 EventBots included',
      '10 API keys',
      'Live market data',
      'Telegram & WhatsApp alerts',
      'Priority support',
      '$5,000/day withdrawal limit',
    ],
    cta: 'Go Pro',
  },
  {
    name: 'Elite', price: 1000, period: '/month',
    icon: Crown, color: '#0ecb81', highlight: false,
    features: [
      '20 AI trading bots',
      '8 EventBots included',
      '20 API keys',
      'VPS hosting included',
      'Custom strategy builder',
      'Dedicated support manager',
      'Unlimited withdrawals',
    ],
    cta: 'Go Elite',
  },
  {
    name: 'Elite+', price: 2000, period: '/month',
    icon: Crown, color: '#a855f7', highlight: false,
    features: [
      '40 AI trading bots',
      '15 EventBots included',
      '40 API keys',
      'All Elite features',
      'White-label option',
      'SLA guarantee (99.9%)',
      'Dedicated infrastructure',
    ],
    cta: 'Go Elite+',
  },
  {
    name: 'Custom', price: -1, period: 'Contact us',
    icon: Infinity, color: '#4a5568', highlight: false,
    features: [
      'Unlimited bots & API keys',
      '50 EventBots included',
      'Custom infrastructure',
      'On-premise deployment',
      'Enterprise SLA',
      'Dedicated engineering team',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const tickerItems = useTickerPrices()

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] overflow-x-hidden">

      {/* ─── NAVBAR ─── */}
      <header className="sticky top-0 z-50 bg-[#0b0e11]/95 backdrop-blur-md border-b border-[#2b3139]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#f0b90b] flex items-center justify-center shadow-lg shadow-[#f0b90b]/20">
              <Zap size={13} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-base tracking-tight">FinAi</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {(['Features', 'Markets', 'Pricing'] as const).map(n => (
              <a key={n} href={`#${n.toLowerCase()}`}
                className="text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium">{n}</a>
            ))}
            <button onClick={() => navigate('/about')}
              className="text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium">About</button>
          </nav>

          <button onClick={() => setMobileMenuOpen(v => !v)}
            className="md:hidden p-2 text-[#848e9c] hover:text-[#eaecef] flex-shrink-0">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#2b3139] bg-[#0b0e11] px-4 py-3 space-y-1">
            {['Features', 'Markets', 'Pricing'].map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm text-[#848e9c] hover:text-[#eaecef] py-2">{n}</a>
            ))}
          </div>
        )}
      </header>

      {/* ─── LIVE TICKER ─── */}
      <div className="bg-[#0f1215] border-b border-[#2b3139] overflow-hidden py-2">
        <div className="flex animate-[ticker_35s_linear_infinite] whitespace-nowrap w-max">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-5 text-xs">
              <span className="text-[#848e9c] font-medium">{t.symbol}</span>
              <span className="text-[#eaecef] font-mono font-semibold">{t.price}</span>
              <span className={`font-semibold ${t.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{t.change}</span>
              <span className="text-[#2b3139] pl-3">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── HERO ─── */}
      <section className="relative py-14 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(240,185,11,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(240,185,11,0.03) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 sm:w-[500px] h-48 bg-[#f0b90b]/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center px-5 sm:px-6">
          <div className="inline-flex items-center gap-1.5 bg-[#f0b90b]/10 border border-[#f0b90b]/25 text-[#f0b90b] text-[11px] font-bold px-3 py-1 rounded-full mb-6 tracking-wider uppercase">
            <Cpu size={10} /> Powered by Grok AI
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-[#eaecef] mb-4">
            Trade Smarter with{' '}
            <span className="text-[#f0b90b]">AI&#8209;Powered Insights</span>
          </h1>

          <p className="text-[#848e9c] text-sm leading-relaxed mb-8 max-w-sm sm:max-w-lg mx-auto">
            FinAi reads real-time market news, detects high-impact events, and executes automated trading strategies — driven by Grok AI.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-7 py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#f0b90b]/20 active:scale-[0.98]">
              Start Trading Free <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center gap-1.5 border border-[#2b3139] hover:border-[#f0b90b]/40 hover:text-[#f0b90b] text-[#848e9c] px-7 py-3 rounded-xl text-sm transition-all">
              View Dashboard →
            </button>
          </div>

          <p className="text-xs text-[#4a5568] mt-5">No credit card required · Free forever plan available</p>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section id="markets" className="bg-[#161a1e] border-y border-[#2b3139]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={[
                'text-center py-6 px-4',
                i < 2 ? 'border-b border-[#2b3139] md:border-b-0' : '',
                i % 2 === 0 ? 'border-r border-[#2b3139]' : '',
                i === 1 ? 'md:border-r border-[#2b3139]' : '',
                i === 2 ? 'md:border-r border-[#2b3139]' : '',
              ].join(' ')}>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#f0b90b] font-mono tracking-tight">{s.value}</p>
                <p className="text-xs text-[#848e9c] mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs text-[#f0b90b] font-bold tracking-widest uppercase mb-3">Why FinAi</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#eaecef] mb-3">Everything you need to trade smarter</h2>
            <p className="text-[#848e9c] text-sm max-w-md mx-auto leading-relaxed">
              A complete AI trading suite — from market monitoring to automated execution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="group bg-[#161a1e] border border-[#2b3139] hover:border-[#f0b90b]/35 rounded-xl p-5 transition-all duration-200 hover:bg-[#1a1f26]">
                <div className="w-9 h-9 rounded-lg bg-[#f0b90b]/10 group-hover:bg-[#f0b90b]/15 flex items-center justify-center mb-3 transition-colors">
                  <Icon size={15} className="text-[#f0b90b]" />
                </div>
                <h3 className="font-semibold text-[#eaecef] text-sm mb-2">{title}</h3>
                <p className="text-xs text-[#848e9c] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LIVE MARKET SNAPSHOT ─── */}
      <section className="py-12 sm:py-16 bg-[#0d1014]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-xs text-[#848e9c] font-bold tracking-widest uppercase mb-2">Live Market</p>
            <h2 className="text-xl sm:text-2xl font-bold text-[#eaecef]">Real-time prices</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tickerItems.slice(0, 4).map(t => (
              <div key={t.symbol}
                className="bg-[#161a1e] border border-[#2b3139] hover:border-[#f0b90b]/25 rounded-xl p-4 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#848e9c] font-medium">{t.symbol}</p>
                  {t.live && <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />}
                </div>
                <p className="text-base font-bold font-mono text-[#eaecef]">{t.price}</p>
                <p className={`text-xs font-semibold mt-1 ${t.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {t.change} <span className="text-[#4a5568] font-normal">24h</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PARTNERS ─── */}
      <section className="py-10 sm:py-14 border-y border-[#2b3139] bg-[#0d1014]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs text-[#4a5568] font-semibold uppercase tracking-widest mb-8">Trusted & Integrated Partners</p>
          <div className="flex items-center justify-center">
            <img
              src="/partners.png"
              alt="Partners: AWS, Anthropic, Apple, Broadcom, Cisco, CrowdStrike, Google, JPMorgan Chase, Linux Foundation, Microsoft, NVIDIA, Palo Alto Networks"
              className="w-full max-w-2xl opacity-70 hover:opacity-100 transition-opacity duration-300 object-contain"
              style={{ filter: 'brightness(0.9) contrast(0.95)' }}
            />
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-14 sm:py-20 bg-[#161a1e] border-y border-[#2b3139]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs text-[#f0b90b] font-bold tracking-widest uppercase mb-3">Pricing</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#eaecef] mb-3">Simple, transparent pricing</h2>
            <p className="text-[#848e9c] text-sm">Start free, scale as you grow. No hidden fees.</p>
          </div>

          {/* Scrollable carousel */}
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {plans.map(p => {
              const PlanIcon = p.icon
              return (
                <div key={p.name} className={[
                  'relative rounded-xl border flex flex-col overflow-hidden transition-all snap-start flex-shrink-0 w-[75vw] sm:w-auto',
                  p.highlight
                    ? 'bg-[#1a1f26] border-[#f0b90b]/60 shadow-lg shadow-[#f0b90b]/8'
                    : 'bg-[#0b0e11] border-[#2b3139] hover:border-[#3c4451]',
                ].join(' ')}>
                  {p.highlight && (
                    <div className="bg-[#f0b90b]/15 border-b border-[#f0b90b]/30 text-[#f0b90b] text-[10px] font-extrabold tracking-widest py-1.5 text-center uppercase">
                      ★ Most Popular
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    {/* Plan icon + name */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${p.color}18` }}>
                        <PlanIcon size={12} style={{ color: p.color }} />
                      </div>
                      <h3 className="font-bold text-base" style={{ color: p.color }}>{p.name}</h3>
                    </div>

                    {/* Price */}
                    <div className="flex items-end gap-1 mb-4 mt-1">
                      {p.price === -1 ? (
                        <span className="text-xl font-extrabold font-mono text-[#eaecef]">Custom</span>
                      ) : p.price === 0 ? (
                        <span className="text-2xl font-extrabold font-mono text-[#eaecef]">Free</span>
                      ) : (
                        <>
                          <span className="text-2xl font-extrabold font-mono text-[#eaecef]">${p.price.toLocaleString()}</span>
                          <span className="text-xs mb-1 text-[#848e9c]">{p.period}</span>
                        </>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 flex-1 mb-4">
                      {p.features.map(f => {
                        const isEventBot = f.toLowerCase().includes('eventbot')
                        return (
                          <li key={f} className="flex items-center gap-2 text-xs">
                            {isEventBot
                              ? <Bot size={10} className="text-[#f0b90b] flex-shrink-0" />
                              : <Check size={10} className="text-[#0ecb81] flex-shrink-0" />
                            }
                            <span className={isEventBot ? 'text-[#f0b90b] font-medium' : 'text-[#848e9c]'}>{f}</span>
                          </li>
                        )
                      })}
                    </ul>

                    <button
                      onClick={() => p.price === -1 ? navigate('/login') : navigate('/subscribe')}
                      className={[
                        'w-full py-2.5 rounded-lg text-xs font-bold transition-all',
                        p.highlight
                          ? 'bg-[#f0b90b] hover:bg-[#d4a30a] text-black'
                          : 'bg-[#f0b90b]/8 hover:bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/20',
                      ].join(' ')}>
                      {p.cta}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* EventBot callout */}
          <div className="mt-6 flex items-start gap-3 bg-[#f0b90b]/6 border border-[#f0b90b]/20 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-[#f0b90b]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={14} className="text-[#f0b90b]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#eaecef] mb-0.5">What is an EventBot?</p>
              <p className="text-xs text-[#848e9c] leading-relaxed">
                EventBots are AI-powered bots that monitor real-world financial events — earnings reports, Fed decisions, macro announcements — and execute trades automatically when they occur. Your plan determines how many concurrent EventBots you can deploy.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ─── CTA ─── */}
      <section className="py-14 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(ellipse at center, rgba(240,185,11,0.06) 0%, transparent 65%)',
        }} />
        <div className="relative max-w-lg mx-auto text-center px-4 sm:px-6">
          <div className="w-12 h-12 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center mx-auto mb-5">
            <Lock size={18} className="text-[#f0b90b]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#eaecef] mb-3">Ready to automate your trading?</h2>
          <p className="text-[#848e9c] text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            Join thousands of traders using FinAi to gain an edge in the markets every single day.
          </p>
          <button onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#f0b90b]/20 active:scale-[0.98]">
            Create Free Account <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[#2b3139] py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0b90b] flex items-center justify-center">
              <Zap size={11} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-sm">FinAi</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {(['Features', 'Markets', 'Pricing'] as const).map(n => (
              <a key={n} href={`#${n.toLowerCase()}`}
                className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">{n}</a>
            ))}
            <button onClick={() => navigate('/about')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">About</button>
            <button onClick={() => navigate('/terms')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">Terms</button>
          </div>
          <p className="text-xs text-[#4a5568]">
            © {new Date().getFullYear()} FinAi · Not financial advice
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
