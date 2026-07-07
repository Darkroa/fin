import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { getMyTransactions } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  deposit:        { icon: '↓', color: colors.green,   label: 'Deposit' },
  withdrawal:     { icon: '↑', color: colors.red,     label: 'Withdrawal' },
  trade_profit:   { icon: '▲', color: colors.green,   label: 'Trade Profit' },
  trade_loss:     { icon: '▼', color: colors.red,     label: 'Trade Loss' },
  bonus:          { icon: '★', color: colors.accent,  label: 'Bonus' },
  fee:            { icon: '−', color: colors.red,     label: 'Fee' },
  p2p_send:       { icon: '→', color: colors.red,     label: 'P2P Sent' },
  p2p_receive:    { icon: '←', color: colors.green,   label: 'P2P Received' },
};

type Filter = 'all' | 'deposits' | 'withdrawals' | 'trades';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'deposits',    label: 'Deposits' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'trades',      label: 'Trades' },
];

function filterTx(tx: any[], filter: Filter) {
  if (filter === 'all') return tx;
  if (filter === 'deposits')    return tx.filter(t => ['deposit', 'bonus'].includes(t.transaction_type));
  if (filter === 'withdrawals') return tx.filter(t => ['withdrawal', 'fee'].includes(t.transaction_type));
  if (filter === 'trades')      return tx.filter(t => ['trade_profit', 'trade_loss'].includes(t.transaction_type));
  return tx;
}

export default function TransactionHistoryScreen() {
  const [txs, setTxs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filter, setFilter]           = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const res = await getMyTransactions();
      setTxs(Array.isArray(res.data) ? res.data : []);
    } catch { setTxs([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = filterTx(txs, filter);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const cfg = TYPE_CONFIG[item.transaction_type] ?? { icon: '⇄', color: colors.textSecondary, label: item.transaction_type ?? '—' };
    const isIn  = ['deposit', 'bonus', 'trade_profit', 'p2p_receive'].includes(item.transaction_type);
    const amount = Math.abs(item.amount_usdt ?? 0);
    const status = item.status ?? 'pending';
    const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.red : colors.accent;

    return (
      <View style={[styles.row, index < filtered.length - 1 && styles.rowBorder]}>
        <View style={[styles.iconBox, { backgroundColor: cfg.color + '22' }]}>
          <Text style={[styles.iconText, { color: cfg.color }]}>{cfg.icon}</Text>
        </View>
        <View style={styles.mid}>
          <Text style={styles.txLabel}>{cfg.label}</Text>
          <Text style={styles.txDate}>
            {item.created_at
              ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, { color: cfg.color }]}>
            {isIn ? '+' : '-'}${amount.toFixed(2)}
          </Text>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  // Totals
  const totalIn  = txs.filter(t => ['deposit', 'bonus', 'trade_profit', 'p2p_receive'].includes(t.transaction_type)).reduce((a, t) => a + (t.amount_usdt ?? 0), 0);
  const totalOut = txs.filter(t => ['withdrawal', 'fee', 'trade_loss', 'p2p_send'].includes(t.transaction_type)).reduce((a, t) => a + Math.abs(t.amount_usdt ?? 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction History</Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: colors.greenMuted }]}>
          <Text style={styles.summaryLabel}>Total In</Text>
          <Text style={[styles.summaryValue, { color: colors.green }]}>+${totalIn.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: colors.redMuted }]}>
          <Text style={styles.summaryLabel}>Total Out</Text>
          <Text style={[styles.summaryValue, { color: colors.red }]}>-${totalOut.toFixed(2)}</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No transactions</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => String(item.id ?? index)}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  summaryCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, ...shadow.card,
  },
  summaryLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: font.lg, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: '#000', fontWeight: '700' },
  listCard: { flex: 1, marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, gap: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: font.md, fontWeight: '700' },
  mid: { flex: 1 },
  txLabel: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  txDate: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 5 },
  amount: { fontSize: font.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: font.sm, color: colors.textMuted },
});
