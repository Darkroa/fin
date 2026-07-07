import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';
import { executeTrade } from '../lib/api';

const PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'XAU/USD', 'AAPL', 'TSLA', 'NVDA', 'SPY',
];

const COIN_IDS: Record<string, string> = {
  'BTC/USDT': 'bitcoin',
  'ETH/USDT': 'ethereum',
  'BNB/USDT': 'binancecoin',
  'SOL/USDT': 'solana',
  'XRP/USDT': 'ripple',
  'DOGE/USDT': 'dogecoin',
  'ADA/USDT': 'cardano',
  'AVAX/USDT': 'avalanche-2',
};

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 25];

type Side = 'BUY' | 'SELL';

export default function TradeScreen({ navigation }: { navigation: any }) {
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
    if (!coinId) {
      setLivePrice(null);
      setPriceChange(null);
      return;
    }
    setPriceLoading(true);
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
      );
      const data = await res.json();
      const entry = data[coinId];
      if (entry) {
        setLivePrice(entry.usd ?? null);
        setPriceChange(entry.usd_24h_change ?? null);
      } else {
        setLivePrice(null);
        setPriceChange(null);
      }
    } catch (_) {
      setLivePrice(null);
      setPriceChange(null);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice(selectedPair);
  }, [selectedPair, fetchPrice]);

  const handleExecute = useCallback(async () => {
    const qtyNum = parseFloat(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Parameters<typeof executeTrade>[0] = {
        ticker: selectedPair,
        side: side.toLowerCase() as 'buy' | 'sell',
        qty: qtyNum,
        leverage,
      };
      if (takeProfit) {
        const tp = parseFloat(takeProfit);
        if (!isNaN(tp) && tp > 0) payload.take_profit = tp;
      }
      if (stopLoss) {
        const sl = parseFloat(stopLoss);
        if (!isNaN(sl) && sl > 0) payload.stop_loss = sl;
      }
      await executeTrade(payload);
      Alert.alert('Trade Executed', `Your ${side} order for ${qtyNum} ${selectedPair} has been placed.`);
      setQty('');
      setTakeProfit('');
      setStopLoss('');
    } catch (e: any) {
      Alert.alert('Trade Failed', e?.message ?? 'An error occurred while executing the trade.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedPair, side, qty, leverage, takeProfit, stopLoss]);

  const balance = user?.balance_usdt != null
    ? Number(user.balance_usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  const changeColor =
    priceChange == null ? colors.textSecondary :
    priceChange >= 0 ? colors.green : colors.red;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trade</Text>
        </View>

        {/* Pair Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pairRow}
        >
          {PAIRS.map((pair) => (
            <TouchableOpacity
              key={pair}
              style={[styles.pairChip, selectedPair === pair && styles.pairChipActive]}
              onPress={() => setSelectedPair(pair)}
            >
              <Text style={[styles.pairChipText, selectedPair === pair && styles.pairChipTextActive]}>
                {pair}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Live Price */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>{selectedPair}</Text>
          {priceLoading ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : livePrice != null ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceValue}>
                ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </Text>
              {priceChange != null && (
                <Text style={[styles.priceChange, { color: changeColor }]}>
                  {' '}({priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%)
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.priceDash}>—</Text>
          )}
        </View>

        {/* Order Form */}
        <View style={styles.formCard}>
          {/* Side Toggle */}
          <Text style={styles.formLabel}>Side</Text>
          <View style={styles.sideToggle}>
            {(['BUY', 'SELL'] as Side[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.sideBtn,
                  side === s && (s === 'BUY' ? styles.sideBtnBuyActive : styles.sideBtnSellActive),
                ]}
                onPress={() => setSide(s)}
              >
                <Text
                  style={[
                    styles.sideBtnText,
                    side === s && styles.sideBtnTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quantity */}
          <Text style={styles.formLabel}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
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
                <Text style={[styles.leverageBtnText, leverage === lv && styles.leverageBtnTextActive]}>
                  {lv}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Take Profit */}
          <Text style={styles.formLabel}>Take Profit % <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={takeProfit}
            onChangeText={setTakeProfit}
            placeholder="e.g. 5"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />

          {/* Stop Loss */}
          <Text style={styles.formLabel}>Stop Loss % <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={stopLoss}
            onChangeText={setStopLoss}
            placeholder="e.g. 3"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />

          {/* Execute Button */}
          <TouchableOpacity
            style={[styles.executeBtn, submitting && styles.executeBtnDisabled]}
            onPress={handleExecute}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.executeBtnText}>Execute Trade</Text>
            )}
          </TouchableOpacity>

          {/* Balance */}
          <Text style={styles.balanceText}>Balance: ${balance}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  pairRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  pairChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  pairChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pairChipText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pairChipTextActive: {
    color: colors.bg,
  },
  priceCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceValue: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
  },
  priceChange: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  priceDash: {
    fontSize: font.lg,
    color: colors.textMuted,
  },
  formCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  formLabel: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  optional: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  sideToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.xs,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  sideBtnBuyActive: {
    backgroundColor: colors.green,
  },
  sideBtnSellActive: {
    backgroundColor: colors.red,
  },
  sideBtnText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  sideBtnTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  leverageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  leverageBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leverageBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  leverageBtnText: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  leverageBtnTextActive: {
    color: colors.bg,
  },
  executeBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  executeBtnDisabled: {
    opacity: 0.6,
  },
  executeBtnText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.bg,
  },
  balanceText: {
    textAlign: 'center',
    fontSize: font.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
