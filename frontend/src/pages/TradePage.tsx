import { useState } from 'react'
import { ArrowUpDown, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const generateCandles = () =>
  Array.from({ length: 48 }, (_, i) => ({
    time: `${Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`,
    price: 67000 + Math.sin(i * 0.4) * 2000 + Math.random() * 800,
  }))

const orderBook = {
  asks: Array.from({ length: 8 }, (_, i) => ({ price: 67500 + i * 10, size: (Math.random() * 2).toFixed(4) })),
  bids: Array.from({ length: 8 }, (_, i) => ({ price: 67450 - i * 10, size: (Math.random() * 2).toFixed(4) })),
}

export default function TradePage() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit')
  const [price, setPrice] = useState('67432.10')
  const [amount, setAmount] = useState('')
  const chartData = generateCandles()

  const handleTrade = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} order placed (demo mode)`)
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#eaecef]">Trade</h1>
        <div className="flex items-center gap-2 bg-[#161a1e] border border-[#2b3139] rounded-xl px-3 py-1.5">
          <span className="text-sm font-medium text-[#eaecef]">BTC/USDT</span>
          <ArrowUpDown size={12} className="text-[#848e9c]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold font-mono text-[#eaecef]">$67,432</span>
          <span className="text-sm text-[#0ecb81] flex items-center gap-1"><TrendingUp size={13} /> +2.4%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Chart */}
        <div className="col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
          <div className="flex gap-2 mb-4">
            {['1m', '5m', '15m', '1h', '4h', '1D'].map(tf => (
              <button key={tf} className={`text-xs px-2.5 py-1 rounded-lg ${tf === '1h' ? 'bg-[#f0b90b] text-black font-medium' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>{tf}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ecb81" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0ecb81" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
              <XAxis dataKey="time" tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} interval={7} />
              <YAxis tick={{ fill: '#848e9c', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: 8 }}
                labelStyle={{ color: '#848e9c', fontSize: 10 }}
                itemStyle={{ color: '#0ecb81', fontSize: 10 }}
                formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke="#0ecb81" strokeWidth={1.5} fill="url(#priceGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order panel + book */}
        <div className="space-y-4">
          {/* Order form */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
            <div className="grid grid-cols-2 gap-1 mb-4 bg-[#0b0e11] p-1 rounded-xl">
              <button onClick={() => setSide('buy')} className={`py-2 rounded-lg text-sm font-semibold transition ${side === 'buy' ? 'bg-[#0ecb81] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>Buy</button>
              <button onClick={() => setSide('sell')} className={`py-2 rounded-lg text-sm font-semibold transition ${side === 'sell' ? 'bg-[#f6465d] text-white' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>Sell</button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['limit', 'market'] as const).map(t => (
                <button key={t} onClick={() => setOrderType(t)} className={`text-xs px-3 py-1.5 rounded-lg capitalize ${orderType === t ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c]'}`}>{t}</button>
              ))}
            </div>

            <form onSubmit={handleTrade} className="space-y-3">
              {orderType === 'limit' && (
                <div>
                  <label className="text-xs text-[#848e9c] mb-1 block">Price (USDT)</label>
                  <input value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition" />
                </div>
              )}
              <div>
                <label className="text-xs text-[#848e9c] mb-1 block">Amount (BTC)</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm font-mono text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition" />
              </div>
              <button type="submit"
                className={`w-full py-3 rounded-xl text-sm font-semibold transition ${side === 'buy' ? 'bg-[#0ecb81] hover:bg-[#0ab56f] text-black' : 'bg-[#f6465d] hover:bg-[#d93d51] text-white'}`}>
                {side === 'buy' ? 'Buy BTC' : 'Sell BTC'}
              </button>
            </form>
          </div>

          {/* Order book */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-3">
            <p className="text-xs font-semibold text-[#848e9c] mb-2">Order Book</p>
            <div className="space-y-0.5">
              {orderBook.asks.slice(0, 5).reverse().map((a, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-[#f6465d] font-mono">${a.price.toLocaleString()}</span>
                  <span className="text-[#848e9c] font-mono">{a.size}</span>
                </div>
              ))}
              <div className="py-1 text-center text-sm font-bold font-mono text-[#eaecef]">$67,432</div>
              {orderBook.bids.slice(0, 5).map((b, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-[#0ecb81] font-mono">${b.price.toLocaleString()}</span>
                  <span className="text-[#848e9c] font-mono">{b.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
