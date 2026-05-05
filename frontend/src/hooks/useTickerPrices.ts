import { useState, useEffect, useCallback } from 'react'

export interface TickerItem {
  symbol: string
  price: string
  change: string
  up: boolean
  live: boolean
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana&vs_currencies=usd&include_24hr_change=true'

const STATIC_STOCKS: TickerItem[] = [
  { symbol: 'NVDA',  price: '$875.00', change: '+3.1%', up: true,  live: false },
  { symbol: 'SPY',   price: '$530.40', change: '+0.5%', up: true,  live: false },
  { symbol: 'AAPL',  price: '$189.30', change: '+1.1%', up: true,  live: false },
  { symbol: 'TSLA',  price: '$248.60', change: '-1.2%', up: false, live: false },
]

function fmt(n: number) {
  if (n >= 10000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 100)   return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function fmtChange(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

export function useTickerPrices(intervalMs = 45000) {
  const [items, setItems] = useState<TickerItem[]>([
    { symbol: 'BTC/USDT', price: '...', change: '—', up: true,  live: false },
    { symbol: 'ETH/USDT', price: '...', change: '—', up: true,  live: false },
    { symbol: 'BNB/USDT', price: '...', change: '—', up: true,  live: false },
    { symbol: 'SOL/USDT', price: '...', change: '—', up: true,  live: false },
    ...STATIC_STOCKS,
  ])

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(COINGECKO_URL)
      if (!res.ok) return
      const data = await res.json()

      const btc = data.bitcoin
      const eth = data.ethereum
      const bnb = data.binancecoin
      const sol = data.solana

      setItems([
        { symbol: 'BTC/USDT', price: fmt(btc.usd), change: fmtChange(btc.usd_24h_change), up: btc.usd_24h_change >= 0, live: true },
        { symbol: 'ETH/USDT', price: fmt(eth.usd), change: fmtChange(eth.usd_24h_change), up: eth.usd_24h_change >= 0, live: true },
        { symbol: 'BNB/USDT', price: fmt(bnb.usd), change: fmtChange(bnb.usd_24h_change), up: bnb.usd_24h_change >= 0, live: true },
        { symbol: 'SOL/USDT', price: fmt(sol.usd), change: fmtChange(sol.usd_24h_change), up: sol.usd_24h_change >= 0, live: true },
        ...STATIC_STOCKS,
      ])
    } catch {
      // keep previous values on error
    }
  }, [])

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, intervalMs)
    return () => clearInterval(id)
  }, [fetchPrices, intervalMs])

  return items
}
