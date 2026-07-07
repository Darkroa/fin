import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert, SafeAreaView,
} from 'react-native';
import { getOpenPositions, closeManualPosition } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

type Position = {
  id?: number | string;
  ticker?: string;
  pair?: string;
  side?: string;
  entry_price?: number;
  current_price?: number;
  qty?: number;
  quantity?: number;
  leverage?: number;
  pnl?: number;
  unrealized_pnl?: number;
  pnl_pct?: number;
};

function PositionCard({ pos, onClose, isClosing }: { pos: Position; onClose: () => void; isClosing: boolean }) {
  const pnl     = pos.pnl ?? pos.unrealized_pnl ?? 0;
  const pnlPct  = pos.pnl_pct ?? 0;
  const isPos   = pnl >= 0;
  const pnlColor = isPos ? colors.green : colors.red;
  const isBuy   = (pos.side ?? '').toLowerCase() === 'buy';
  const qty     = pos.qty ?? pos.quantity ?? 0;

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.sideBadge, { backgroundColor: isBuy ? colors.greenMuted : colors.redMuted }]}>
          <Text style={[styles.sideText, { color: isBuy ? colors.green : colors.red }]}>
            {isBuy ? '▲ LONG' : '▼ SHORT'}
          </Text>
        </View>
        <Text style={styles.ticker}>{pos.ticker ?? pos.pair ?? '—'}</Text>
        {!!pos.leverage && pos.leverage > 1 && (
          <View style={styles.leverageBadge}>
            <Text style={styles.leverageText}>{pos.leverage}x</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.closeBtn, isClosing && { opacity: 0.5 }]}
          onPress={onClose}
          disabled={isClosing}
        >
          {isClosing
            ? <ActivityIndicator color={colors.red} size="small" />
            : <Text style={styles.closeBtnText}>Close</Text>}
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>ENTRY</Text>
          <Text style={styles.statValue}>${Number(pos.entry_price ?? 0).toFixed(4)}</Text>
        </View>
        <View style={[styles.statCol, styles.statColCenter]}>
          <Text style={styles.statLabel}>CURRENT</Text>
          <Text style={styles.statValue}>${Number(pos.current_price ?? 0).toFixed(4)}</Text>
        </View>
        <View style={[styles.statCol, styles.statColRight]}>
          <Text style={styles.statLabel}>QTY</Text>
          <Text style={styles.statValue}>{Number(qty).toFixed(4)}</Text>
        </View>
      </View>

      {/* P&L bar */}
      <View style={[styles.pnlRow, { backgroundColor: pnlColor + '11' }]}>
        <Text style={[styles.pnlLabel, { color: pnlColor }]}>Unrealized P&L</Text>
        <Text style={[styles.pnlValue, { color: pnlColor }]}>
          {isPos ? '+' : ''}${Math.abs(pnl).toFixed(2)}{' '}
          ({isPos ? '+' : ''}{pnlPct.toFixed(2)}%)
        </Text>
      </View>
    </View>
  );
}

export default function OpenPositionsScreen() {
  const [positions, setPositions]   = useState<Position[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing]       = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getOpenPositions();
      setPositions(Array.isArray(res.data) ? res.data : []);
    } catch { setPositions([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleClose = (pos: Position) => {
    const id = String(pos.id ?? pos.ticker ?? '');
    Alert.alert('Close Position', `Close your ${pos.ticker ?? pos.pair} position?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive', onPress: async () => {
          setClosing(id);
          try {
            await closeManualPosition(Number(id));
            load();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to close position.');
          } finally { setClosing(null); }
        }
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Open Positions</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{positions.length}</Text>
        </View>
      </View>

      {positions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Open Positions</Text>
          <Text style={styles.emptySub}>Place a trade to see your positions here</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.listCard}>
            {positions.map((pos, index) => (
              <View key={String(pos.id ?? index)} style={index < positions.length - 1 ? styles.itemBorder : undefined}>
                <PositionCard
                  pos={pos}
                  isClosing={closing === String(pos.id ?? pos.ticker ?? index)}
                  onClose={() => handleClose(pos)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  countBadge: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  countText: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  listCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  card: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sideBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sideText: { fontSize: font.xs, fontWeight: '700' },
  ticker: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.text },
  leverageBadge: { backgroundColor: colors.accentMuted, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  leverageText: { fontSize: font.xs, color: colors.accent, fontWeight: '700' },
  closeBtn: { backgroundColor: colors.redMuted, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: colors.red },
  closeBtnText: { color: colors.red, fontSize: font.xs, fontWeight: '700' },
  statsRow: { flexDirection: 'row', marginBottom: spacing.xs },
  statCol: { flex: 1 },
  statColCenter: { alignItems: 'center' },
  statColRight: { alignItems: 'flex-end' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 3 },
  statValue: { fontSize: font.sm, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 10, marginTop: spacing.xs },
  pnlLabel: { fontSize: font.xs, fontWeight: '600' },
  pnlValue: { fontSize: font.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptySub: { fontSize: font.sm, color: colors.textSecondary },
});
