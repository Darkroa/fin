import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Wifi,
  X,
  RefreshCw,
  Bot,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getOpenPositions, closeManualTrade, getBotStatus } from '../lib/api';


const formatCompact = (num: number) => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 10_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

interface OpenPosition {
  id: number;
  ticker: string;
  price: number;
  qty: number;
  exchange: string;
  created_at: string;
  current_price: number;
  unrealized_pnl: number;
  leverage?: number;
  pnl_pct?: number;
}

function useWsBalance(token: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    let alive = true;
    const connect = () => {
      if (!alive) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws/live?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => alive && setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (alive) setTimeout(connect, 4000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d.type === 'balance' && typeof d.balance_usdt === 'number') {
              setBalance(d.balance_usdt);
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* ignore */
      }
    };

    connect();
    return () => {
      alive = false;
      wsRef.current?.close();
    };
  }, [token]);

  return { balance, connected };
}

export default function OpenPositionsPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { balance: wsBalance, connected: wsConnected } = useWsBalance(token);

  const [openPositions, setOpenPos] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  // Collapsible card state
  const [botCollapsed, setBotCollapsed] = useState(false);
  const [eventCollapsed, setEventCollapsed] = useState(false);

  // Bot status
  const [botStatus, setBotStatus] = useState<any>(null);

  // AI events (simulated signals matching FloatingAI)
  const AI_EVENTS = useMemo(() => [
    { pair: 'BTC/USDT', signal: 'BUY', confidence: 87, reason: 'RSI oversold + MACD crossover' },
    { pair: 'ETH/USDT', signal: 'HOLD', confidence: 62, reason: 'Consolidating near support' },
    { pair: 'NVDA', signal: 'BUY', confidence: 79, reason: 'Earnings momentum + volume surge' },
    { pair: 'SPY', signal: 'SELL', confidence: 71, reason: 'Overbought RSI + resistance zone' },
  ], []);

  const userBalance = user?.balance_usdt ?? 0;
  const liveBalance = wsBalance ?? userBalance;

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOpenPositions();
      setOpenPos(res.data?.positions ?? []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    getBotStatus().then(r => setBotStatus(r.data)).catch(() => null);
  }, [fetchPositions]);

  const totalPositionValue = openPositions.reduce(
    (s, p) => s + p.qty * (p.current_price || p.price),
    0
  );

  const marginUsed = totalPositionValue;
  const availableMargin = Math.max(0, liveBalance - marginUsed);

  const unrealizedPnl = openPositions.reduce(
    (s, p) => s + (p.unrealized_pnl ?? 0),
    0
  );

  const handleClose = async (id: number) => {
    setClosingId(id);
    try {
      const res = await closeManualTrade(id);
      const d = res.data;
      const pnl = d.pnl ?? 0;

      toast.success(
        `Closed @ $${d.close_price?.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        })} — P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        { duration: 5000 }
      );

      if (d.new_balance !== undefined) {
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          balance_usdt: d.new_balance,
        });
      }
      fetchPositions();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to close position');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-3">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#eaecef]">Open Positions</h1>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${wsConnected ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#2b3139]'}`} />
          <span className={`text-[10px] ${wsConnected ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
            <Wifi size={9} className="inline mr-0.5" />{wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* FinBot Status Card */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <button
          onClick={() => setBotCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1e2329] transition"
        >
          <div className="flex items-center gap-2">
            <Bot size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">FinBot Status</span>
            {botStatus?.running && (
              <span className="text-[9px] bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/20 px-1.5 py-0.5 rounded-full animate-pulse">ACTIVE</span>
            )}
          </div>
          {botCollapsed ? <ChevronDown size={13} className="text-[#848e9c]" /> : <ChevronUp size={13} className="text-[#848e9c]" />}
        </button>
        {!botCollapsed && (
          <div className="border-t border-[#2b3139] px-4 py-3 space-y-2">
            {botStatus ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Status', value: botStatus.running ? 'Running' : 'Stopped', color: botStatus.running ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                    { label: 'Active Bots', value: botStatus.bots?.length?.toString() ?? '0', color: 'text-[#eaecef]' },
                    { label: 'Total Trades', value: botStatus.total_trades?.toString() ?? '0', color: 'text-[#eaecef]' },
                    { label: 'P&L', value: `${(botStatus.total_pnl ?? 0) >= 0 ? '+' : ''}$${(botStatus.total_pnl ?? 0).toFixed(2)}`, color: (botStatus.total_pnl ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0b0e11] rounded-xl px-3 py-2">
                      <p className="text-[9px] text-[#848e9c] mb-0.5">{s.label}</p>
                      <p className={`text-xs font-bold font-mono ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/app/bots')}
                  className="w-full text-center text-[10px] text-[#f0b90b] hover:underline py-1">
                  Manage Bots →
                </button>
              </>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-[#848e9c]">No bot data available</p>
                <button onClick={() => navigate('/app/bots')}
                  className="mt-2 text-[10px] text-[#f0b90b] hover:underline">
                  Set up a bot →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FinEvent AI Signals Card */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <button
          onClick={() => setEventCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1e2329] transition"
        >
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">FinEvent AI Signals</span>
            <span className="text-[9px] bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 px-1.5 py-0.5 rounded-full">{AI_EVENTS.length} signals</span>
          </div>
          {eventCollapsed ? <ChevronDown size={13} className="text-[#848e9c]" /> : <ChevronUp size={13} className="text-[#848e9c]" />}
        </button>
        {!eventCollapsed && (
          <div className="border-t border-[#2b3139] divide-y divide-[#2b3139]/50">
            {AI_EVENTS.map((ev, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-[#eaecef] font-mono">{ev.pair}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    ev.signal === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' :
                    ev.signal === 'SELL' ? 'bg-[#f6465d]/10 text-[#f6465d]' :
                    'bg-[#848e9c]/10 text-[#848e9c]'
                  }`}>{ev.signal}</span>
                  <span className="text-[9px] text-[#848e9c] truncate hidden sm:block">{ev.reason}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 bg-[#2b3139] rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${ev.signal === 'BUY' ? 'bg-[#0ecb81]' : ev.signal === 'SELL' ? 'bg-[#f6465d]' : 'bg-[#848e9c]'}`}
                      style={{ width: `${ev.confidence}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-[#eaecef] w-8 text-right">{ev.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balance / Margin Stats + P&L */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between items-center bg-[#0b0e11] rounded-xl px-4 py-1.5">
          <p className="text-[10px] text-[#848e9c]">Free Margin</p>
          <p className="text-sm font-bold font-mono text-[#0ecb81] text-right">
            ${availableMargin.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="flex justify-between items-center bg-[#0b0e11] rounded-xl px-4 py-1.5">
          <p className="text-[10px] text-[#848e9c]">Balance</p>
          <p className="text-sm font-bold font-mono text-[#eaecef] text-right">
            ${formatCompact(liveBalance)}
          </p>
        </div>

        <div className="flex justify-between items-center bg-[#0b0e11] rounded-xl px-4 py-1.5">
          <p className="text-[10px] text-[#848e9c]">Margin Used</p>
          <p className="text-sm font-bold font-mono text-[#f0b90b] text-right">
            ${marginUsed.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Unrealized P&L */}
        <div className="flex justify-between items-center bg-[#0b0e11] rounded-xl px-4 py-1.5">
          <p className="text-[10px] text-[#848e9c]">Unrealized P&L</p>
          <p className={`text-sm font-bold font-mono text-right ${
            unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
          }`}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

      </div>



      {/* Positions List */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <BarChart2 size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">
              {openPositions.length} Open Position{openPositions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={fetchPositions}
            className="p-1.5 rounded-lg hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {openPositions.length === 0 ? (
          <div className="py-14 text-center">
            <BarChart2 size={28} className="text-[#2b3139] mx-auto mb-3" />
            <p className="text-sm text-[#848e9c]">No open positions</p>
            <button
              onClick={() => navigate('/app/trade')}
              className="mt-3 px-4 py-2 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-xs text-[#f0b90b] hover:bg-[#f0b90b]/20 transition"
            >
              Go to Trade
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#2b3139]/50">
            {openPositions.map((pos) => {
              const pnl = pos.unrealized_pnl ?? 0;
              const pnlPct =
                pos.pnl_pct ??
                (pos.price > 0 ? ((pos.current_price - pos.price) / pos.price) * 100 : 0);

              return (
                <div key={pos.id} className="px-4 py-3 hover:bg-[#1e2329] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-[#eaecef]">{pos.ticker}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20">
                          {pos.exchange || 'Platform'}
                        </span>
                        {(pos.leverage ?? 1) > 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#627eea]/10 text-[#627eea] border border-[#627eea]/20">
                            {pos.leverage}x
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-[10px]">
                        <div>
                          <span className="text-[#848e9c]">Entry</span>
                          <p className="text-[#eaecef] font-mono font-semibold">
                            ${pos.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#848e9c]">Current</span>
                          <p className="text-[#eaecef] font-mono font-semibold">
                            ${pos.current_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#848e9c]">Qty</span>
                          <p className="text-[#eaecef] font-mono font-semibold">{pos.qty}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold font-mono ${
                            pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </p>
                        <p
                          className={`text-[10px] ${pnlPct >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}
                        >
                          {pnlPct >= 0 ? (
                            <TrendingUp size={8} className="inline mr-0.5" />
                          ) : (
                            <TrendingDown size={8} className="inline mr-0.5" />
                          )}
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </p>
                      </div>

                      <button
                        onClick={() => handleClose(pos.id)}
                        disabled={closingId === pos.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#f6465d]/10 border border-[#f6465d]/30 text-[#f6465d] hover:bg-[#f6465d] hover:text-white disabled:opacity-50 transition"
                      >
                        <X size={9} /> {closingId === pos.id ? 'Closing…' : 'Close'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}