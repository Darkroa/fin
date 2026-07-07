import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, SafeAreaView,
  Modal, FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font, shadow } from '../theme';
import {
  getBotStatus, startBot, stopBot, getBotTrades, getBotPnlHistory,
  finEventListBots, finEventStart, finEventStop,
  finEventTrades, finEventClosePosition,
  getSubscriptionLimits,
} from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────
interface BotDetail {
  ticker: string; running: boolean; strategy?: string; direction?: string;
  leverage?: number; capital?: number; lot_size?: number;
  entry_price?: number; qty?: number; side?: string;
  pnl?: number; win_rate?: number; total_trades?: number;
  unrealized_pnl?: number; realized_pnl?: number;
  last_signal?: string; last_price?: number;
  sl?: number; tp?: number;
}

interface FeBot { bot_name: string; running: boolean; status?: string }

const STRATEGIES = ['SMA', 'FinLux', 'AUTO', 'LIVE'];
const DIRECTIONS = ['Auto', 'Buy', 'Sell'];
const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125, 200, 300, 400, 500, 750, 1000, 1200];

const TICKERS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT',
  'LTC/USDT', 'XAU/USD', 'XAG/USD', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'SPY',
];

function fmt(n: number, d = 2) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(n: number) {
  if (!isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function dollar(n: number) {
  if (!isFinite(n)) return '—';
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, width = 100, height = 36 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return <View style={{ width, height }} />;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const pts   = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const isUp = data[data.length - 1] >= data[0];
  const lineColor = isUp ? colors.green : colors.red;
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {pts.slice(1).map((pt, i) => {
        const prev  = pts[i];
        const dx    = pt.x - prev.x;
        const dy    = pt.y - prev.y;
        const len   = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: prev.x, top: prev.y - 0.75,
              width: len, height: 1.5,
              backgroundColor: lineColor,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type MCIName     = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface StatCardProps {
  label: string; value: string; sub?: string; color?: string;
  iconName?: IoniconName | MCIName; iconLib?: 'ionicon' | 'mci';
}

function StatCard({ label, value, sub, color, iconName, iconLib = 'ionicon' }: StatCardProps) {
  return (
    <View style={sc.card}>
      <View style={sc.iconCircle}>
        {iconName ? (
          iconLib === 'mci'
            ? <MaterialCommunityIcons name={iconName as MCIName} size={16} color={colors.accent} />
            : <Ionicons name={iconName as IoniconName} size={16} color={colors.accent} />
        ) : (
          <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
        )}
      </View>
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.value, color ? { color } : {}]}>{value}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  );
}

const sc = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border, minWidth: 80 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, textAlign: 'center' },
  value: { fontSize: font.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
});

// ── BotCard ───────────────────────────────────────────────────────────────────
interface BotCardProps {
  bot: BotDetail; onStop: (ticker: string) => void; stopping: boolean;
  recentTrades: any[]; pnlHistory: number[];
}

function BotCard({ bot, onStop, stopping, recentTrades, pnlHistory }: BotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isUp    = (bot.unrealized_pnl ?? bot.pnl ?? 0) >= 0;
  const upnl    = bot.unrealized_pnl ?? 0;
  const rpnl    = bot.realized_pnl ?? bot.pnl ?? 0;
  const winRate = bot.win_rate ?? 0;
  const signal  = bot.last_signal ?? (bot.running ? 'idle' : 'stopped');
  const signalColor = signal.toLowerCase().includes('buy') || signal.toLowerCase().includes('long')
    ? colors.green : signal.toLowerCase().includes('sell') || signal.toLowerCase().includes('short')
    ? colors.red : colors.textSecondary;
  const direction = (bot.direction ?? 'auto').toUpperCase();
  const strategy  = bot.strategy ?? 'SMA';
  const leverage  = bot.leverage ?? 1;

  return (
    <View style={bc.card}>
      {/* Card header */}
      <TouchableOpacity style={bc.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={bc.headerLeft}>
          <View style={[bc.runDot, { backgroundColor: bot.running ? colors.green : colors.textMuted }]} />
          <View>
            <Text style={bc.ticker}>{bot.ticker}</Text>
            <View style={bc.tagRow}>
              <View style={bc.stratTag}><Text style={bc.stratTagText}>{strategy}</Text></View>
              <View style={[bc.dirTag, { backgroundColor: direction === 'BUY' ? colors.greenMuted : direction === 'SELL' ? colors.redMuted : colors.accentMuted }]}>
                <Text style={[bc.dirTagText, { color: direction === 'BUY' ? colors.green : direction === 'SELL' ? colors.red : colors.accent }]}>{direction}</Text>
              </View>
              {leverage > 1 && <View style={bc.levTag}><Text style={bc.levTagText}>{leverage}x</Text></View>}
            </View>
          </View>
        </View>
        <View style={bc.headerRight}>
          {pnlHistory.length > 1 && <Sparkline data={pnlHistory} width={64} height={28} />}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[bc.pnlVal, { color: isUp ? colors.green : colors.red }]}>{dollar(upnl)}</Text>
            <Text style={bc.pnlLabel}>Unrealized</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Signal strip */}
      <View style={bc.signalStrip}>
        <View style={[bc.signalDot, { backgroundColor: signalColor }]} />
        <Text style={[bc.signalText, { color: signalColor }]}>{signal}</Text>
        {bot.last_price && <Text style={bc.priceText}>${bot.last_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>}
      </View>

      {/* Stats row */}
      <View style={bc.statsRow}>
        {[
          { l: 'Win Rate', v: `${fmt(winRate, 1)}%`, c: winRate >= 50 ? colors.green : colors.red },
          { l: 'Realized', v: dollar(rpnl),           c: rpnl >= 0 ? colors.green : colors.red },
          { l: 'Trades',   v: String(bot.total_trades ?? 0), c: colors.text },
          { l: 'Capital',  v: bot.capital ? `$${fmt(bot.capital)}` : '—', c: colors.text },
        ].map(s => (
          <View key={s.l} style={bc.statBox}>
            <Text style={bc.statLabel}>{s.l}</Text>
            <Text style={[bc.statVal, { color: s.c }]}>{s.v}</Text>
          </View>
        ))}
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={bc.expanded}>
          {/* Open position */}
          {bot.entry_price && bot.qty && (
            <View style={bc.posBox}>
              <Text style={bc.posBoxTitle}>OPEN POSITION</Text>
              <View style={bc.posBoxRow}>
                <Text style={bc.posBoxLabel}>Entry</Text>
                <Text style={bc.posBoxVal}>${bot.entry_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
              </View>
              <View style={bc.posBoxRow}>
                <Text style={bc.posBoxLabel}>Qty</Text>
                <Text style={bc.posBoxVal}>{bot.qty.toFixed(6)}</Text>
              </View>
              <View style={bc.posBoxRow}>
                <Text style={bc.posBoxLabel}>Side</Text>
                <Text style={[bc.posBoxVal, { color: (bot.side ?? '').toUpperCase() === 'BUY' ? colors.green : colors.red }]}>{(bot.side ?? '').toUpperCase() || '—'}</Text>
              </View>
              {bot.sl && (
                <View style={bc.posBoxRow}>
                  <Text style={bc.posBoxLabel}>Stop Loss</Text>
                  <Text style={[bc.posBoxVal, { color: colors.red }]}>${bot.sl.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
                </View>
              )}
              {bot.tp && (
                <View style={bc.posBoxRow}>
                  <Text style={bc.posBoxLabel}>Take Profit</Text>
                  <Text style={[bc.posBoxVal, { color: colors.green }]}>${bot.tp.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
                </View>
              )}
            </View>
          )}

          {/* Recent trades */}
          {recentTrades.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={bc.posBoxTitle}>RECENT TRADES</Text>
              {recentTrades.slice(0, 5).map((t: any, i: number) => {
                const isBuy = (t.action ?? t.side ?? '').toUpperCase() === 'BUY';
                const tradeTime = t.created_at ? new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
                const tPnl = t.pnl ?? t.profit ?? 0;
                return (
                  <View key={i} style={[bc.tradeRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={bc.tradeSideRow}>
                      <Ionicons name={isBuy ? 'trending-up' : 'trending-down'} size={12} color={isBuy ? colors.green : colors.red} />
                      <Text style={[bc.tradeSide, { color: isBuy ? colors.green : colors.red }]}>{isBuy ? 'Buy' : 'Sell'}</Text>
                    </View>
                    <Text style={bc.tradePrice}>${(t.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
                    <Text style={[bc.tradePnl, { color: tPnl >= 0 ? colors.green : colors.red }]}>{tPnl >= 0 ? '+' : ''}{tPnl.toFixed(2)}</Text>
                    <Text style={bc.tradeTime}>{tradeTime}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Stop button */}
          <TouchableOpacity
            style={[bc.stopBtn, stopping && { opacity: 0.5 }]}
            onPress={() => onStop(bot.ticker)}
            disabled={stopping}
          >
            {stopping ? <ActivityIndicator color={colors.red} size="small" /> : (
              <View style={bc.stopBtnInner}>
                <Ionicons name="stop-circle-outline" size={16} color={colors.red} />
                <Text style={bc.stopBtnText}>Stop Bot</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const bc = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, marginBottom: spacing.sm, overflow: 'hidden', ...shadow.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, gap: spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  runDot: { width: 8, height: 8, borderRadius: 4 },
  ticker: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: 3 },
  tagRow: { flexDirection: 'row', gap: 4 },
  stratTag: { backgroundColor: colors.accentMuted, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  stratTagText: { fontSize: 9, fontWeight: '700', color: colors.accent },
  dirTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  dirTagText: { fontSize: 9, fontWeight: '700' },
  levTag: { backgroundColor: colors.border + '80', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  levTagText: { fontSize: 9, fontWeight: '700', color: colors.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pnlVal: { fontSize: font.sm, fontWeight: '700' },
  pnlLabel: { fontSize: 9, color: colors.textMuted },
  signalStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.bg + '80', borderTopWidth: 1, borderTopColor: colors.border + '50' },
  signalDot: { width: 6, height: 6, borderRadius: 3 },
  signalText: { fontSize: 10, fontWeight: '600', flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  priceText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  statsRow: { flexDirection: 'row', padding: spacing.xs, gap: spacing.xs },
  statBox: { flex: 1, backgroundColor: colors.bg + '60', borderRadius: radius.sm, padding: spacing.xs, alignItems: 'center' },
  statLabel: { fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  statVal: { fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' },
  expanded: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm },
  posBox: { backgroundColor: colors.bg + '80', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border + '60', padding: spacing.sm },
  posBoxTitle: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  posBoxRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  posBoxLabel: { fontSize: 11, color: colors.textSecondary },
  posBoxVal: { fontSize: 11, fontWeight: '600', color: colors.text },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  tradeSideRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  tradeSide: { fontSize: 11, fontWeight: '700' },
  tradePrice: { fontSize: 11, color: colors.text, flex: 2, textAlign: 'center' },
  tradePnl: { fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'center' },
  tradeTime: { fontSize: 10, color: colors.textMuted, flex: 1, textAlign: 'right' },
  stopBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.red + '60', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  stopBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.red },
});

// ── AddBotForm ────────────────────────────────────────────────────────────────
interface AddBotFormProps {
  onClose: () => void; onLaunch: (params: Record<string, unknown>) => Promise<void>; isPro: boolean;
}

function AddBotForm({ onClose, onLaunch, isPro }: AddBotFormProps) {
  const [ticker, setTicker]       = useState('BTC/USDT');
  const [showTickers, setShowTk]  = useState(false);
  const [strategy, setStrategy]   = useState('SMA');
  const [direction, setDirection] = useState('Auto');
  const [capital, setCapital]     = useState('1000');
  const [lotSize, setLotSize]     = useState('0.01');
  const [pctTrade, setPctTrade]   = useState('10');
  const [maxDD, setMaxDD]         = useState('20');
  const [tp, setTp]               = useState('');
  const [sl, setSl]               = useState('');
  const [leverage, setLeverage]   = useState(1);
  const [levIndex, setLevIndex]   = useState(0);
  const [cooldown, setCooldown]   = useState('60');
  const [numTrades, setNumTrades] = useState('10');
  const [loading, setLoading]     = useState(false);

  const proGated = strategy === 'LIVE' && !isPro;
  const margin   = capital && lotSize ? (parseFloat(capital) * parseFloat(lotSize)) / Math.max(leverage, 1) : 0;

  const riskLevel = leverage > 50 ? 'High' : leverage > 10 ? 'Medium' : 'Low';
  const riskColor = leverage > 50 ? colors.red : leverage > 10 ? colors.accent : colors.green;

  const handleLaunch = async () => {
    if (proGated) { Alert.alert('Pro Required', 'LIVE strategy requires a Pro subscription'); return; }
    setLoading(true);
    try {
      await onLaunch({
        ticker, strategy, direction: direction.toLowerCase(),
        capital:     parseFloat(capital)  || 1000,
        lot_size:    parseFloat(lotSize)  || 0.01,
        pct_per_trade: parseFloat(pctTrade) || 10,
        max_drawdown:  parseFloat(maxDD)    || 20,
        take_profit:   tp ? parseFloat(tp) : undefined,
        stop_loss:     sl ? parseFloat(sl) : undefined,
        leverage:      leverage > 1 ? leverage : undefined,
        execution_cooldown: parseInt(cooldown) || 60,
        num_trades:         parseInt(numTrades) || 10,
      });
    } finally { setLoading(false); }
  };

  return (
    <View style={af.container}>
      {/* Header */}
      <View style={af.header}>
        <View style={af.headerLeft}>
          <View style={af.headerIcon}>
            <Ionicons name="rocket-outline" size={18} color={colors.accent} />
          </View>
          <Text style={af.title}>Launch FinBot</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={af.closeBtn}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView style={af.scroll} contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>

        {/* Ticker */}
        <Text style={af.label}>Ticker</Text>
        <TouchableOpacity style={af.selector} onPress={() => setShowTk(true)}>
          <Text style={af.selectorText}>{ticker}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Strategy */}
        <Text style={af.label}>Strategy</Text>
        <View style={af.segmented}>
          {STRATEGIES.map(s => {
            const isLocked = s === 'LIVE' && !isPro;
            return (
              <TouchableOpacity
                key={s}
                style={[af.segBtn, strategy === s && af.segBtnActive, isLocked && { opacity: 0.5 }]}
                onPress={() => setStrategy(s)}
              >
                <View style={af.segBtnInner}>
                  <Text style={[af.segBtnText, strategy === s && af.segBtnTextActive]}>{s}</Text>
                  {isLocked && <Ionicons name="lock-closed-outline" size={10} color={colors.textMuted} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Direction */}
        <Text style={af.label}>Direction</Text>
        <View style={af.segmented}>
          {DIRECTIONS.map(d => (
            <TouchableOpacity key={d} style={[af.segBtn, direction === d && af.segBtnActive]} onPress={() => setDirection(d)}>
              <Text style={[af.segBtnText, direction === d && af.segBtnTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Capital + Lot Size */}
        <View style={af.row2}>
          <View style={af.field}>
            <Text style={af.label}>Capital ($)</Text>
            <TextInput style={af.input} value={capital} onChangeText={setCapital} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={af.field}>
            <Text style={af.label}>Lot Size</Text>
            <TextInput style={af.input} value={lotSize} onChangeText={setLotSize} keyboardType="decimal-pad" placeholder="0.01" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        {/* % Per Trade + Max Drawdown */}
        <View style={af.row2}>
          <View style={af.field}>
            <Text style={af.label}>% Per Trade</Text>
            <TextInput style={af.input} value={pctTrade} onChangeText={setPctTrade} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={af.field}>
            <Text style={af.label}>Max Drawdown %</Text>
            <TextInput style={af.input} value={maxDD} onChangeText={setMaxDD} keyboardType="decimal-pad" placeholder="20" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        {/* TP + SL */}
        <View style={af.row2}>
          <View style={af.field}>
            <Text style={af.label}>Take Profit %</Text>
            <TextInput style={[af.input, { color: colors.green }]} value={tp} onChangeText={setTp} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={af.field}>
            <Text style={af.label}>Stop Loss %</Text>
            <TextInput style={[af.input, { color: colors.red }]} value={sl} onChangeText={setSl} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        {/* Leverage */}
        <View style={af.labelRow}>
          <Ionicons name="flash-outline" size={12} color={colors.accent} />
          <Text style={af.label}>Leverage</Text>
        </View>
        <View style={af.leverageGrid}>
          {LEVERAGE_OPTIONS.map((lev, idx) => (
            <TouchableOpacity
              key={lev}
              style={[af.levBtn, levIndex === idx && af.levBtnActive]}
              onPress={() => { setLevIndex(idx); setLeverage(lev); }}
            >
              <Text style={[af.levBtnText, levIndex === idx && af.levBtnTextActive]}>{lev}x</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cooldown + Num Trades */}
        <View style={af.row2}>
          <View style={af.field}>
            <Text style={af.label}>Cooldown (s)</Text>
            <TextInput style={af.input} value={cooldown} onChangeText={setCooldown} keyboardType="number-pad" placeholder="60" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={af.field}>
            <Text style={af.label}>Max Trades</Text>
            <TextInput style={af.input} value={numTrades} onChangeText={setNumTrades} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        {/* Margin calculator */}
        <View style={af.marginCard}>
          <View style={af.cardTitleRow}>
            <Ionicons name="bar-chart-outline" size={13} color={colors.textSecondary} />
            <Text style={af.marginTitle}>Margin Calculator</Text>
          </View>
          <View style={af.marginRow}>
            <Text style={af.marginLabel}>Required Margin</Text>
            <Text style={af.marginVal}>${margin.toFixed(2)}</Text>
          </View>
          <View style={af.marginRow}>
            <Text style={af.marginLabel}>Leverage</Text>
            <Text style={[af.marginVal, { color: riskColor }]}>{leverage}x</Text>
          </View>
          <View style={af.marginRow}>
            <Text style={af.marginLabel}>Risk Level</Text>
            <View style={af.riskRow}>
              <View style={[af.riskDot, { backgroundColor: riskColor }]} />
              <Text style={[af.marginVal, { color: riskColor }]}>{riskLevel}</Text>
            </View>
          </View>
          {leverage > 50 && (
            <View style={af.warningRow}>
              <Ionicons name="warning-outline" size={12} color={colors.red} />
              <Text style={af.marginWarning}>High leverage increases liquidation risk significantly.</Text>
            </View>
          )}
        </View>

        {/* Config summary */}
        <View style={af.summaryCard}>
          <View style={af.cardTitleRow}>
            <Ionicons name="list-outline" size={13} color={colors.textSecondary} />
            <Text style={af.marginTitle}>Config Summary</Text>
          </View>
          {[
            ['Ticker', ticker], ['Strategy', strategy], ['Direction', direction],
            ['Capital', `$${capital}`], ['Lot Size', lotSize], ['Leverage', `${leverage}x`],
            ['TP', tp ? `${tp}%` : '—'], ['SL', sl ? `${sl}%` : '—'],
          ].map(([l, v]) => (
            <View key={l} style={af.marginRow}>
              <Text style={af.marginLabel}>{l}</Text>
              <Text style={af.marginVal}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Launch */}
        <TouchableOpacity
          style={[af.launchBtn, (loading || proGated) && { opacity: 0.6 }]}
          onPress={handleLaunch}
          disabled={loading || proGated}
        >
          {loading ? <ActivityIndicator color="#000" size="small" /> : (
            <View style={af.launchBtnInner}>
              <Ionicons name="rocket-outline" size={16} color="#000" />
              <Text style={af.launchBtnText}>Launch Bot · {ticker}</Text>
            </View>
          )}
        </TouchableOpacity>

        {proGated && (
          <View style={af.proGateRow}>
            <Ionicons name="star-outline" size={12} color={colors.accent} />
            <Text style={af.proGateText}>Upgrade to Pro to use LIVE strategy</Text>
          </View>
        )}

      </ScrollView>

      {/* Ticker picker modal */}
      <Modal visible={showTickers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pairSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.pairSheetTitle}>Select Ticker</Text>
            <FlatList
              data={TICKERS}
              keyExtractor={t => t}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pairSheetRow, item === ticker && styles.pairSheetRowActive]} onPress={() => { setTicker(item); setShowTk(false); }}>
                  <Text style={[styles.pairSheetRowText, item === ticker && { color: colors.accent }]}>{item}</Text>
                  {item === ticker && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.pairSheetCancel} onPress={() => setShowTk(false)}>
              <Text style={styles.pairSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const af = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  closeBtn: { padding: 6 },
  scroll: { padding: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  label: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 12 },
  selectorText: { fontSize: font.md, fontWeight: '700', color: colors.text },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  segBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  segBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segBtnText: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },
  segBtnTextActive: { color: colors.accent },
  row2: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 12, fontSize: font.sm, color: colors.text },
  leverageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  levBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  levBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  levBtnText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  levBtnTextActive: { color: colors.accent },
  marginCard: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: spacing.sm },
  summaryCard: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border + '80', padding: spacing.sm, marginTop: spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  marginTitle: { fontSize: font.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  marginRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  marginLabel: { fontSize: font.xs, color: colors.textMuted },
  marginVal: { fontSize: font.xs, fontWeight: '700', color: colors.text },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
  marginWarning: { fontSize: 10, color: colors.red, flex: 1 },
  launchBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: spacing.md },
  launchBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  launchBtnText: { fontSize: font.md, fontWeight: '700', color: '#000' },
  proGateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  proGateText: { fontSize: font.xs, color: colors.accent },
});

// ── Main BotsScreen ───────────────────────────────────────────────────────────
export default function BotsScreen() {
  const { user } = useAuth() as { user: any };
  const isPro = user?.subscription_plan && user.subscription_plan !== 'free';

  const [activeBots, setActiveBots]   = useState<BotDetail[]>([]);
  const [isRunning, setIsRunning]     = useState(false);
  const [capital, setCapital]         = useState(0);
  const [loading, setLoading]         = useState(false);
  const [stoppingId, setStoppingId]   = useState<string | null>(null);

  const [portValue, setPortValue]       = useState(0);
  const [totalWinRate, setTotalWinRate] = useState(0);
  const [totalUnrPnl, setTotalUnrPnl]   = useState(0);
  const [totalRealPnl, setTotalRealPnl] = useState(0);

  const [allTrades, setAllTrades]       = useState<any[]>([]);
  const [pnlHistories, setPnlHistories] = useState<Record<string, number[]>>({});

  const [feBots, setFeBots]           = useState<FeBot[]>([]);
  const [feTradeLog, setFeTradeLog]   = useState<any[]>([]);
  const [feCollapsed, setFeCollapsed] = useState(true);
  const [feStarting, setFeStarting]   = useState<string | null>(null);
  const [feStopping, setFeStopping]   = useState<string | null>(null);
  const [maxFeBots, setMaxFeBots]     = useState(5);

  const [logCollapsed, setLogCollapsed] = useState(false);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [botLimit, setBotLimit]         = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await getBotStatus();
      const data = res.data;
      const bots: BotDetail[] = Object.values(data?.bots ?? {}) as BotDetail[];
      setActiveBots(bots);
      setIsRunning(data?.running ?? false);
      setCapital(data?.capital ?? 0);
      const unr  = bots.reduce((a, b) => a + (b.unrealized_pnl ?? 0), 0);
      const rea  = bots.reduce((a, b) => a + (b.realized_pnl ?? b.pnl ?? 0), 0);
      const wins = bots.filter(b => (b.win_rate ?? 0) >= 50).length;
      setTotalUnrPnl(unr); setTotalRealPnl(rea);
      setTotalWinRate(bots.length > 0 ? (wins / bots.length) * 100 : 0);
      setPortValue((data?.capital ?? 0) + unr + rea);
    } catch { /* ignore */ }
  }, []);

  const fetchTrades = useCallback(async () => {
    try {
      const res  = await getBotTrades(200);
      const data = res.data;
      setAllTrades(Array.isArray(data) ? data : data?.trades ?? []);
    } catch { /* ignore */ }
  }, []);

  const fetchPnlHistory = useCallback(async () => {
    try {
      const res  = await getBotPnlHistory(14);
      const data = res.data;
      if (Array.isArray(data)) {
        setPnlHistories({ _all: data.map((d: any) => d.pnl ?? d.value ?? 0) });
      } else if (data && typeof data === 'object') {
        const hist: Record<string, number[]> = {};
        for (const [k, v] of Object.entries(data)) {
          if (Array.isArray(v)) hist[k] = v.map((d: any) => typeof d === 'number' ? d : d.pnl ?? 0);
        }
        setPnlHistories(hist);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchFinEvent = useCallback(async () => {
    try {
      const [listRes, tradeRes] = await Promise.allSettled([finEventListBots(), finEventTrades(20)]);
      if (listRes.status === 'fulfilled') {
        const d = listRes.value.data;
        setFeBots(Array.isArray(d?.bots) ? d.bots : []);
        setMaxFeBots(d?.max_event_bots ?? 5);
      }
      if (tradeRes.status === 'fulfilled') {
        const d = tradeRes.value.data;
        setFeTradeLog(Array.isArray(d) ? d : d?.trades ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchLimits = useCallback(async () => {
    try {
      const res  = await getSubscriptionLimits();
      setBotLimit(res.data?.max_bots ?? null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus(); fetchTrades(); fetchPnlHistory(); fetchFinEvent(); fetchLimits();
    const id = setInterval(() => { fetchStatus(); fetchFinEvent(); }, 10000);
    return () => clearInterval(id);
  }, [fetchStatus, fetchTrades, fetchPnlHistory, fetchFinEvent, fetchLimits]);

  const handleStopAll = () => {
    Alert.alert('Stop All Bots', 'This will stop all running bots. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop All', style: 'destructive', onPress: async () => {
        setLoading(true);
        try { await stopBot('ALL'); fetchStatus(); }
        catch (e: any) { Alert.alert('Error', e?.response?.data?.detail ?? 'Failed'); }
        finally { setLoading(false); }
      }},
    ]);
  };

  const handleStopBot = async (ticker: string) => {
    setStoppingId(ticker);
    try { await stopBot(ticker); fetchStatus(); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.detail ?? 'Failed to stop bot'); }
    finally { setStoppingId(null); }
  };

  const handleLaunch = async (params: Record<string, unknown>) => {
    try {
      await startBot(params as any);
      Alert.alert('Bot Launched', `FinBot started on ${params.ticker}`);
      setShowAddForm(false); fetchStatus();
    } catch (e: any) {
      Alert.alert('Launch Failed', e?.response?.data?.detail ?? e?.message ?? 'An error occurred');
    }
  };

  const handleFeStart = async (botName: string) => {
    setFeStarting(botName);
    try { await finEventStart({ bot_name: botName }); fetchFinEvent(); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.detail ?? 'Failed'); }
    finally { setFeStarting(null); }
  };

  const handleFeStop = async (botName: string) => {
    setFeStopping(botName);
    try { await finEventStop(botName); fetchFinEvent(); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.detail ?? 'Failed'); }
    finally { setFeStopping(null); }
  };

  const runningCount = activeBots.filter(b => b.running).length;
  const glbTrades    = allTrades.slice(0, 50);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>FinBots</Text>
            <View style={[styles.statusBadge, { backgroundColor: isRunning ? colors.greenMuted : colors.border }]}>
              <View style={[styles.statusDot, { backgroundColor: isRunning ? colors.green : colors.textMuted }]} />
              <Text style={[styles.statusText, { color: isRunning ? colors.green : colors.textMuted }]}>
                {runningCount > 0 ? `${runningCount} Live` : 'Offline'}
              </Text>
            </View>
            {botLimit !== null && (
              <View style={styles.limitBadge}>
                <Text style={styles.limitText}>{activeBots.length}/{botLimit} bots</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {isRunning && (
              <TouchableOpacity style={styles.stopAllBtn} onPress={handleStopAll} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.red} size="small" /> : (
                  <View style={styles.stopAllInner}>
                    <Ionicons name="stop-circle-outline" size={14} color={colors.red} />
                    <Text style={styles.stopAllText}>Stop All</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: feCollapsed ? colors.cardAlt : colors.accentMuted }]}
              onPress={() => setFeCollapsed(v => !v)}
            >
              <Ionicons name="flash-outline" size={13} color={feCollapsed ? colors.textSecondary : colors.accent} />
              <Text style={[styles.headerBtnText, { color: feCollapsed ? colors.textSecondary : colors.accent }]}>FeBot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddForm(true)}>
              <Text style={styles.addBtnText}>+ Add Bot</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Portfolio Stats ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard label="Portfolio" value={portValue > 0 ? `$${fmt(portValue)}` : '—'} iconName="briefcase-outline" color={colors.text} />
          <StatCard label="Win Rate"  value={totalWinRate > 0 ? `${totalWinRate.toFixed(1)}%` : '—'} iconName="trophy-outline" color={totalWinRate >= 50 ? colors.green : colors.red} />
          <StatCard label="Unrealized" value={totalUnrPnl !== 0 ? dollar(totalUnrPnl) : '—'} iconName="trending-up-outline" color={totalUnrPnl >= 0 ? colors.green : colors.red} />
          <StatCard label="Realized"  value={totalRealPnl !== 0 ? dollar(totalRealPnl) : '—'} iconName="cash-outline" color={totalRealPnl >= 0 ? colors.green : colors.red} />
        </View>

        {/* ── Active Bots ──────────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ACTIVE BOTS</Text>
          <TouchableOpacity onPress={fetchStatus} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={14} color={colors.accent} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {activeBots.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="robot-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No active bots</Text>
            <Text style={styles.emptySub}>Tap "+ Add Bot" to launch your first FinBot</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddForm(true)}>
              <Ionicons name="rocket-outline" size={16} color="#000" />
              <Text style={styles.emptyAddBtnText}>Launch FinBot</Text>
            </TouchableOpacity>
          </View>
        ) : (
          activeBots.map((bot, i) => {
            const botTrades  = allTrades.filter((t: any) => (t.ticker ?? t.pair ?? '') === bot.ticker);
            const sparkData  = pnlHistories[bot.ticker] ?? pnlHistories['_all'] ?? [];
            return (
              <BotCard
                key={bot.ticker + i}
                bot={bot} onStop={handleStopBot}
                stopping={stoppingId === bot.ticker}
                recentTrades={botTrades} pnlHistory={sparkData}
              />
            );
          })
        )}

        {/* ── FinEvent AI ──────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.feToggle} onPress={() => setFeCollapsed(v => !v)} activeOpacity={0.85}>
          <View style={styles.feIconCircle}>
            <Ionicons name="flash-outline" size={14} color={colors.accent} />
          </View>
          <Text style={styles.feToggleText}>FinEvent AI Bots</Text>
          {!isPro && <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>}
          <View style={[styles.feBadge, { backgroundColor: feBots.filter(b => b.running).length > 0 ? colors.greenMuted : colors.cardAlt }]}>
            <Text style={[styles.feBadgeText, { color: feBots.filter(b => b.running).length > 0 ? colors.green : colors.textMuted }]}>
              {feBots.filter(b => b.running).length}/{maxFeBots}
            </Text>
          </View>
          <Ionicons name={feCollapsed ? 'chevron-down' : 'chevron-up'} size={14} color={colors.textMuted} />
        </TouchableOpacity>

        {!feCollapsed && (
          <View style={styles.feCard}>
            {!isPro ? (
              <View style={styles.proBanner}>
                <View style={styles.proBannerIcon}>
                  <Ionicons name="star-outline" size={28} color={colors.accent} />
                </View>
                <Text style={styles.proBannerTitle}>Pro Feature</Text>
                <Text style={styles.proBannerText}>FinEvent AI bots require a Pro subscription. Upgrade to access event-driven automated trading.</Text>
              </View>
            ) : feBots.length === 0 ? (
              <View style={styles.feEmpty}>
                <Text style={styles.feEmptyText}>No FinEvent bots configured.</Text>
              </View>
            ) : (
              <>
                {feBots.map((bot, i) => (
                  <View key={bot.bot_name + i} style={[styles.feRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={[styles.feRunDot, { backgroundColor: bot.running ? colors.green : colors.textMuted }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feBotName}>{bot.bot_name}</Text>
                      <Text style={[styles.feBotStatus, { color: bot.running ? colors.green : colors.textMuted }]}>{bot.running ? 'Running' : 'Stopped'}</Text>
                    </View>
                    {bot.running ? (
                      <TouchableOpacity style={styles.feStopBtn} onPress={() => handleFeStop(bot.bot_name)} disabled={feStopping === bot.bot_name}>
                        {feStopping === bot.bot_name ? <ActivityIndicator color={colors.red} size="small" /> : (
                          <View style={styles.feBtnInner}>
                            <Ionicons name="stop-circle-outline" size={12} color={colors.red} />
                            <Text style={styles.feStopText}>Stop</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.feStartBtn} onPress={() => handleFeStart(bot.bot_name)} disabled={feStarting === bot.bot_name}>
                        {feStarting === bot.bot_name ? <ActivityIndicator color={colors.green} size="small" /> : (
                          <View style={styles.feBtnInner}>
                            <Ionicons name="play-outline" size={12} color={colors.green} />
                            <Text style={styles.feStartText}>Start</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {feTradeLog.length > 0 && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={styles.feLogTitle}>FE TRADE LOG</Text>
                    {feTradeLog.slice(0, 10).map((t: any, i: number) => {
                      const isBuy = (t.action ?? t.side ?? '').toUpperCase() === 'BUY';
                      const time  = t.created_at ? new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
                      const tPnl  = t.pnl ?? t.profit ?? 0;
                      return (
                        <View key={i} style={[styles.feLogRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                          <Ionicons name={isBuy ? 'trending-up' : 'trending-down'} size={12} color={isBuy ? colors.green : colors.red} />
                          <Text style={styles.feLogTicker}>{t.ticker ?? t.pair ?? '—'}</Text>
                          <Text style={styles.feLogPrice}>${(t.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
                          <Text style={[styles.feLogPnl, { color: tPnl >= 0 ? colors.green : colors.red }]}>{tPnl >= 0 ? '+' : ''}{tPnl.toFixed(2)}</Text>
                          <Text style={styles.feLogTime}>{time}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── Global Trade Log ─────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logToggle} onPress={() => setLogCollapsed(v => !v)}>
          <Ionicons name="list-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.logToggleText}>TRADE LOG</Text>
          <Text style={styles.logCount}>{allTrades.length} trades</Text>
          <Ionicons name={logCollapsed ? 'chevron-down' : 'chevron-up'} size={14} color={colors.textMuted} />
        </TouchableOpacity>

        {!logCollapsed && (
          <View style={styles.logCard}>
            {glbTrades.length === 0 ? (
              <Text style={styles.emptyText}>No trades yet</Text>
            ) : (
              glbTrades.map((t: any, i: number) => {
                const isBuy = (t.action ?? t.side ?? '').toUpperCase() === 'BUY';
                const time  = t.created_at ? new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
                const tPnl  = t.pnl ?? t.profit ?? 0;
                return (
                  <View key={i} style={[styles.logRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={styles.logSideRow}>
                      <Ionicons name={isBuy ? 'trending-up' : 'trending-down'} size={12} color={isBuy ? colors.green : colors.red} />
                      <Text style={[styles.logSide, { color: isBuy ? colors.green : colors.red }]}>{isBuy ? 'Buy' : 'Sell'}</Text>
                    </View>
                    <Text style={styles.logTicker}>{t.ticker ?? t.pair ?? '—'}</Text>
                    <Text style={styles.logPrice}>${(t.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                    <Text style={[styles.logPnl, { color: tPnl >= 0 ? colors.green : colors.red }]}>{tPnl >= 0 ? '+' : ''}{tPnl.toFixed(2)}</Text>
                    <Text style={styles.logTime}>{time}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

      </ScrollView>

      {/* Add bot modal */}
      <Modal visible={showAddForm} animationType="slide">
        <SafeAreaView style={styles.safe}>
          <AddBotForm onClose={() => setShowAddForm(false)} onLaunch={handleLaunch} isPro={!!isPro} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 100 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, flexWrap: 'wrap', gap: spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  limitBadge: { borderRadius: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.cardAlt },
  limitText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  stopAllBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.red + '60', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  stopAllInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stopAllText: { fontSize: font.xs, fontWeight: '700', color: colors.red },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  headerBtnText: { fontSize: font.xs, fontWeight: '700' },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { fontSize: font.sm, fontWeight: '700', color: '#000' },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },

  // Section header
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.xs },
  sectionTitle: { fontSize: font.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  refreshText: { fontSize: 11, color: colors.accent, fontWeight: '600' },

  // Empty state
  emptyCard: { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center' },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 12, marginTop: spacing.sm },
  emptyAddBtnText: { fontSize: font.md, fontWeight: '700', color: '#000' },
  emptyText: { padding: spacing.xl, textAlign: 'center', color: colors.textMuted, fontSize: font.sm },

  // FinEvent toggle
  feToggle: { marginHorizontal: spacing.md, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  feIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  feToggleText: { fontSize: font.md, fontWeight: '700', color: colors.text, flex: 1 },
  feBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  feBadgeText: { fontSize: 10, fontWeight: '700' },
  proBadge: { backgroundColor: colors.accentMuted, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  proBadgeText: { fontSize: 9, fontWeight: '700', color: colors.accent },
  feCard: { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, padding: spacing.sm },
  proBanner: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  proBannerIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  proBannerTitle: { fontSize: font.md, fontWeight: '700', color: colors.accent },
  proBannerText: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  feEmpty: { padding: spacing.md },
  feEmptyText: { fontSize: font.xs, color: colors.textMuted, textAlign: 'center' },
  feRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.sm },
  feRunDot: { width: 8, height: 8, borderRadius: 4 },
  feBotName: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  feBotStatus: { fontSize: 10, fontWeight: '600' },
  feBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feStartBtn: { borderWidth: 1, borderColor: colors.green + '60', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  feStartText: { fontSize: font.xs, fontWeight: '700', color: colors.green },
  feStopBtn: { borderWidth: 1, borderColor: colors.red + '60', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  feStopText: { fontSize: font.xs, fontWeight: '700', color: colors.red },
  feLogTitle: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  feLogRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 4 },
  feLogTicker: { fontSize: 10, fontWeight: '600', color: colors.text, flex: 2 },
  feLogPrice: { fontSize: 10, color: colors.textSecondary, flex: 2 },
  feLogPnl: { fontSize: 10, fontWeight: '600', flex: 1, textAlign: 'center' },
  feLogTime: { fontSize: 9, color: colors.textMuted, width: 50, textAlign: 'right' },

  // Trade log
  logToggle: { marginHorizontal: spacing.md, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  logToggleText: { fontSize: font.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8, flex: 1 },
  logCount: { fontSize: 10, color: colors.textMuted },
  logCard: { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: spacing.sm },
  logSideRow: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 48 },
  logSide: { fontSize: 10, fontWeight: '700' },
  logTicker: { fontSize: 10, fontWeight: '600', color: colors.text, flex: 2 },
  logPrice: { fontSize: 10, color: colors.textSecondary, flex: 2, textAlign: 'center' },
  logPnl: { fontSize: 10, fontWeight: '600', flex: 1, textAlign: 'center' },
  logTime: { fontSize: 9, color: colors.textMuted, width: 50, textAlign: 'right' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  pairSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm, maxHeight: '80%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  pairSheetTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  pairSheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  pairSheetRowActive: { backgroundColor: colors.accentMuted },
  pairSheetRowText: { fontSize: font.md, color: colors.text, fontWeight: '600' },
  pairSheetCancel: { padding: spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  pairSheetCancelText: { fontSize: font.md, fontWeight: '600', color: colors.textSecondary },
});
