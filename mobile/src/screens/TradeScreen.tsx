import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font, shadow } from '../theme';
import { executeTrade } from '../lib/api';

const PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'XAU/USD', 'AAPL', 'TSLA', 'NVDA', 'SPY',
];

const COIN_IDS: Record<string, string> = {
  'BTC/USDT': 'bitcoin', 'ETH/USDT': 'ethereum', 'BNB/USDT': 'binancecoin',
  'SOL/USDT': 'solana', 'XRP/USDT': 'ripple', 'DOGE/USDT': 'dogecoin',
  'ADA/USDT': 'cardano', 'AVAX/USDT': 'avalanche-2',
};

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 25];
type Side = 'BUY' | 'SELL';

export default function TradeScreen() {
  const { user } = useAuth();
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [side, setSide] = useState<Side>('BUY');
  const [qty, setQty] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPrice = useCallback(async (pair: string) => {
    const coinId = COIN_IDS[pair];
    if (!coinId) { setLivePrice(null); setPriceChange(null); return; }
    setPriceLoading(true);
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
      );
      const data = await res.json();
      const entry = data[coinId];
      if (entry) { setLivePrice(entry.usd ?? null); setPriceChange(entry.usd_24h_change ?? null); }
      else { setLivePrice(null); setPriceChange(null); }
    } catch { setLivePrice(null); setPriceChange(null); }
    finally { setPriceLoading(false); }
  }, []);

  useEffect(() => { fetchPrice(selectedPair); }, [selectedPair, fetchPrice]);

  const handleExecute = useCallback(async () => {
    const qtyNum = parseFloat(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Parameters<typeof executeTrade>[0] = {
        ticker: selectedPair, side: side.toLowerCase() as 'buy' | 'sell', qty: qtyNum, leverage,
      };
      if (takeProfit) { const tp = parseFloat(takeProfit); if (!isNaN(tp) && tp > 0) payload.take_profit = tp; }
      if (stopLoss)   { const sl = parseFloat(stopLoss);   if (!isNaN(sl) && sl > 0) payload.stop_loss   = sl; }
      await executeTrade(payload);
      Alert.alert('Order Placed ✓', `Your ${side} order for ${qtyNum} ${selectedPair} has been placed.`);
      setQty(''); setTakeProfit(''); setStopLoss('');
    } catch (e: any) {
      Alert.alert('Trade Failed', e?.response?.data?.detail ?? e?.message ?? 'An error occurred.');
    } finally { setSubmitting(false); }
  }, [selectedPair, side, qty, leverage, takeProfit, stopLoss]);

  const balance = user?.balance_usdt != null
    ? Number(user.balance_usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  const changeColor = priceChange == null ? colors.textSecondary : priceChange >= 0 ? colors.green : colors.red;
  const isBuy = side === 'BUY';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Trade</Text>
            <View style={styles.balanceBadge}>
              <Text style={styles.balanceBadgeLabel}>Balance </Text>
              <Text style={styles.balanceBadgeValue}>${balance}</Text>
            </View>
          </View>

          {/* Pair Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pairRow}>
            {PAIRS.map((pair) => (
              <TouchableOpacity
                key={pair}
                style={[styles.pairChip, selectedPair === pair && styles.pairChipActive]}
                onPress={() => setSelectedPair(pair)}
              >
                <Text style={[styles.pairChipText, selectedPair === pair && styles.pairChipTextActive]}>{pair}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Live Price */}
          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>{selectedPair}</Text>
              {priceLoading ? (
                <ActivityIndicator color={colors.accent} size="small" style={{ marginTop: 4 }} />
              ) : livePrice != null ? (
                <Text style={styles.priceValue}>
                  ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </Text>
              ) : (
                <Text style={styles.priceDash}>Price unavailable</Text>
              )}
            </View>
            {priceChange != null && (
              <View style={[styles.changePill, { backgroundColor: priceChange >= 0 ? colors.greenMuted : colors.redMuted }]}>
                <Text style={[styles.changeText, { color: changeColor }]}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                </Text>
              </View>
            )}
          </View>

          {/* Order Form */}
          <View style={styles.formCard}>
            {/* BUY / SELL toggle */}
            <View style={styles.sideToggle}>
              {(['BUY', 'SELL'] as Side[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sideBtn, side === s && (s === 'BUY' ? styles.sideBtnBuy : styles.sideBtnSell)]}
                  onPress={() => setSide(s)}
                >
                  <Text style={[styles.sideBtnText, side === s && styles.sideBtnTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quantity */}
            <Text style={styles.formLabel}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={qty} onChangeText={setQty}
              placeholder="0.00" placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad" returnKeyType="done"
            />

            {/* Leverage */}
            <Text style={styles.formLabel}>Leverage</Text>
            <View style={styles.leverageRow}>
              {LEVERAGE_OPTIONS.map((lv) => (
                <TouchableOpacity
                  key={lv}
                  style={[styles.leverageBtn, leverage === lv && styles.leverageBtnActive]}
                  onPress={() => setLeverage(lv)}
                >
                  <Text style={[styles.leverageBtnText, leverage === lv && styles.leverageBtnTextActive]}>{lv}x</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Take Profit */}
            <Text style={styles.formLabel}>Take Profit % <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={styles.input} value={takeProfit} onChangeText={setTakeProfit} placeholder="e.g. 5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" returnKeyType="done" />

            {/* Stop Loss */}
            <Text style={styles.formLabel}>Stop Loss % <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={styles.input} value={stopLoss} onChangeText={setStopLoss} placeholder="e.g. 3" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" returnKeyType="done" />

            {/* Execute Button */}
            <TouchableOpacity
              style={[
                styles.executeBtn,
                { backgroundColor: isBuy ? colors.green : colors.red },
                submitting && styles.executeBtnDisabled,
              ]}
              onPress={handleExecute}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.executeBtnText}>{side === 'BUY' ? '▲ Place Buy Order' : '▼ Place Sell Order'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xl * 2 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  balanceBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  balanceBadgeLabel: { fontSize: font.xs, color: colors.textSecondary },
  balanceBadgeValue: { fontSize: font.xs, fontWeight: '700', color: colors.text },

  pairRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  pairChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs,
  },
  pairChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pairChipText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },
  pairChipTextActive: { color: '#000', fontWeight: '700' },

  priceCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  priceLabel: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  priceValue: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  priceDash: { fontSize: font.sm, color: colors.textMuted },
  changePill: { borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  changeText: { fontSize: font.sm, fontWeight: '700' },

  formCard: {
    marginHorizontal: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  sideToggle: {
    flexDirection: 'row', backgroundColor: colors.cardAlt,
    borderRadius: radius.md, padding: 4, marginBottom: spacing.md,
  },
  sideBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  sideBtnBuy: { backgroundColor: colors.green },
  sideBtnSell: { backgroundColor: colors.red },
  sideBtnText: { fontSize: font.md, fontWeight: '700', color: colors.textSecondary },
  sideBtnTextActive: { color: '#fff' },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '500', marginBottom: spacing.xs, marginTop: spacing.sm },
  optional: { color: colors.textMuted, fontWeight: '400' },
  input: {
    backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: font.md, color: colors.text, marginBottom: spacing.xs,
  },
  leverageRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  leverageBtn: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  leverageBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  leverageBtnText: { fontSize: font.xs, fontWeight: '700', color: colors.textSecondary },
  leverageBtnTextActive: { color: '#000' },
  executeBtn: {
    borderRadius: radius.lg, paddingVertical: 15,
    alignItems: 'center', marginTop: spacing.lg,
  },
  executeBtnDisabled: { opacity: 0.6 },
  executeBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
});
