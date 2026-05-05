import { useNavigate } from 'react-router-dom'
import { Zap, TrendingUp, Shield, BarChart2, Bot, Globe, ArrowRight, ChevronRight, Activity, Lock, Cpu } from 'lucide-react'

const features = [
  { icon: Bot, title: 'AI-Powered Bots', desc: 'Automated trading strategies driven by Grok AI that react to live market events in real-time.' },
  { icon: BarChart2, title: 'Live Market Data', desc: 'Real-time price feeds for crypto and stocks. Monitor BTC, ETH, SPY, NVDA and more in one place.' },
  { icon: TrendingUp, title: 'Trendline Analysis', desc: 'Advanced technical analysis with AI-generated insights and predicted price movements.' },
  { icon: Shield, title: 'Risk Management', desc: 'Configurable stop-loss, max drawdown, and position sizing to protect your capital.' },
  { icon: Activity, title: 'Event Detection', desc: 'AI scans thousands of news sources to detect high-impact market events before they move prices.' },
  { icon: Globe, title: 'Multi-Asset', desc: 'Trade crypto on Binance, stocks via Alpaca, and get alerts across Telegram, WhatsApp, and email.' },
]

const stats = [
  { value: '$2.4B+', label: 'Volume Analyzed' },
  { value: '68%', label: 'Avg Win Rate' },
  { value: '15ms', label: 'Reaction Time' },
  { value: '24/7', label: 'Always Running' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef]">
      {/* Navbar — no auth buttons */}
      <nav className="sticky top-0 z-50 bg-[#0b0e11]/90 backdrop-blur border-b border-[#2b3139]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f0b90b] flex items-center justify-center">
              <Zap size={16} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-lg tracking-tight">FinAi</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Markets', 'Pricing', 'Docs'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-[#848e9c] hover:text-[#eaecef] transition">{item}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#f0b90b 1px, transparent 1px), linear-gradient(90deg, #f0b90b 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#f0b90b]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#f0b90b]/10 border border-[#f0b90b]/30 text-[#f0b90b] text-xs font-medium px-4 py-1.5 rounded-full mb-6">
            <Cpu size={12} />
            Powered by Grok AI
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 tracking-tight">
            Trade Smarter with<br />
            <span className="text-[#f0b90b]">AI-Powered</span> Insights
          </h1>

          <p className="text-[#848e9c] text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            FinAi reads real-time market news, detects high-impact events, and executes automated trading strategies — all powered by Grok's advanced intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              Start Trading Free
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 border border-[#2b3139] text-[#eaecef] hover:border-[#3c4451] px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              View Live Demo
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-[#2b3139] bg-[#161a1e]">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-[#f0b90b] font-mono mb-1">{s.value}</p>
              <p className="text-sm text-[#848e9c]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to trade smarter</h2>
            <p className="text-[#848e9c] max-w-xl mx-auto">A complete AI trading suite — from market monitoring to automated execution, all in one platform.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-6 hover:border-[#f0b90b]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center mb-4 group-hover:bg-[#f0b90b]/20 transition">
                  <Icon size={18} className="text-[#f0b90b]" />
                </div>
                <h3 className="font-semibold text-[#eaecef] mb-2">{title}</h3>
                <p className="text-sm text-[#848e9c] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-[#2b3139] bg-[#161a1e]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/30 flex items-center justify-center mx-auto mb-6">
            <Lock size={22} className="text-[#f0b90b]" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Ready to automate your trading?</h2>
          <p className="text-[#848e9c] mb-8">Join traders using FinAi to get an edge in the markets every day.</p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-10 py-3.5 rounded-xl text-sm transition-all"
          >
            Create Free Account
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2b3139] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#f0b90b] flex items-center justify-center">
              <Zap size={12} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-sm">FinAi</span>
          </div>
          <p className="text-xs text-[#4a5568]">© {new Date().getFullYear()} FinAi. Not financial advice. Trade at your own risk.</p>
        </div>
      </footer>
    </div>
  )
}
