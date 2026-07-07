import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBotStatus, startBot, stopBot, getBotTrades } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function BotCard({ bot, onStop, onStart }: { bot: any; onStop: () => void; onStart: () => void }) {
  const isRunning = bot.status === 'running' || bot.running === true;
  const pnl       = toNum(bot.pnl ?? bot.total_pnl);
  const leverage  = bot.leverage ?? '1x';
  const direction = (bot.direction ?? bot.side ?? '—').toString().toUpperCase();

  return (
    <View style={styles.botCard}>
      {/* Top row */}
      <View style={styles.botTopRow}>
        <View style={styles.tickerBadge}>
          <Text style={styles.tickerBadgeText}>{bot.ticker ?? bot.bot_name ?? 'BOT'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isRunning ? colors.greenMuted : colors.redMuted }]}>
          <View style={[styles.statusDot, { backgroundColor: isRunning ? colors.green : colors.red }]} />
          <Text style={[styles.statusLabel, { color: isRunning ? colors.green : colors.red }]}>
            {isRunning ? 'LIVE' : 'STOPPED'}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: isRunning ? colors.redMuted : colors.greenMuted, borderColor: isRunning ? colors.red : colors.green }]}
          onPress={isRunning ? onStop : onStart}
        >
          <Text style={[styles.toggleBtnText, { color: isRunning ? colors.red : colors.green }]}>
            {isRunning ? '■  Stop' : '▶  Start'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.botStrategy}>{bot.strategy ?? bot.bot_name ?? '—'}</Text>
      <View style={styles.divider} />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>UNREALIZED P&L</Text>
          <Text style={[styles.statValue, { color: pnl >= 0 ? colors.green : colors.red }]}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.statCol, styles.statColCenter]}>
          <Text style={styles.statLabel}>LEVERAGE</Text>
          <Text style={styles.statValue}>{leverage}</Text>
        </View>
        <View style={[styles.statCol, styles.statColRight]}>
          <Text style={styles.statLabel}>DIRECTION</Text>
          <Text style={[styles.statValue, { color: direction === 'BUY' ? colors.green : direction === 'SELL' ? colors.red : colors.text }]}>
            {direction}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function BotsScreen() {
  const [bots, setBots]         = useState<any[]>([]);
  const [trades, setTrades]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ticker, setTicker]     = useState('BTC-USD');
  const [capital, setCapital]   = useState('200');
  const [paper, setPaper]       = useState(true);
  const [botName, setBotName]   = useState('');

  const load = useCallback(async () => {
    try {
      const [statusRes, tradesRes] = await Promise.allSettled([getBotStatus(), getBotTrades(10)]);
      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value.data;
        setBots(Array.isArray(d) ? d : Object.values(d?.bots ?? {}));
      }
      if (tradesRes.status === 'fulfilled') setTrades(tradesRes.value.data ?? []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleStop = (botId: string) => {
    Alert.alert('Stop Bot', `Stop "${botId}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: async () => {
        try { await stopBot(botId); load(); }
        catch (err: any) { Alert.alert('Error', err?.response?.data?.detail ?? 'Failed.'); }
      }},
    ]);
  };

  const handleStart = async () => {
    if (!ticker.trim()) { Alert.alert('Error', 'Enter a ticker symbol.'); return; }
    const cap = parseFloat(capital);
    if (isNaN(cap) || cap <= 0) { Alert.alert('Error', 'Enter a valid capital amount.'); return; }
    setStarting(true);
    try {
      await startBot({ ticker: ticker.trim().toUpperCase(), initial_capital: cap, paper, bot_name: botName.trim() || undefined });
      setShowModal(false); load();
      Alert.alert('Bot Started ✓', `${ticker.toUpperCase()} bot is now ${paper ? 'paper' : 'live'} trading.`);
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail ?? 'Failed.'); }
    finally { setStarting(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trading Bots</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {bots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>No Active Bots</Text>
            <Text style={styles.emptyText}>Create your first bot to start automated trading</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyBtnText}>Create Bot</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bots.map((b, i) => (
            <BotCard
              key={i} bot={b}
              onStop={() => handleStop(b.bot_name ?? b.ticker ?? 'ALL')}
              onStart={() => setShowModal(true)}
            />
          ))
        )}

        {trades.length > 0 && (
          <View style={styles.tradesSection}>
            <Text style={styles.sectionHeader}>RECENT TRADES</Text>
            {trades.slice(0, 8).map((t: any, i: number) => (
              <View key={i} style={[styles.tradeRow, i < Math.min(trades.length, 8) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.tradeDot, { backgroundColor: toNum(t.pnl) >= 0 ? colors.greenMuted : colors.redMuted }]}>
                  <Text style={[styles.tradeDotText, { color: toNum(t.pnl) >= 0 ? colors.green : colors.red }]}>
                    {(t.side || 'T')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tradePair}>{t.pair ?? t.ticker ?? '—'}</Text>
                  <Text style={styles.tradeMeta}>{t.side?.toUpperCase() ?? '—'} · {t.strategy ?? '—'}</Text>
                </View>
                <Text style={[styles.tradePnl, { color: toNum(t.pnl) >= 0 ? colors.green : colors.red }]}>
                  {toNum(t.pnl) >= 0 ? '+' : ''}${toNum(t.pnl).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New Trading Bot</Text>
            <Text style={styles.inputLabel}>Ticker Symbol</Text>
            <TextInput style={styles.input} value={ticker} onChangeText={setTicker} autoCapitalize="characters" placeholder="e.g. BTC-USD" placeholderTextColor={colors.textMuted} />
            <Text style={styles.inputLabel}>Bot Name (optional)</Text>
            <TextInput style={styles.input} value={botName} onChangeText={setBotName} placeholder="My BTC Bot" placeholderTextColor={colors.textMuted} />
            <Text style={styles.inputLabel}>Capital (USDT)</Text>
            <TextInput style={styles.input} value={capital} onChangeText={setCapital} keyboardType="numeric" placeholder="200" placeholderTextColor={colors.textMuted} />
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.inputLabel}>Paper Trading</Text>
                <Text style={styles.switchSub}>No real money used</Text>
              </View>
              <Switch value={paper} onValueChange={setPaper} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.white} />
            </View>
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setShowModal(false)}><Text style={styles.ghostBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, starting && { opacity: 0.6 }]} onPress={handleStart} disabled={starting}>
                {starting ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.primaryBtnText}>Start Bot</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 8 },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: font.sm },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  emptyBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: spacing.xl },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },

  botCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card,
  },
  botTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  tickerBadge: { borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tickerBadgeText: { color: colors.accent, fontSize: font.xs, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  toggleBtn: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  toggleBtnText: { fontSize: font.xs, fontWeight: '700' },
  botStrategy: { fontSize: font.xs, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  statsRow: { flexDirection: 'row' },
  statCol: { flex: 1 },
  statColCenter: { alignItems: 'center' },
  statColRight: { alignItems: 'flex-end' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  sectionHeader: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm },
  tradesSection: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  tradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.sm },
  tradeDot: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tradeDotText: { fontSize: font.xs, fontWeight: '700' },
  tradePair: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  tradeMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  tradePnl: { fontSize: font.md, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '500' },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  switchSub: { fontSize: font.xs, color: colors.textMuted },
  sheetBtns: { flexDirection: 'row', gap: spacing.sm },
  ghostBtn: { flex: 1, backgroundColor: 'transparent', borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ghostBtnText: { color: colors.textSecondary, fontWeight: '600' },
  primaryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '700' },
});
