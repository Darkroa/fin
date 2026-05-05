import { useNavigate } from 'react-router-dom'
import {
  Zap, TrendingUp, Shield, BarChart2, Bot, Globe,
  ArrowRight, Activity, Lock, Cpu, Check, Menu, X
} from 'lucide-react'
import { useState } from 'react'

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
  { name: 'Starter', price: 0,   period: 'Free forever', features: ['1 AI bot', 'Basic market data', 'Email alerts', '5 API calls/min'], cta: 'Get Started Free', highlight: false },
  { name: 'Pro',     price: 49,  period: '/month',        features: ['5 AI bots', 'Live market data', 'Telegram & WhatsApp', 'Unlimited API', 'Priority support'], cta: 'Start Pro', highlight: true },
  { name: 'Elite',   price: 149, period: '/month',        features: ['Unlimited bots', 'VPS hosting included', 'Custom strategies', 'Dedicated support', 'White-label'], cta: 'Go Elite', highlight: false },
]

const tickerItems = [
  { symbol: 'BTC/USDT', price: '$67,432', change: '+2.4%', up: true },
  { symbol: 'ETH/USDT', price: '$3,521',  change: '+1.8%', up: true },
  { symbol: 'NVDA',     price: '$875.00', change: '+3.1%', up: true },
  { symbol: 'SPY',      price: '$530.40', change: '+0.5%', up: true },
  { symbol: 'BNB/USDT', price: '$412.10', change: '-0.3%', up: false },
  { symbol: 'SOL/USDT', price: '$172.55', change: '+4.2%', up: true },
  { symbol: 'AAPL',     price: '$189.30', change: '+1.1%', up: true },
  { symbol: 'TSLA',     price: '$248.60', change: '-1.2%', up: false },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
            {['Features', 'Markets', 'Pricing'].map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} className="text-xs text-[#848e9c] hover:text-[#eaecef] transition font-medium whitespace-nowrap">{n}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate('/login')} className="text-xs text-[#848e9c] hover:text-[#eaecef] transition font-medium whitespace-nowrap px-3 py-1.5">Sign in</button>
            <button onClick={() => navigate('/login')} className="text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-4 py-1.5 rounded-lg transition whitespace-nowrap">Get Started</button>
          </div>

          <button onClick={() => setMobileMenuOpen(v => !v)} className="md:hidden p-2 text-[#848e9c] hover:text-[#eaecef] flex-shrink-0">
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#2b3139] bg-[#0b0e11] px-5 py-3 space-y-2">
            {['Features', 'Markets', 'Pricing'].map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                className="block text-xs text-[#848e9c] hover:text-[#eaecef] py-1.5">{n}</a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <button onClick={() => navigate('/login')} className="w-full text-xs border border-[#2b3139] text-[#848e9c] py-2 rounded-lg hover:text-[#eaecef] hover:border-[#3c4451] transition">Sign in</button>
              <button onClick={() => navigate('/login')} className="w-full text-xs bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold py-2 rounded-lg transition">Get Started Free</button>
            </div>
          </div>
        )}
      </header>

      {/* ─── LIVE TICKER ─── */}
      <div className="bg-[#0f1215] border-b border-[#2b3139] overflow-hidden py-2">
        <div className="flex animate-[ticker_30s_linear_infinite] whitespace-nowrap w-max">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-6 text-xs">
              <span className="text-[#848e9c] font-medium">{t.symbol}</span>
              <span className="text-[#eaecef] font-mono font-semibold">{t.price}</span>
              <span className={`font-semibold ${t.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{t.change}</span>
              <span className="text-[#2b3139] pl-4">|</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── HERO ─── */}
      <section className="relative py-14 sm:py-20 px-5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(240,185,11,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(240,185,11,0.04) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[220px] bg-[#f0b90b]/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#0ecb81]/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 bg-[#f0b90b]/10 border border-[#f0b90b]/30 text-[#f0b90b] text-[10px] font-semibold px-3 py-1 rounded-full mb-6">
            <Cpu size={10} /> Powered by Grok AI
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-snug tracking-tight text-[#eaecef] mb-4">
            Trade Smarter with{' '}
            <span className="text-[#f0b90b] whitespace-nowrap">AI-Powered Insights</span>
          </h1>

          <p className="text-[#848e9c] text-xs sm:text-sm leading-relaxed mb-8 max-w-lg mx-auto">
            FinAi reads real-time market news, detects high-impact events, and executes automated trading strategies — all driven by Grok AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-[#f0b90b]/20 active:scale-[0.98]">
              Start Trading Free <ArrowRight size={13} />
            </button>
            <button onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-[#2b3139] hover:border-[#f0b90b]/30 hover:text-[#f0b90b] text-[#848e9c] px-6 py-2.5 rounded-xl text-xs transition-all">
              View Dashboard →
            </button>
          </div>

          <p className="text-[10px] text-[#4a5568] mt-4">No credit card required · Free forever plan available</p>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section id="markets" className="bg-[#161a1e] border-y border-[#2b3139]">
        <div className="max-w-5xl mx-auto px-5 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`text-center py-4 px-3 ${i < 2 ? 'border-b border-[#2b3139] md:border-b-0' : ''} ${i !== 3 ? 'border-r border-[#2b3139]' : ''} ${i === 1 ? 'md:border-r border-[#2b3139]' : ''}`}>
                <p className="text-xl sm:text-2xl font-extrabold text-[#f0b90b] font-mono tracking-tight">{s.value}</p>
                <p className="text-[10px] text-[#848e9c] mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-14 sm:py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] text-[#f0b90b] font-bold tracking-widest uppercase mb-2">Why FinAi</p>
            <h2 className="text-lg sm:text-xl font-bold text-[#eaecef] mb-3">Everything you need to trade smarter</h2>
            <p className="text-[#848e9c] text-xs max-w-sm mx-auto leading-relaxed">
              A complete AI trading suite — from market monitoring to automated execution, all in one platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group bg-gradient-to-br from-[#161a1e] to-[#0f1317] border border-[#2b3139] hover:border-[#f0b90b]/40 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-[#f0b90b]/5">
                <div className="w-8 h-8 rounded-lg bg-[#f0b90b]/10 group-hover:bg-[#f0b90b]/20 flex items-center justify-center mb-3 transition-colors">
                  <Icon size={15} className="text-[#f0b90b]" />
                </div>
                <h3 className="font-semibold text-[#eaecef] text-xs mb-1.5">{title}</h3>
                <p className="text-[11px] text-[#848e9c] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LIVE MARKET SNAPSHOT ─── */}
      <section className="py-12 px-5 bg-[#0b0e11]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-7">
            <p className="text-[10px] text-[#848e9c] font-bold tracking-widest uppercase mb-1.5">Live Market Snapshot</p>
            <h2 className="text-base font-bold text-[#eaecef]">Real-time prices, always</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { symbol: 'BTC/USDT', price: '$67,432', change: '+2.4%', up: true },
              { symbol: 'ETH/USDT', price: '$3,521',  change: '+1.8%', up: true },
              { symbol: 'NVDA',     price: '$875.00', change: '+3.1%', up: true },
              { symbol: 'SPY',      price: '$530.40', change: '+0.5%', up: true },
            ].map(t => (
              <div key={t.symbol} className="bg-gradient-to-br from-[#161a1e] to-[#1a1f25] border border-[#2b3139] hover:border-[#f0b90b]/30 rounded-xl p-3.5 transition-all">
                <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium">{t.symbol}</p>
                <p className="text-sm font-bold font-mono text-[#eaecef] leading-none">{t.price}</p>
                <p className={`text-[10px] font-semibold mt-1.5 ${t.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{t.change} 24h</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-14 sm:py-16 px-5 bg-[#161a1e] border-y border-[#2b3139]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] text-[#f0b90b] font-bold tracking-widest uppercase mb-2">Pricing</p>
            <h2 className="text-lg sm:text-xl font-bold text-[#eaecef] mb-3">Simple, transparent pricing</h2>
            <p className="text-[#848e9c] text-xs max-w-xs mx-auto">Start free, scale as you grow. No hidden fees.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 sm:items-start">
            {plans.map(p => (
              <div key={p.name} className={`relative rounded-xl border flex flex-col overflow-hidden transition-all ${p.highlight
                ? 'bg-gradient-to-b from-[#1e2329] to-[#161a1e] border-[#f0b90b] shadow-xl shadow-[#f0b90b]/10'
                : 'bg-[#0b0e11] border-[#2b3139]'}`}>
                {p.highlight && (
                  <div className="bg-[#f0b90b] text-black text-[9px] font-extrabold tracking-widest py-1.5 text-center uppercase">
                    ★ Most Popular
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className={`font-bold text-sm mb-0.5 ${p.highlight ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>{p.name}</h3>
                  <div className="flex items-end gap-1 mb-4">
                    <span className="text-2xl font-extrabold font-mono text-[#eaecef]">
                      {p.price === 0 ? 'Free' : `$${p.price}`}
                    </span>
                    {p.price > 0 && <span className="text-xs mb-1 text-[#848e9c]">{p.period}</span>}
                  </div>
                  <ul className="space-y-2 flex-1">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-[11px]">
                        <Check size={11} className="text-[#0ecb81] flex-shrink-0" />
                        <span className="text-[#848e9c]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => navigate('/login')}
                    className={`mt-5 w-full py-2.5 rounded-lg text-xs font-bold transition-all ${p.highlight
                      ? 'bg-[#f0b90b] hover:bg-[#d4a30a] text-black shadow-lg shadow-[#f0b90b]/25'
                      : 'bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/20'}`}>
                    {p.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-14 px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(ellipse at center, rgba(240,185,11,0.06) 0%, transparent 70%)',
        }} />
        <div className="relative max-w-lg mx-auto text-center">
          <div className="w-11 h-11 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/25 flex items-center justify-center mx-auto mb-5">
            <Lock size={18} className="text-[#f0b90b]" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#eaecef] mb-3">Ready to automate your trading?</h2>
          <p className="text-[#848e9c] text-xs mb-7 leading-relaxed">
            Join thousands of traders using FinAi to gain an edge in the markets every single day.
          </p>
          <button onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-8 py-3 rounded-xl text-xs transition-all shadow-lg shadow-[#f0b90b]/20 active:scale-[0.98]">
            Create Free Account <ArrowRight size={13} />
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[#2b3139] py-6 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0b90b] flex items-center justify-center">
              <Zap size={11} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-sm">FinAi</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            {['Features', 'Markets', 'Pricing'].map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} className="text-[10px] text-[#4a5568] hover:text-[#848e9c] transition">{n}</a>
            ))}
          </div>
          <p className="text-[10px] text-[#4a5568] text-center sm:text-right">
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
