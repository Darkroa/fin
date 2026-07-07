import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBotStatus, startBot, stopBot, getBotTrades, finEventListBots, finEventStop } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function BotCard({ bot, onStop, onStart }: { bot: any; onStop: () => void; onStart: () => void }) {
  const isRunning = bot.status === 'running';
  const pnl = toNum(bot.pnl ?? bot.total_pnl);
  const leverage = bot.leverage ?? '1x';
  const direction = bot.direction ?? bot.side ?? '—';
  const directionUpper = typeof direction === 'string' ? direction.toUpperCase() : '—';

  return (
    <View style={styles.botCard}>
      {/* Top row: ticker badge + status + action button */}
      <View style={styles.botTopRow}>
        <View style={styles.tickerBadge}>
          <Text style={styles.tickerBadgeText}>{bot.ticker ?? bot.bot_name ?? 'BOT'}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusDot, { color: isRunning ? colors.green : colors.textMuted }]}>
            {isRunning ? '●' : '○'}
          </Text>
          <Text style={[styles.statusLabel, { color: isRunning ? colors.green : colors.textMuted }]}>
            {isRunning ? 'LIVE' : 'STOPPED'}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: isRunning ? colors.red : colors.green }]}
          onPress={isRunning ? onStop : onStart}
        >
          <Text style={[styles.toggleBtnText, { color: isRunning ? colors.red : colors.green }]}>
            {isRunning ? '■' : '▶'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Strategy */}
      <Text style={styles.botStrategy}>{bot.strategy ?? bot.bot_name ?? '—'}</Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Stats row: 3 columns */}
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
          <Text style={[
            styles.statValue,
            { color: directionUpper === 'BUY' ? colors.green : directionUpper === 'SELL' ? colors.red : colors.text },
          ]}>
            {directionUpper}
          </Text>
        </View>
      </View>

      {/* View Trades ghost button */}
      <TouchableOpacity style={styles.viewTradesBtn}>
        <Text style={styles.viewTradesBtnText}>View Trades</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BotsScreen() {
  const [bots, setBots] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [starting, setStarting] = useState(false);

  // New bot params
  const [ticker, setTicker] = useState('BTC-USD');
  const [capital, setCapital] = useState('200');
  const [paper, setPaper] = useState(true);
  const [botName, setBotName] = useState('');

  const load = useCallback(async () => {
    try {
      const [statusRes, tradesRes] = await Promise.allSettled([
        getBotStatus(),
        getBotTrades(10),
      ]);
      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value.data;
        setBots(Array.isArray(d) ? d : d?.bots ?? []);
      }
      if (tradesRes.status === 'fulfilled') {
        setTrades(tradesRes.value.data ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleStop = (botId: string) => {
    Alert.alert('Stop Bot', `Stop bot "${botId}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop', style: 'destructive', onPress: async () => {
          try {
            await stopBot(botId);
            load();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to stop bot.');
          }
        },
      },
    ]);
  };

  const handleStart = async () => {
    if (!ticker.trim()) { Alert.alert('Error', 'Enter a ticker symbol.'); return; }
    const cap = parseFloat(capital);
    if (isNaN(cap) || cap <= 0) { Alert.alert('Error', 'Enter a valid capital amount.'); return; }
    setStarting(true);
    try {
      await startBot({
        ticker: ticker.trim().toUpperCase(),
        initial_capital: cap,
        paper,
        bot_name: botName.trim() || undefined,
      });
      setShowModal(false);
      load();
      Alert.alert('Bot Started', `${ticker.toUpperCase()} bot is now ${paper ? 'paper' : 'live'} trading.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to start bot.');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trading Bots</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
              key={i}
              bot={b}
              onStop={() => handleStop(b.bot_name ?? b.ticker ?? 'ALL')}
              onStart={() => setShowModal(true)}
            />
          ))
        )}

        {/* Recent Trades */}
        {trades.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>RECENT TRADES</Text>
            {trades.slice(0, 8).map((t: any, i: number) => (
              <View key={i} style={styles.tradeRow}>
                <View>
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

      {/* Start Bot Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Trading Bot</Text>

            <Text style={styles.inputLabel}>Ticker Symbol</Text>
            <TextInput
              style={styles.input}
              value={ticker}
              onChangeText={setTicker}
              autoCapitalize="characters"
              placeholder="e.g. BTC-USD, ETH-USD, AAPL"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Bot Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={botName}
              onChangeText={setBotName}
              placeholder="My BTC Bot"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Capital (USDT)</Text>
            <TextInput
              style={styles.input}
              value={capital}
              onChangeText={setCapital}
              keyboardType="numeric"
              placeholder="200"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.inputLabel}>Paper Trading</Text>
                <Text style={styles.switchSub}>No real money used</Text>
              </View>
              <Switch
                value={paper}
                onValueChange={setPaper}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, starting && { opacity: 0.6 }]}
                onPress={handleStart}
                disabled={starting}
              >
                {starting
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.confirmBtnText}>Start Bot</Text>}
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  addBtn: { fontSize: font.xxl, color: colors.accent, fontWeight: '400', lineHeight: 32 },

  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: {
    fontSize: font.sm, color: colors.textSecondary, textAlign: 'center',
    marginBottom: spacing.lg, paddingHorizontal: spacing.lg,
  },
  emptyBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 15, paddingHorizontal: spacing.xl,
  },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },

  // Bot card
  botCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  botTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  tickerBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
  tickerBadgeText: { color: colors.accent, fontSize: font.sm, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { fontSize: font.xs },
  statusLabel: { fontSize: font.xs, fontWeight: '600' },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnText: { fontSize: font.sm, fontWeight: '700' },
  botStrategy: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },

  // Stats
  statsRow: { flexDirection: 'row', marginBottom: spacing.sm },
  statCol: { flex: 1 },
  statColCenter: { alignItems: 'center' },
  statColRight: { alignItems: 'flex-end' },
  statLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { fontSize: font.sm, fontWeight: '700', color: colors.text },

  viewTradesBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  viewTradesBtnText: { color: colors.accent, fontSize: font.sm, fontWeight: '600' },

  // Recent trades section
  section: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradePair: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  tradeMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  tradePnl: { fontSize: font.md, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: font.md,
    marginBottom: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchSub: { fontSize: font.xs, color: colors.textMuted },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#000', fontWeight: '700' },
});
