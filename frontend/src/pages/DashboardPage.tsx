import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getEvents, getBotStatus, getTodayPnl, finEventListBots, getBotTrades } from '../lib/api';
import FinAiChatInline from '../components/FinAiChatInline';
import { useTickerPrices } from '../hooks/useTickerPrices';
import { useHotData } from '../hooks/useHotData';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
  Bot,
  Newspaper,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowRight,
  DollarSign,
  Lightbulb,
  Receipt,
  Bell,
  CalendarDays,
  MoreHorizontal,
  BarChart2,
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tickerItems = useTickerPrices(60000);
  useHotData();

  const [events, setEvents] = useState<
    { id: number; description: string; event_type: string; tickers_affected: string[]; created_at: string }[]
  >([]);
  const [botRunning, setBotRunning] = useState(false);
  const [finEventRunning, setFinEventRunning] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [btcToggle, setBtcToggle] = useState<'BTC' | 'ETH'>('BTC');
  const [todayPnl, setTodayPnl] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [openPositions, setOpenPositions] = useState(0);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [activeBotCount, setActiveBotCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  const balance = user?.balance_usdt ?? 0;

  const btcItem = tickerItems.find((t) => t.symbol === 'BTC/USDT');
  const ethItem = tickerItems.find((t) => t.symbol === 'ETH/USDT');

  const parsePrice = (s: string) => parseFloat(s.replace(/[$,]/g, '')) || 0;
  const btcPrice = btcItem ? parsePrice(btcItem.price) : 0;
  const ethPrice = ethItem ? parsePrice(ethItem.price) : 0;
  const priceLoading = !btcItem?.live;

  const displayPrice =
    (btcToggle === 'BTC' ? btcPrice : ethPrice) ||
    (btcToggle === 'BTC' ? 97000 : 3200);

  const btcEquiv = displayPrice > 0 ? (balance / displayPrice).toFixed(6) : '—';

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, botRes, pnlRes, finEventRes] = await Promise.all([
        getEvents(5),
        getBotStatus(),
        getTodayPnl(),
        finEventListBots().catch(() => ({ data: { bots: [] } })),
      ]);

      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : eventsRes.data?.events ?? []);
      setBotRunning(botRes.data?.running ?? false);
      setTodayPnl(pnlRes.data?.today_pnl ?? 0);

      // Unrealized P&L + open positions from bot status (accurate with leverage)
      const bots: Record<string, { position: number; unrealized_pnl: number; running?: boolean; portfolio_value?: number }> =
        botRes.data?.bots ?? {};
      let totalUnrealized = 0;
      let openCount = 0;
      let portfolioVal = 0;
      let activeBotCnt = 0;
      for (const bot of Object.values(bots)) {
        portfolioVal += bot.portfolio_value ?? 0;
        if (bot.running) activeBotCnt++;
        if (bot.position > 0) {
          totalUnrealized += bot.unrealized_pnl ?? 0;
          openCount++;
        }
      }
      setUnrealizedPnl(totalUnrealized);
      setOpenPositions(openCount);
      setPortfolioValue(portfolioVal);
      setActiveBotCount(activeBotCnt);

      // FinEvent running status
      const feBots: { running: boolean }[] = finEventRes.data?.bots ?? [];
      setFinEventRunning(Array.isArray(feBots) && feBots.some((b) => b.running));

      // News count + trade count
      try {
        const [newsRes, tradesRes] = await Promise.allSettled([
          fetch('/api/public/news').then(r => r.json()),
          getBotTrades(200),
        ]);
        if (newsRes.status === 'fulfilled' && Array.isArray(newsRes.value)) {
          setNewsCount(newsRes.value.length);
        }
        if (tradesRes.status === 'fulfilled') {
          setTradeCount(tradesRes.value.data?.trades?.length ?? 0);
        }
      } catch { /* silent */ }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-4">
    {/* Hero Balance Header */}
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, 10%)',
        borderBottom: '1px solid #2b3139',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(240,185,11,0.12) 0%, transparent 60%)',
        }}
      />

      <div className="relative p-6">
        {/* Balance Section */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[#848e9c]">
              Total Balance
            </p>
            <button
              onClick={() => setHideBalance((h) => !h)}
              className="w-8 h-8 rounded-full bg-[#0b0e11]/60 flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition border border-[#2b3139]/60"
            >
              {hideBalance ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-4xl font-extrabold font-mono text-[#eaecef] leading-none tracking-tight">
            {hideBalance ? '••••••' : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </p>
        </div>

        {/* BTC/ETH Toggle + Rate Info */}
        <div className="flex items-center gap-3 mt-2 mb-5">
          <div className="flex items-center gap-1 bg-[#0b0e11]/50 rounded-lg p-1">
            {(['BTC', 'ETH'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setBtcToggle(c)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                  btcToggle === c
                    ? 'bg-[#f0b90b] text-black'
                    : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {priceLoading ? (
            <div className="h-3 w-24 bg-[#2b3139] rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#848e9c] font-mono">
                {hideBalance ? '••••••' : btcEquiv} {btcToggle}
              </span>
              <span className="text-[10px] text-[#848e9c]">·</span>
              <span className="text-[10px] text-[#848e9c]">
                Rate: 1 {btcToggle} = ${displayPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <button onClick={fetchData} className="text-[#848e9c] hover:text-[#f0b90b] transition">
                <RefreshCw size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons - Deposit, Withdraw, Send */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <button
            onClick={() => navigate('/app/wallet?tab=deposit')}
            className="bg-[#0ecb81]/10 hover:bg-[#0ecb81]/20 text-[#0ecb81] py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Deposit
          </button>
          <button
            onClick={() => navigate('/app/wallet?tab=withdraw')}
            className="bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Withdraw
          </button>
          <button
            onClick={() => navigate('/app/wallet?tab=p2p')}
            className="bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
      
      {/* Small P&L Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            {todayPnl >= 0 ? <TrendingUp size={11} className="text-[#0ecb81]" /> : <TrendingDown size={11} className="text-[#f6465d]" />}
            <span className="text-[9px] text-[#848e9c]">Today's P&L</span>
          </div>
          <p className={`text-sm font-bold font-mono ${todayPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(2)}
          </p>
        </div>

        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <DollarSign size={11} className="text-[#f0b90b]" />
            <span className="text-[9px] text-[#848e9c]">Unrealized P&L</span>
          </div>
          <p className={`text-sm font-bold font-mono ${unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Portfolio Strip */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-[#848e9c]">Portfolio Value</span>
          <span className="text-xs font-bold font-mono text-[#eaecef]">${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="w-px h-6 bg-[#2b3139]" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-[#848e9c]">Active Bots</span>
          <span className="text-xs font-bold text-[#eaecef]">{activeBotCount}</span>
        </div>
        <div className="w-px h-6 bg-[#2b3139]" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-[#848e9c]">Open Positions</span>
          <span className="text-xs font-bold text-[#eaecef]">{openPositions}</span>
        </div>
      </div>
      
      {/* Open Positions - Separate Box */}
      {openPositions > 0 && (
        <div className="bg-[#161a1e] border border-[#f0b90b]/20 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#f0b90b]/10 flex items-center justify-center">
                <BarChart2 size={11} className="text-[#f0b90b]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#eaecef]">
                  {openPositions} Open Position{openPositions !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-[#848e9c]">All open bot positions</p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-bold font-mono ${
                  unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                }`}
              >
                {unrealizedPnl >= 0 ? '+' : ''}${Math.abs(unrealizedPnl).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
              <button
                onClick={() => navigate('/app/bots')}
                className="text-[10px] text-[#f0b90b] hover:text-[#eaecef] transition flex items-center gap-0.5 ml-auto"
              >
                View <ArrowRight size={8} />
              </button>
            </div>
          </div>
        </div>
      )}
     
      {/* Activity Center */}
      <div>
        <p className="text-xs font-bold text-[#eaecef] mb-3">Activity Center</p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => navigate('/app/news')} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-6 flex flex-col items-center justify-center relative">
            <Newspaper size={28} className="text-[#f0b90b] mb-2" />
            <span className="text-sm font-semibold">News</span>
            {newsCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-[#f0b90b] text-black text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {newsCount > 99 ? '99+' : newsCount}
              </span>
            )}
          </button>

          <button onClick={() => navigate('/app/bots')} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex flex-col items-center justify-center gap-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${botRunning ? 'bg-[#0ecb81]/10' : 'bg-[#2b3139]'}`}>
              <Bot size={22} className={botRunning ? 'text-[#0ecb81]' : 'text-[#848e9c]'} />
            </div>
            <span className="text-sm font-bold text-[#eaecef]">FIN BOT</span>
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] text-[#848e9c]">AI Bot</span>
              <span className={`flex items-center gap-0.5 text-[9px] font-semibold ${botRunning ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${botRunning ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#f6465d]'}`} />
                {botRunning ? 'Live' : 'Offline'}
              </span>
            </div>
            <div className="w-full h-px bg-[#2b3139]" />
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] text-[#848e9c]">FinEvent</span>
              <span className={`flex items-center gap-0.5 text-[9px] font-semibold ${finEventRunning ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${finEventRunning ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#f6465d]'}`} />
                {finEventRunning ? 'Live' : 'Offline'}
              </span>
            </div>
          </button>
          
          <button onClick={() => navigate('/app/trade')} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-6 flex flex-col items-center justify-center relative">
            <Activity size={28} className="text-[#eaecef] mb-2" />
            <span className="text-sm font-semibold">Trade</span>
            {tradeCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-[#627eea] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {tradeCount > 99 ? '99+' : tradeCount}
              </span>
            )}
          </button>
        </div>
      </div>


      {/* Quick Actions */}
      <div>
        <p className="text-xs font-bold text-[#eaecef] mb-3">Quick Actions</p>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Signals',  icon: Lightbulb,     path: '/app/recommendations' },
            { label: 'History',  icon: Receipt,        path: '/app/transactions' },
            { label: 'Alert',    icon: Bell,           path: '/app/alerts' },
            { label: 'Calendar', icon: CalendarDays,   path: '/app/calendar' },
            { label: 'More',     icon: MoreHorizontal, path: '/app/wallet' },
          ].map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="bg-[#161a1e] border border-[#2b3139] rounded-xl py-4 flex flex-col items-center justify-center gap-1.5 hover:bg-[#1e2329] transition"
            >
              <Icon size={18} className="text-[#f0b90b]" />
              <span className="text-[9px] text-[#848e9c] text-center font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* AI Events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[#eaecef]">AI Market Events</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] inline-block animate-pulse" />
            <Zap size={12} className="text-[#f0b90b]" />
          </div>
        </div>
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl divide-y divide-[#2b3139]">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Activity size={20} className="text-[#2b3139]" />
              <p className="text-xs text-[#848e9c]">No recent AI events</p>
              <p className="text-[10px] text-[#4a5568]">Events are ingested every 15 minutes</p>
            </div>
          ) : (
            events.slice(0, 5).map((ev, i) => (
              <div key={i} className="px-4 py-3 hover:bg-[#1e2329] transition">
                <p className="text-xs text-[#eaecef] leading-relaxed line-clamp-2">
                  {ev.description ?? ev.event_type}
                </p>
                <p className="text-[10px] text-[#848e9c] mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f0b90b] inline-block" />
                  {ev.tickers_affected?.[0] ?? 'Market'} ·{' '}
                  {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FinAi Assistant — embedded static section */}
      <div>
        <p className="text-xs font-bold text-[#eaecef] mb-3 flex items-center gap-1.5">
          <Zap size={12} className="text-[#f0b90b]" /> FinAi Assistant
        </p>
        <FinAiChatInline />
      </div>
    </div>
  );
}