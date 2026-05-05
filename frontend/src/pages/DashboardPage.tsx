import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvents, getBotStatus } from '../lib/api'
import { TrendingUp, TrendingDown, Zap, Activity, DollarSign, BarChart2, Bot, Play, ArrowRight, Bitcoin } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const mockChartData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  portfolio: 10000 + Math.sin(i * 0.4) * 1200 + i * 80 + (Math.random() - 0.5) * 400,
}))

const mockPositions = [
  { asset: 'BTC/USDT', amount: '0.0842', value: '$5,674.12', pnl: '+$312.40', pnlPct: '+5.8%', up: true },
  { asset: 'ETH/USDT', amount: '1.250', value: '$4,401.25', pnl: '+$88.30', pnlPct: '+2.0%', up: true },
  { asset: 'AAPL', amount: '8', value: '$1,538.80', pnl: '-$24.00', pnlPct: '-1.5%', up: false },
  { asset: 'NVDA', amount: '1.5', value: '$1,312.50', pnl: '+$187.50', pnlPct: '+16.7%', up: true },
]

const BTC_PRICE = 67432.10
const BTC_CHANGE = 2.4
const ETH_PRICE = 3521.80
const ETH_CHANGE = 1.8

export default function DashboardPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<{ id: number; description: string; event_type: string; tickers_affected: string[]; created_at: string }[]>([])
  const [btcToggle, setBtcToggle] = useState<'BTC' | 'ETH'>('BTC')
  const [botRunning, setBotRunning] = useState(false)

  const totalBalance = 12927.67
  const todayPnl = 324.20
  const todayPct = 2.57

  useEffect(() => {
    getEvents(5).then(r => {
      const data = r.data
      setEvents(Array.isArray(data) ? data : (data?.events ?? []))
    }).catch(() => {})
    getBotStatus().then(r => setBotRunning(r.data?.running ?? false)).catch(() => {})
  }, [])

  const price = btcToggle === 'BTC' ? BTC_PRICE : ETH_PRICE
  const change = btcToggle === 'BTC' ? BTC_CHANGE : ETH_CHANGE

  return (
    <div className="space-y-5">
      {/* Welcome + Balance hero */}
      <div className="grid grid-cols-3 gap-4">
        {/* Big balance card */}
        <div className="col-span-2 bg-gradient-to-br from-[#1e2329] to-[#161a1e] border border-[#2b3139] rounded-2xl p-5">
          <p className="text-xs text-[#848e9c] mb-1 font-medium">Total Portfolio Value</p>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-4xl font-bold font-mono text-[#eaecef]">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-sm font-medium mb-1 flex items-center gap-1 ${todayPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {todayPnl >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              +${todayPnl.toFixed(2)} ({todayPct}%) today
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Crypto', value: '$10,075.37', icon: Bitcoin, color: 'text-[#f0b90b]' },
              { label: 'Stocks', value: '$2,851.30', icon: BarChart2, color: 'text-[#0ecb81]' },
              { label: 'Cash (USDT)', value: '$1.00', icon: DollarSign, color: 'text-[#848e9c]' },
            ].map(s => (
              <div key={s.label} className="bg-[#0b0e11] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon size={12} className={s.color} />
                  <span className="text-[10px] text-[#848e9c]">{s.label}</span>
                </div>
                <p className="text-sm font-bold font-mono text-[#eaecef]">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* BTC/ETH price card with toggle */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 bg-[#0b0e11] rounded-xl p-1">
              {(['BTC', 'ETH'] as const).map(coin => (
                <button key={coin} onClick={() => setBtcToggle(coin)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${btcToggle === coin ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                  {coin}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[#848e9c]">Live Price</span>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-3xl font-bold font-mono text-[#eaecef]">
              ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-sm font-medium mt-1 flex items-center gap-1 ${change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {change >= 0 ? '+' : ''}{change}% (24h)
            </p>
          </div>
          <button onClick={() => navigate('/app/trade')}
            className="mt-4 w-full bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5">
            Trade {btcToggle} <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Today's P&L", value: `+$${todayPnl.toFixed(2)}`, sub: `+${todayPct}%`, up: true, icon: TrendingUp },
          { label: 'Win Rate', value: '68.4%', sub: 'Last 30 days', up: true, icon: Activity },
          { label: 'Active Bots', value: botRunning ? '1' : '0', sub: botRunning ? 'Running' : 'Stopped', up: botRunning, icon: Zap },
          { label: 'AI Events', value: String(events.length), sub: 'Last detected', up: true, icon: BarChart2 },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#848e9c]">{s.label}</span>
                <div className="w-7 h-7 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
                  <Icon size={13} className="text-[#f0b90b]" />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-[#eaecef]">{s.value}</p>
              <p className={`text-xs mt-1 ${s.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{s.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Chart + Events */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#eaecef]">Portfolio Performance</h2>
            <div className="flex gap-1.5">
              {['1D', '1W', '1M', '3M'].map((p) => (
                <button key={p} className={`text-xs px-2.5 py-1 rounded-lg transition ${p === '1D' ? 'bg-[#f0b90b] text-black font-medium' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>{p}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={mockChartData}>
              <defs>
                <linearGradient id="pgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f0b90b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f0b90b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
              <XAxis dataKey="time" tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 8 }}
                labelStyle={{ color: '#848e9c', fontSize: 10 }}
                itemStyle={{ color: '#f0b90b', fontSize: 10 }}
                formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'Portfolio']}
              />
              <Area type="monotone" dataKey="portfolio" stroke="#f0b90b" strokeWidth={2} fill="url(#pgGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI Events */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[#eaecef] mb-3">AI Market Events</h2>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Activity size={24} className="text-[#2b3139]" />
              <p className="text-xs text-[#848e9c]">No recent events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 4).map((ev, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-[#0b0e11] border border-[#2b3139]">
                  <p className="text-xs text-[#eaecef] leading-relaxed line-clamp-2">{ev.description ?? ev.event_type}</p>
                  <p className="text-[10px] text-[#848e9c] mt-1">{ev.tickers_affected?.[0] ?? ''} · {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bot quick panel + Positions */}
      <div className="grid grid-cols-3 gap-4">
        {/* Bot panel */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#eaecef]">AI Bot Status</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${botRunning ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
              {botRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${botRunning ? 'bg-[#0ecb81]/10 border-2 border-[#0ecb81]/30' : 'bg-[#2b3139]'}`}>
              <Bot size={22} className={botRunning ? 'text-[#0ecb81]' : 'text-[#848e9c]'} />
            </div>
            <p className="text-xs text-[#848e9c] text-center">
              {botRunning ? 'Bot is actively trading' : 'Bot is not running'}
            </p>
          </div>
          <button onClick={() => navigate('/app/bots')}
            className="w-full flex items-center justify-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black text-xs font-semibold py-2.5 rounded-xl transition">
            <Play size={12} /> Manage Bots
          </button>
        </div>

        {/* Positions */}
        <div className="col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#eaecef]">Open Positions</h2>
            <span className="text-xs text-[#848e9c]">{mockPositions.length} positions</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                <th className="text-left px-4 py-2.5 font-medium">Asset</th>
                <th className="text-right px-4 py-2.5 font-medium">Value</th>
                <th className="text-right px-4 py-2.5 font-medium">P&L</th>
                <th className="text-right px-4 py-2.5 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {mockPositions.map((p) => (
                <tr key={p.asset} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#f0b90b]/10 flex items-center justify-center text-[10px] font-bold text-[#f0b90b]">
                        {p.asset[0]}
                      </div>
                      <span className="font-medium text-[#eaecef] text-xs">{p.asset}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#eaecef]">{p.value}</td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${p.up ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{p.pnl}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${p.up ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                      {p.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{p.pnlPct}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
