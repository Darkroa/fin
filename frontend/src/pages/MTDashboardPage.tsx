import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  disconnectExchange, getMe,
  getMt5Account, searchMt5Markets, placeMt5Order, aiChat,
} from '../lib/api'
import toast from 'react-hot-toast'
import {
  ArrowLeft, BarChart3, CheckCircle, ChevronRight,
  Lock, Play, RefreshCw, Search, ShieldAlert, Trash2, Wifi,
} from 'lucide-react'

interface Mt5Connection {
  exchange: string
  label?: string
  broker?: string
  server?: string
  mt5_platform?: string
  provider?: string
  status?: string
  is_demo?: boolean
  allow_live_trading?: boolean
  account_number_masked?: string
}

interface Mt5Market {
  symbol: string
  name?: string
  type?: string
  bid?: number
  ask?: number
  spread?: number
  trade_enabled?: boolean
}

interface Mt5Position {
  ticket?: number
  symbol?: string
  side?: string
  volume?: number
  price_open?: number
  price_current?: number
  profit?: number
}

interface Mt5AccountSnapshot {
  label: string
  connected?: boolean
  unavailable?: boolean
  error?: string
  provider?: string
  balance?: number
  equity?: number
  free_margin?: number
  margin?: number
  margin_level?: number
  currency?: string
  open_positions?: number
  positions?: Mt5Position[]
  last_sync_at?: string
  server?: string
  broker?: string
  mt5_platform?: string
}

const inputClass = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback
}

function formatValue(value: number | undefined, currency = '') {
  if (value == null || Number.isNaN(value)) return '—'
  return `${currency ? `${currency} ` : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function connectionStatus(connection: Mt5Connection) {
  if (connection.status === 'connected') {
    return { label: 'Connected', className: 'bg-[#0ecb81]/10 text-[#0ecb81]', icon: CheckCircle }
  }
  if (connection.status === 'pending_bridge') {
    return { label: 'Reconnect required', className: 'bg-[#f0b90b]/10 text-[#f0b90b]', icon: ShieldAlert }
  }
  return { label: connection.status || 'Saved', className: 'bg-[#2b3139] text-[#848e9c]', icon: ShieldAlert }
}

export default function MTDashboardPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const [mt5ActiveLabel, setMt5ActiveLabel] = useState('')
  const [mt5Search, setMt5Search] = useState('')
  const [mt5Markets, setMt5Markets] = useState<Mt5Market[]>([])
  const [mt5SelectedSymbol, setMt5SelectedSymbol] = useState('')
  const [mt5AccountData, setMt5AccountData] = useState<Mt5AccountSnapshot | null>(null)
  const [mt5LoadingAccount, setMt5LoadingAccount] = useState(false)
  const [mt5Analysis, setMt5Analysis] = useState('')
  const [mt5Analyzing, setMt5Analyzing] = useState(false)
  const [mt5OrderSide, setMt5OrderSide] = useState<'buy' | 'sell'>('buy')
  const [mt5Volume, setMt5Volume] = useState('0.01')
  const [mt5StopLoss, setMt5StopLoss] = useState('')
  const [mt5TakeProfit, setMt5TakeProfit] = useState('')
  const [mt5Ordering, setMt5Ordering] = useState(false)

  const connections = (user?.exchange_connections as Mt5Connection[] | undefined) || []
  const mt5Connections = connections.filter(connection => connection.exchange.toLowerCase() === 'mt5')
  const activeMt5Connection = mt5Connections.find(connection => connection.label === mt5ActiveLabel) || mt5Connections[0]
  const selectedMt5Market = mt5Markets.find(market => market.symbol === mt5SelectedSymbol)

  useEffect(() => {
    if (!mt5Connections.some(connection => connection.label === mt5ActiveLabel)) {
      setMt5ActiveLabel(mt5Connections[0]?.label || '')
      setMt5Markets([])
      setMt5SelectedSymbol('')
      setMt5AccountData(null)
    }
  }, [mt5Connections, mt5ActiveLabel])

  const handleDisconnect = async (label?: string) => {
    if (!label) return
    try {
      await disconnectExchange('mt5', label)
      const response = await getMe()
      setUser(response.data)
      if (label === mt5ActiveLabel) {
        setMt5Markets([])
        setMt5SelectedSymbol('')
        setMt5AccountData(null)
      }
      toast.success(`${label} disconnected`)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to disconnect MT5 account'))
    }
  }

  const handleLoadMt5Account = async (label: string) => {
    setMt5ActiveLabel(label)
    setMt5LoadingAccount(true)
    try {
      const response = await getMt5Account(label)
      setMt5AccountData({ ...response.data, label })
      toast.success('MT5 account synced through MetaApi')
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'MetaApi could not sync this account')
      setMt5AccountData({ label, unavailable: true, error: message })
      toast.error(message)
    } finally {
      setMt5LoadingAccount(false)
    }
  }

  const handleMt5MarketSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeMt5Connection?.label) return toast.error('Connect an MT5 account first')
    try {
      const response = await searchMt5Markets(activeMt5Connection.label, mt5Search.trim())
      const markets = Array.isArray(response.data) ? response.data : response.data?.markets || []
      setMt5Markets(markets)
      setMt5SelectedSymbol(current => markets.some((market: Mt5Market) => market.symbol === current) ? current : '')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'MetaApi market search is unavailable'))
    }
  }

  const handleMt5Analysis = async () => {
    if (!mt5SelectedSymbol) return toast.error('Select a broker symbol first')
    setMt5Analyzing(true)
    try {
      const response = await aiChat({
        pair: mt5SelectedSymbol,
        price: selectedMt5Market?.bid,
        message: `Analyze broker symbol ${mt5SelectedSymbol} for an MT5 trade. Live MetaApi quote context: bid=${selectedMt5Market?.bid ?? 'unavailable'}, ask=${selectedMt5Market?.ask ?? 'unavailable'}, spread=${selectedMt5Market?.spread ?? 'unavailable'}. Give trend, momentum, key levels, invalidation, entry zone, stop-loss, take-profit, risk-reward, confidence, and clearly say when conditions are not tradeable. Do not place an order.`,
      })
      setMt5Analysis(response.data.reply || 'No analysis returned.')
    } catch {
      toast.error('AI analysis failed. Try again shortly.')
    } finally {
      setMt5Analyzing(false)
    }
  }

  const handleMt5Order = async () => {
    const connection = activeMt5Connection
    const volume = Number(mt5Volume)
    if (!connection?.label) return toast.error('Connect an MT5 account first')
    if (!mt5SelectedSymbol) return toast.error('Search and select a broker symbol first')
    if (!volume || volume <= 0) return toast.error('Enter a valid lot size')
    const isDemo = connection.is_demo === true
    if (!isDemo && !connection.allow_live_trading) return toast.error('Enable live trading on the MT5 connection first')
    if (!window.confirm(`${isDemo ? 'Place demo' : 'Place LIVE'} ${mt5OrderSide.toUpperCase()} ${volume} lot(s) of ${mt5SelectedSymbol}?`)) return

    setMt5Ordering(true)
    try {
      const response = await placeMt5Order({
        label: connection.label,
        symbol: mt5SelectedSymbol,
        side: mt5OrderSide,
        volume,
        stop_loss: mt5StopLoss ? Number(mt5StopLoss) : undefined,
        take_profit: mt5TakeProfit ? Number(mt5TakeProfit) : undefined,
        confirm_live: true,
      })
      const orderId = response.data?.order_id ? ` #${response.data.order_id}` : ''
      toast.success(`${mt5OrderSide.toUpperCase()} order sent through MetaApi${orderId}`)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'MT5 order was not sent'))
    } finally {
      setMt5Ordering(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-[#161a1e] border border-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition">
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#f0b90b] font-semibold">MT4 / MT5 · METAAPI</p>
          <h1 className="text-2xl font-bold text-[#eaecef]">MT Dashboard</h1>
          <p className="text-xs text-[#848e9c]">Monitor verified broker accounts, markets, analysis, and orders.</p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[10px] text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/20 rounded-full px-3 py-1.5">
          <Wifi size={11} /> Server-side MetaApi
        </div>
      </div>

      <section className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
            <BarChart3 size={14} className="text-[#f0b90b]" />
            <span className="text-sm font-semibold text-[#eaecef]">Connected MetaTrader accounts</span>
            <span className="ml-auto text-[10px] text-[#848e9c]">{mt5Connections.length} account{mt5Connections.length === 1 ? '' : 's'}</span>
          </div>
          <div className="p-4 space-y-3">
            {mt5Connections.length === 0 ? (
              <div className="border border-dashed border-[#2b3139] rounded-xl py-10 text-center">
                <BarChart3 size={24} className="mx-auto text-[#4a5568] mb-2" />
                <p className="text-xs font-semibold text-[#eaecef]">No MetaTrader account connected</p>
                <p className="text-[10px] text-[#848e9c] mt-1">Connect a demo account to start safely.</p>
                <button onClick={() => navigate('/app/finapi')} className="inline-flex items-center gap-1 mt-3 text-[10px] text-[#f0b90b] hover:text-[#eaecef] transition">
                  Go to FinAPI <ChevronRight size={11} />
                </button>
              </div>
            ) : (
              mt5Connections.map(connection => {
                const status = connectionStatus(connection)
                const StatusIcon = status.icon
                const active = connection.label === activeMt5Connection?.label
                return (
                  <div key={connection.label} className={`rounded-xl border p-3 ${active ? 'border-[#f0b90b]/50 bg-[#f0b90b]/5' : 'border-[#2b3139] bg-[#0b0e11]'}`}>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setMt5ActiveLabel(connection.label || ''); setMt5AccountData(null); setMt5Markets([]); setMt5SelectedSymbol('') }} className="flex items-center gap-3 min-w-0 text-left flex-1">
                        <div className="w-9 h-9 rounded-xl bg-[#f0b90b]/15 flex items-center justify-center flex-shrink-0">
                          <BarChart3 size={16} className="text-[#f0b90b]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#eaecef] truncate">{connection.label || connection.broker || 'MetaTrader account'}</p>
                          <p className="text-[10px] text-[#848e9c] font-mono truncate">{connection.mt5_platform || 'MT5'} · {connection.broker || 'Broker'} · {connection.server || 'server pending'} · {connection.is_demo ? 'Demo' : 'Live'}</p>
                          {connection.account_number_masked && <p className="text-[10px] text-[#4a5568] font-mono mt-0.5">{connection.account_number_masked}</p>}
                        </div>
                        <span className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded-full whitespace-nowrap ${status.className}`}>
                          <StatusIcon size={10} /> {status.label}
                        </span>
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => connection.label && handleLoadMt5Account(connection.label)} disabled={mt5LoadingAccount || connection.status !== 'connected'} className="flex items-center gap-1 text-[10px] text-[#0ecb81] hover:bg-[#0ecb81]/10 px-2 py-1.5 rounded-lg transition disabled:opacity-40">
                          <RefreshCw size={10} className={mt5LoadingAccount ? 'animate-spin' : ''} /> Sync
                        </button>
                        <button onClick={() => handleDisconnect(connection.label)} className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {active && connection.status !== 'connected' && (
                      <p className="text-[10px] text-[#f0b90b] mt-2 pl-12">Reconnect this account to provision its MetaApi cloud terminal before syncing.</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

      {activeMt5Connection && activeMt5Connection.status === 'connected' && (
        <>
          <section className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
              <BarChart3 size={14} className="text-[#0ecb81]" />
              <span className="text-sm font-semibold text-[#eaecef]">Account overview</span>
              <span className="text-[10px] text-[#848e9c]">Live data from MetaApi</span>
              <button onClick={() => handleLoadMt5Account(activeMt5Connection.label || '')} disabled={mt5LoadingAccount} className="ml-auto flex items-center gap-1.5 text-[10px] text-[#0ecb81] hover:text-[#eaecef] disabled:opacity-50">
                <RefreshCw size={11} className={mt5LoadingAccount ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            <div className="p-4 space-y-3">
              {!mt5AccountData ? (
                <button onClick={() => handleLoadMt5Account(activeMt5Connection.label || '')} disabled={mt5LoadingAccount} className="w-full border border-dashed border-[#2b3139] rounded-xl py-7 text-xs text-[#848e9c] hover:text-[#eaecef] hover:border-[#f0b90b]/50 transition">
                  {mt5LoadingAccount ? 'Loading MetaApi account data…' : 'Sync account to load balance, equity, and positions'}
                </button>
              ) : mt5AccountData.unavailable ? (
                <div className="rounded-xl border border-[#f6465d]/25 bg-[#f6465d]/5 px-4 py-3">
                  <p className="text-xs font-semibold text-[#f6465d]">MetaApi account sync failed</p>
                  <p className="text-[10px] text-[#848e9c] mt-1">{mt5AccountData.error || 'The provider did not return account data.'}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      ['Balance', formatValue(mt5AccountData.balance, mt5AccountData.currency)],
                      ['Equity', formatValue(mt5AccountData.equity, mt5AccountData.currency)],
                      ['Free margin', formatValue(mt5AccountData.free_margin, mt5AccountData.currency)],
                      ['Margin level', mt5AccountData.margin_level != null ? `${mt5AccountData.margin_level.toFixed(2)}%` : '—'],
                      ['Open positions', mt5AccountData.open_positions ?? '—'],
                      ['Currency', mt5AccountData.currency || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-[#0b0e11] border border-[#2b3139] rounded-lg p-3">
                        <p className="text-[9px] text-[#848e9c] uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-[#eaecef] mt-1 truncate">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                   {mt5AccountData.last_sync_at && <p className="text-[10px] text-[#848e9c]">Last MetaApi sync: {new Date(mt5AccountData.last_sync_at).toLocaleString()}</p>}
                  {mt5AccountData.positions && mt5AccountData.positions.length > 0 && (
                    <div className="border border-[#2b3139] rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-[#1a1f25] text-[10px] font-semibold text-[#eaecef]">Open positions</div>
                      <div className="divide-y divide-[#2b3139]">
                        {mt5AccountData.positions.slice(0, 20).map(position => (
                          <div key={position.ticket} className="flex items-center justify-between px-3 py-2 text-[10px]">
                            <span className="font-semibold text-[#eaecef]">{position.symbol || '—'} · {position.side || '—'} · {position.volume ?? '—'} lots</span>
                            <span className={Number(position.profit) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{position.profit != null ? Number(position.profit).toFixed(2) : '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2b3139] bg-[#1a1f25]">
              <Search size={14} className="text-[#f0b90b]" />
              <span className="text-sm font-semibold text-[#eaecef]">Broker markets</span>
               <span className="text-[10px] text-[#848e9c]">Searches the connected broker symbol list</span>
            </div>
            <div className="p-4 space-y-3">
              <form onSubmit={handleMt5MarketSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" />
                  <input value={mt5Search} onChange={event => setMt5Search(event.target.value)} placeholder="Search symbols (EURUSD, XAUUSD…)" className={`${inputClass} pl-9`} />
                </div>
                <button type="submit" className="px-4 rounded-lg bg-[#2b3139] hover:bg-[#3c4451] text-[#eaecef] text-xs transition">Search</button>
              </form>
               {!mt5Markets.length && <p className="text-[10px] text-[#848e9c] border border-dashed border-[#2b3139] rounded-lg px-3 py-3">Search the active account to load its actual broker symbols and MetaApi bid/ask quotes. No fallback prices are shown.</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {mt5Markets.map(market => (
                  <button type="button" key={market.symbol} onClick={() => setMt5SelectedSymbol(market.symbol)} className={`text-left rounded-lg border px-3 py-2 transition ${mt5SelectedSymbol === market.symbol ? 'border-[#f0b90b] bg-[#f0b90b]/10' : 'border-[#2b3139] hover:border-[#3c4451]'}`}>
                    <p className="text-xs font-semibold text-[#eaecef]">{market.symbol}</p>
                    <p className="text-[10px] text-[#848e9c] truncate">{market.bid != null && market.ask != null ? `${market.bid} / ${market.ask}` : 'quote unavailable'}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#eaecef]">Fin AI analysis</p>
                  <p className="text-[10px] text-[#848e9c]">{mt5SelectedSymbol || 'Select a broker symbol first'}</p>
                </div>
                <BarChart3 size={14} className="text-[#f0b90b]" />
              </div>
              <button type="button" onClick={handleMt5Analysis} disabled={mt5Analyzing || !mt5SelectedSymbol} className="w-full flex items-center justify-center gap-1.5 bg-[#2b3139] hover:bg-[#3c4451] disabled:opacity-50 text-[#eaecef] py-2.5 rounded-lg text-xs transition">
                <Play size={11} /> {mt5Analyzing ? 'Analyzing…' : 'Analyze market'}
              </button>
              {mt5Analysis && <p className="text-[11px] text-[#c7d0d9] whitespace-pre-wrap max-h-64 overflow-y-auto border-t border-[#2b3139] pt-3">{mt5Analysis}</p>}
            </section>

            <section className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#eaecef]">Trade {mt5SelectedSymbol || 'selected symbol'}</p>
                  <p className="text-[10px] text-[#848e9c]">Explicit confirmation is required for every order.</p>
                </div>
                <ChevronRight size={14} className="text-[#848e9c]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-1">
                  {(['buy', 'sell'] as const).map(side => (
                    <button type="button" key={side} onClick={() => setMt5OrderSide(side)} className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase ${mt5OrderSide === side ? (side === 'buy' ? 'bg-[#0ecb81] text-[#06120d]' : 'bg-[#f6465d] text-white') : 'bg-[#2b3139] text-[#848e9c]'}`}>{side}</button>
                  ))}
                </div>
                <input value={mt5Volume} onChange={event => setMt5Volume(event.target.value)} type="number" min="0.01" step="0.01" placeholder="Lots" className={inputClass} />
                <input value={mt5StopLoss} onChange={event => setMt5StopLoss(event.target.value)} type="number" step="any" placeholder="Stop loss" className={inputClass} />
                <input value={mt5TakeProfit} onChange={event => setMt5TakeProfit(event.target.value)} type="number" step="any" placeholder="Take profit" className={inputClass} />
              </div>
              <button type="button" onClick={handleMt5Order} disabled={mt5Ordering || !mt5SelectedSymbol} className="w-full flex items-center justify-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-2.5 rounded-lg text-xs transition">
                 <Play size={11} /> {mt5Ordering ? 'Sending through MetaApi…' : activeMt5Connection.is_demo ? 'Place demo order' : 'Place live order'}
              </button>
            </section>
          </div>
        </>
      )}

      <button onClick={() => navigate('/app/finapi')} className="w-full flex items-center justify-center gap-2 text-xs text-[#848e9c] hover:text-[#eaecef] py-2 transition">
        <Lock size={12} /> Manage API keys and exchange connections in FinAPI <ChevronRight size={12} />
      </button>
    </div>
  )
}