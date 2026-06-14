import { useState, useEffect } from 'react';
import { getMyTransactions, getBotTrades } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency } from '../lib/i18n';
import {
  ArrowDownLeft, ArrowUpRight, RefreshCw, Clock,
  CheckCircle, XCircle, Search, SlidersHorizontal,
  Bot, TrendingUp, Zap, TrendingDown, ShoppingBag, Server
} from 'lucide-react';
import TransactionDetailModal, { buildTxDetail, buildBotTradeDetail, buildTradeDetail } from '../components/TransactionDetailModal';
import type { TxDetail } from '../components/TransactionDetailModal';

interface Tx {
  id: number; tx_type: string; method: string; asset: string;
  amount_usdt: number; status: string; note?: string;
  tx_hash?: string; wallet_address?: string; created_at: string;
}
interface BotTrade {
  id: number; ticker: string; action: string; price: number;
  qty: number; pnl: number | null; reason: string | null;
  exchange: string; created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit', withdrawal: 'Withdrawal',
  p2p_send: 'P2P Send', p2p_receive: 'P2P Receive',
  trade: 'Trade', vps: 'VPS Rent', asset: 'Asset Buy',
};

const FILTERS = ['all', 'deposit', 'withdrawal', 'p2p_send', 'p2p_receive'] as const;

function txIcon(type: string) {
  if (type === 'deposit' || type === 'p2p_receive')
    return <ArrowDownLeft size={14} className="text-[#0ecb81]" />;
  if (type === 'withdrawal' || type === 'p2p_send')
    return <ArrowUpRight size={14} className="text-[#f6465d]" />;
  return <RefreshCw size={14} className="text-[#f0b90b]" />;
}
function txIconBg(type: string) {
  if (type === 'deposit' || type === 'p2p_receive') return 'bg-[#0ecb81]/10 border-[#0ecb81]/20';
  if (type === 'withdrawal' || type === 'p2p_send') return 'bg-[#f6465d]/10 border-[#f6465d]/20';
  return 'bg-[#f0b90b]/10 border-[#f0b90b]/20';
}
function statusBadge(s: string) {
  if (s === 'completed' || s === 'approved')
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81] inline-flex items-center gap-0.5 font-medium"><CheckCircle size={9} /> Approved</span>;
  if (s === 'rejected' || s === 'failed')
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d] inline-flex items-center gap-0.5 font-medium"><XCircle size={9} /> Failed</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] inline-flex items-center gap-0.5 font-medium"><Clock size={9} /> Pending</span>;
}
function isIn(type: string) { return ['deposit', 'p2p_receive'].includes(type); }
function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtK(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000)        return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${fmt(abs)}`;
}

type PageTab = 'transactions' | 'bot_history' | 'trade_history' | 'store_history';

export default function TransactionHistoryPage() {
  const { currency } = useLanguage();
  const [pageTab, setPageTab] = useState<PageTab>('transactions');
  const [txs, setTxs] = useState<Tx[]>([]);
  const [botTrades, setBotTrades] = useState<BotTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [botLoading, setBotLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [botSearch, setBotSearch] = useState('');
  const [botActionFilter, setBotActionFilter] = useState<'all' | 'BUY' | 'SELL'>('all');
  const [storeTxs, setStoreTxs] = useState<Tx[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<TxDetail | null>(null);

  useEffect(() => {
    getMyTransactions()
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : [];
        setTxs(all);
        setStoreTxs(all.filter((t: Tx) => (t.tx_type === 'vps' || t.tx_type === 'asset') && (t.status === 'cancelled' || t.status === 'rejected')));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getBotTrades(500)
      .then(r => { const d = r.data; setBotTrades(Array.isArray(d) ? d : (d?.trades ?? [])); })
      .catch(() => {})
      .finally(() => setBotLoading(false));
  }, []);

  const filtered = txs.filter(tx => {
    const matchFilter = filter === 'all' || tx.tx_type === filter;
    const matchSearch = !search ||
      tx.tx_type.toLowerCase().includes(search.toLowerCase()) ||
      tx.method?.toLowerCase().includes(search.toLowerCase()) ||
      tx.tx_hash?.toLowerCase().includes(search.toLowerCase()) ||
      tx.note?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // AI Bot History = automated bot trades (reason does NOT contain "trading terminal")
  const autoBotTrades = botTrades.filter(t => !t.reason?.toLowerCase().includes('trading terminal'));
  // Trade History = manual trades placed from the Trade page (reason contains "trading terminal")
  const manualTrades = botTrades.filter(t => t.reason?.toLowerCase().includes('trading terminal'));

  const filteredBotTrades = autoBotTrades.filter(t => {
    const matchAction = botActionFilter === 'all' || t.action === botActionFilter;
    const matchSearch = !botSearch ||
      t.ticker.toLowerCase().includes(botSearch.toLowerCase()) ||
      (t.reason || '').toLowerCase().includes(botSearch.toLowerCase()) ||
      t.exchange?.toLowerCase().includes(botSearch.toLowerCase());
    return matchAction && matchSearch;
  });

  const filteredManualTrades = manualTrades.filter(t => {
    const matchAction = botActionFilter === 'all' || t.action === botActionFilter;
    const matchSearch = !botSearch ||
      t.ticker.toLowerCase().includes(botSearch.toLowerCase()) ||
      (t.reason || '').toLowerCase().includes(botSearch.toLowerCase()) ||
      t.exchange?.toLowerCase().includes(botSearch.toLowerCase());
    return matchAction && matchSearch;
  });


  const totalIn = txs.filter(t => isIn(t.tx_type) && t.status !== 'rejected').reduce((s, t) => s + t.amount_usdt, 0);
  const totalOut = txs.filter(t => !isIn(t.tx_type) && t.status !== 'rejected' && ['withdrawal', 'p2p_send'].includes(t.tx_type)).reduce((s, t) => s + t.amount_usdt, 0);

  const botPnl = autoBotTrades.filter(t => t.pnl !== null).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const botWins = autoBotTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const botClosedTrades = autoBotTrades.filter(t => t.pnl !== null);

  const manualPnl = manualTrades.filter(t => t.pnl !== null).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const manualVol = manualTrades.reduce((s, t) => s + t.price * t.qty, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <TransactionDetailModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#eaecef]">History</h1>
        <button onClick={() => setShowFilters(v => !v)}
          className="sm:hidden flex items-center gap-1.5 text-xs text-[#848e9c] bg-[#161a1e] border border-[#2b3139] px-3 py-2 rounded-xl">
          <SlidersHorizontal size={12} /> Filters
        </button>
      </div>

      {/* Page Tabs */}
      <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
        {([
          ['transactions',  'Transactions',  ArrowDownLeft],
          ['bot_history',   'AI Bot',        Bot],
          ['trade_history', 'Trade',         TrendingUp],
          ['store_history', 'Store',         ShoppingBag],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setPageTab(id as PageTab)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${pageTab === id ? 'bg-[#f0b90b] text-black shadow-md' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
            <Icon size={11} /><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ── TRANSACTIONS TAB ── */}
      {pageTab === 'transactions' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Deposited</p>
              <p className="text-base font-bold font-mono text-[#0ecb81] truncate">+{fmtK(totalIn)}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Withdrawn</p>
              <p className="text-base font-bold font-mono text-[#f6465d] truncate">-{fmtK(totalOut)}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Total Txs</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{txs.length}</p>
            </div>
          </div>

          <div className={`gap-3 items-center flex-wrap ${showFilters ? 'flex' : 'hidden sm:flex'}`}>
            <div className="relative flex-1 min-w-0 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="w-full bg-[#161a1e] border border-[#2b3139] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
            </div>
            <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1 overflow-x-auto flex-shrink-0">
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${filter === f ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                  {f === 'all' ? 'All' : TYPE_LABELS[f] || f}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[#161a1e] border border-[#2b3139] animate-pulse" />) :
              filtered.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2"><RefreshCw size={28} className="text-[#2b3139]" /><p className="text-sm text-[#848e9c]">No transactions found</p></div>
              ) : filtered.map(tx => (
                <div key={tx.id} onClick={() => setSelectedDetail(buildTxDetail(tx))} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:border-[#f0b90b]/30 transition">
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${txIconBg(tx.tx_type)}`}>{txIcon(tx.tx_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#eaecef]">{TYPE_LABELS[tx.tx_type] || tx.tx_type}</p>
                      <p className={`text-sm font-bold font-mono ${isIn(tx.tx_type) ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{isIn(tx.tx_type) ? '+' : '-'}{formatCurrency(tx.amount_usdt, currency)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <p className="text-[10px] text-[#848e9c] capitalize">{tx.method?.replace(/_/g, ' ')} · {new Date(tx.created_at).toLocaleDateString()}</p>
                      {statusBadge(tx.status)}
                    </div>
                    {tx.note && <p className="text-[10px] text-[#4a5568] mt-1 truncate">{tx.note}</p>}
                  </div>
                </div>
              ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-[#848e9c] text-xs border-b border-[#2b3139] bg-[#0b0e11]/40">
                    <th className="text-left px-5 py-3 font-medium">Type</th>
                    <th className="text-left px-5 py-3 font-medium">Method</th>
                    <th className="text-right px-5 py-3 font-medium">Amount</th>
                    <th className="text-right px-5 py-3 font-medium">Status</th>
                    <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">TX Hash</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Note</th>
                    <th className="text-right px-5 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-12 text-center text-[#848e9c] text-sm"><RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#f0b90b]" />Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center"><RefreshCw size={24} className="text-[#2b3139] mx-auto mb-2" /><p className="text-[#848e9c] text-sm">No transactions found</p></td></tr>
                  ) : filtered.map(tx => (
                    <tr key={tx.id} onClick={() => setSelectedDetail(buildTxDetail(tx))} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition cursor-pointer">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full border flex items-center justify-center ${txIconBg(tx.tx_type)}`}>{txIcon(tx.tx_type)}</div>
                          <span className="text-xs font-semibold text-[#eaecef]">{TYPE_LABELS[tx.tx_type] || tx.tx_type}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#848e9c] capitalize">{tx.method?.replace(/_/g, ' ')}</td>
                      <td className={`px-5 py-3.5 text-right font-mono text-sm font-bold ${isIn(tx.tx_type) ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{isIn(tx.tx_type) ? '+' : '-'}{formatCurrency(tx.amount_usdt, currency)}</td>
                      <td className="px-5 py-3.5 text-right">{statusBadge(tx.status)}</td>
                      <td className="px-5 py-3.5 font-mono text-[10px] text-[#848e9c] hidden lg:table-cell max-w-[120px] truncate">{tx.tx_hash ? `${tx.tx_hash.slice(0, 14)}…` : '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-[#848e9c] hidden md:table-cell max-w-[120px] truncate">{tx.note || '—'}</td>
                      <td className="px-5 py-3.5 text-right text-[10px] text-[#848e9c] whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── AI BOT HISTORY TAB ── */}
      {pageTab === 'bot_history' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Total Trades</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{botTrades.length.toLocaleString()}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Realized P&L</p>
              <p className={`text-base font-bold font-mono truncate ${botPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{botPnl >= 0 ? '+' : ''}{fmtK(botPnl)}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Win Rate</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{botClosedTrades.length > 0 ? ((botWins / botClosedTrades.length) * 100).toFixed(1) : '—'}%</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Closed Trades</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{botClosedTrades.length.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
              <input value={botSearch} onChange={e => setBotSearch(e.target.value)} placeholder="Search ticker, reason…"
                className="w-full bg-[#161a1e] border border-[#2b3139] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
            </div>
            <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
              {(['all','BUY','SELL'] as const).map(a => (
                <button key={a} onClick={() => setBotActionFilter(a)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${botActionFilter === a ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                  {a === 'all' ? 'All' : a}
                </button>
              ))}
            </div>
          </div>

          {/* Card list */}
          <div className="space-y-2">
            {botLoading
              ? [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[#161a1e] border border-[#2b3139] animate-pulse" />)
              : filteredBotTrades.length === 0
              ? (
                <div className="py-16 flex flex-col items-center gap-2">
                  <Bot size={28} className="text-[#2b3139]" />
                  <p className="text-sm text-[#848e9c]">No AI bot trades yet</p>
                </div>
              )
              : filteredBotTrades.map((t, i) => {
                const isBuy = t.action === 'BUY';
                const hasPnl = t.pnl !== null;
                const pnlPos = (t.pnl ?? 0) >= 0;
                return (
                  <div key={t.id ?? i} onClick={() => setSelectedDetail(buildBotTradeDetail(t))} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex items-start gap-3 hover:border-[#f0b90b]/30 transition cursor-pointer">
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${isBuy ? 'bg-[#0ecb81]/10 border-[#0ecb81]/20' : 'bg-[#f6465d]/10 border-[#f6465d]/20'}`}>
                      {isBuy ? <TrendingUp size={14} className="text-[#0ecb81]" /> : <TrendingDown size={14} className="text-[#f6465d]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#eaecef] font-mono">{t.ticker}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.action}</span>
                          <Bot size={10} className="text-[#f0b90b]" />
                        </div>
                        <div className="text-right">
                          {hasPnl
                            ? <p className={`text-sm font-bold font-mono ${pnlPos ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{pnlPos ? '+' : ''}${fmt(t.pnl!)}</p>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-medium">Open</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-[10px] text-[#848e9c]">
                          ${t.price < 1 ? t.price.toFixed(5) : fmt(t.price)} · {t.qty.toFixed(4)} qty
                          {t.reason ? ` · ${t.reason.replace(/_/g, ' ').slice(0, 40)}` : ''}
                        </p>
                        <p className="text-[10px] text-[#848e9c] whitespace-nowrap">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}

      {/* ── TRADE HISTORY TAB ── */}
      {pageTab === 'trade_history' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Total Trades</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{manualTrades.length.toLocaleString()}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Volume (USDT)</p>
              <p className="text-base font-bold font-mono text-[#eaecef] truncate">{fmtK(manualVol)}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Realized P&L</p>
              <p className={`text-base font-bold font-mono truncate ${manualPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{manualPnl >= 0 ? '+' : ''}{fmtK(manualPnl)}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Closed</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{manualTrades.filter(t => t.pnl !== null).length.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
              <input value={botSearch} onChange={e => setBotSearch(e.target.value)} placeholder="Search ticker, exchange…"
                className="w-full bg-[#161a1e] border border-[#2b3139] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
            </div>
            <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1">
              {(['all','BUY','SELL'] as const).map(a => (
                <button key={a} onClick={() => setBotActionFilter(a)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${botActionFilter === a ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
                  {a === 'all' ? 'All' : a}
                </button>
              ))}
            </div>
          </div>

          {/* Card list */}
          <div className="space-y-2">
            {botLoading
              ? [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[#161a1e] border border-[#2b3139] animate-pulse" />)
              : filteredManualTrades.length === 0
              ? (
                <div className="py-16 flex flex-col items-center gap-2">
                  <Zap size={28} className="text-[#2b3139]" />
                  <p className="text-sm text-[#848e9c]">No manual trades found — place trades from the Trade page</p>
                </div>
              )
              : filteredManualTrades.map((t, i) => {
                const isBuy = t.action === 'BUY';
                const hasPnl = t.pnl !== null;
                const pnlPos = (t.pnl ?? 0) >= 0;
                return (
                  <div key={t.id ?? i} onClick={() => setSelectedDetail(buildTradeDetail(t))} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex items-start gap-3 hover:border-[#f0b90b]/30 transition cursor-pointer">
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${isBuy ? 'bg-[#0ecb81]/10 border-[#0ecb81]/20' : 'bg-[#f6465d]/10 border-[#f6465d]/20'}`}>
                      {isBuy ? <TrendingUp size={14} className="text-[#0ecb81]" /> : <TrendingDown size={14} className="text-[#f6465d]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#eaecef] font-mono">{t.ticker}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>{t.action}</span>
                          <Zap size={10} className="text-[#f0b90b]" />
                        </div>
                        <div className="text-right">
                          {hasPnl
                            ? <p className={`text-sm font-bold font-mono ${pnlPos ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{pnlPos ? '+' : ''}${fmt(t.pnl!)}</p>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] font-medium">Open</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-[10px] text-[#848e9c]">
                          ${t.price < 1 ? t.price.toFixed(5) : fmt(t.price)} · {t.qty.toFixed(4)} qty
                          {t.exchange ? ` · ${t.exchange}` : ''}
                        </p>
                        <p className="text-[10px] text-[#848e9c] whitespace-nowrap">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}

      {/* ── STORE HISTORY TAB ── */}
      {pageTab === 'store_history' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Closed</p>
              <p className="text-base font-bold font-mono text-[#eaecef]">{storeTxs.filter(t => t.status === 'cancelled').length}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Rejected</p>
              <p className="text-base font-bold font-mono text-[#f6465d]">{storeTxs.filter(t => t.status === 'rejected').length}</p>
            </div>
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
              <p className="text-[10px] text-[#848e9c] mb-1.5 font-medium uppercase tracking-wide">Total Value</p>
              <p className="text-base font-bold font-mono text-[#848e9c] truncate">
                ${storeTxs.reduce((s, t) => s + t.amount_usdt, 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[#161a1e] border border-[#2b3139] animate-pulse" />)
            ) : storeTxs.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2">
                <ShoppingBag size={28} className="text-[#2b3139]" />
                <p className="text-sm text-[#848e9c]">No closed store history yet</p>
                <p className="text-xs text-[#4a5568]">Closed and rejected purchases appear here</p>
              </div>
            ) : storeTxs.map(tx => {
              const isAsset = tx.tx_type === 'asset';
              const isCancelled = tx.status === 'cancelled';
              return (
                <div key={tx.id} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0
                    ${isAsset ? 'bg-[#f0b90b]/10 border-[#f0b90b]/20' : 'bg-[#0ecb81]/10 border-[#0ecb81]/20'}`}>
                    {isAsset ? <TrendingUp size={14} className="text-[#f0b90b]" /> : <Server size={14} className="text-[#0ecb81]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#eaecef]">{tx.asset || (isAsset ? 'Asset' : 'VPS')}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isAsset ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'bg-[#0ecb81]/10 text-[#0ecb81]'}`}>
                            {isAsset ? 'ASSET' : 'VPS'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                            ${isCancelled ? 'bg-[#848e9c]/10 text-[#848e9c]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                            {isCancelled ? 'Closed' : 'Rejected'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold font-mono text-[#848e9c]">
                          ${tx.amount_usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-[#4a5568]">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {tx.note && <p className="text-[10px] text-[#4a5568] mt-1 truncate">{tx.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
