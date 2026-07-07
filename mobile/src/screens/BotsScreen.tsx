import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Modal,
} from 'react-native';
import { getBotStatus, startBot, stopBot, getBotTrades, finEventListBots, finEventStop } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

function BotCard({ bot, onStop }: { bot: any; onStop: () => void }) {
  const isRunning = bot.status === 'running';
  const pnl = bot.pnl ?? bot.total_pnl ?? 0;
  return (
    <View style={styles.botCard}>
      <View style={styles.botHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.botName}>{bot.bot_name ?? bot.name ?? bot.ticker ?? 'Bot'}</Text>
          <Text style={styles.botTicker}>{bot.ticker ?? bot.strategy ?? '—'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isRunning ? '#0d2e1f' : '#1e1e1e' }]}>
          <Text style={[styles.statusText, { color: isRunning ? colors.green : colors.textMuted }]}>
            {isRunning ? '● Live' : '○ Idle'}
          </Text>
        </View>
      </View>

      <View style={styles.botStats}>
        <View style={styles.botStat}>
          <Text style={styles.botStatLabel}>P&L</Text>
          <Text style={[styles.botStatValue, { color: pnl >= 0 ? colors.green : colors.red }]}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </Text>
        </View>
        <View style={styles.botStat}>
          <Text style={styles.botStatLabel}>Capital</Text>
          <Text style={styles.botStatValue}>${bot.capital ?? bot.initial_capital ?? '—'}</Text>
        </View>
        <View style={styles.botStat}>
          <Text style={styles.botStatLabel}>Trades</Text>
          <Text style={styles.botStatValue}>{bot.trade_count ?? '—'}</Text>
        </View>
      </View>

      {isRunning && (
        <TouchableOpacity style={styles.stopBtn} onPress={onStop}>
          <Text style={styles.stopBtnText}>Stop Bot</Text>
        </TouchableOpacity>
      )}
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trading Bots</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.startBtnText}>+ New Bot</Text>
          </TouchableOpacity>
        </View>

        {bots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>No bots yet</Text>
            <Text style={styles.emptyText}>Launch your first AI trading bot</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyBtnText}>Start a Bot</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bots.map((b, i) => (
            <BotCard
              key={i}
              bot={b}
              onStop={() => handleStop(b.bot_name ?? b.ticker ?? 'ALL')}
            />
          ))
        )}

        {/* Recent Trades */}
        {trades.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Trades</Text>
            {trades.slice(0, 8).map((t: any, i: number) => {
              const pnl = t.pnl ?? 0;
              return (
                <View key={i} style={styles.tradeRow}>
                  <View>
                    <Text style={styles.tradePair}>{t.pair ?? t.ticker ?? '—'}</Text>
                    <Text style={styles.tradeMeta}>{t.side?.toUpperCase() ?? '—'} · {t.strategy ?? '—'}</Text>
                  </View>
                  <Text style={[styles.tradePnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </Text>
                </View>
              );
            })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  startBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  startBtnText: { color: colors.bg, fontWeight: '700', fontSize: font.sm },

  botCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  botHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  botName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  botTicker: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 8 },
  statusText: { fontSize: font.xs, fontWeight: '700' },
  botStats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  botStat: {},
  botStatLabel: { fontSize: font.xs, color: colors.textMuted },
  botStatValue: { fontSize: font.md, fontWeight: '700', color: colors.text, marginTop: 2 },
  stopBtn: {
    backgroundColor: '#2e0d0d', borderRadius: radius.sm,
    padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.red,
  },
  stopBtnText: { color: colors.red, fontWeight: '700', fontSize: font.sm },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  emptyBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  emptyBtnText: { color: colors.bg, fontWeight: '700' },

  section: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    marginTop: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  tradeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tradePair: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  tradeMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  tradePnl: { fontSize: font.md, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text,
    fontSize: font.md, marginBottom: spacing.md,
  },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchSub: { fontSize: font.xs, color: colors.textMuted },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  confirmBtnText: { color: colors.bg, fontWeight: '700' },
});
