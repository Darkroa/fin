import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';
import { getOpenPositions, closePosition } from '../lib/api';

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPrice(val: any) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OpenPositionsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  const loadPositions = useCallback(async () => {
    try {
      const res = await getOpenPositions();
      const raw = res?.data;
      setPositions(Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : []);
    } catch (_) {
      setPositions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPositions();
  }, [loadPositions]);

  const handleClose = useCallback((id: number, ticker: string) => {
    Alert.alert(
      'Close Position',
      `Are you sure you want to close your ${ticker} position?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            setClosingId(id);
            try {
              await closePosition(id);
              await loadPositions();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to close position');
            } finally {
              setClosingId(null);
            }
          },
        },
      ]
    );
  }, [loadPositions]);

  const totalPnl = (Array.isArray(positions) ? positions : []).reduce(
    (sum, p) => sum + (parseFloat(p.unrealized_pnl) || 0),
    0
  );
  const totalPnlColor = totalPnl >= 0 ? colors.green : colors.red;

  const renderItem = ({ item }: { item: any }) => {
    const pnl = parseFloat(item.unrealized_pnl) || 0;
    const pnlColor = pnl >= 0 ? colors.green : colors.red;
    const borderColor = pnl >= 0 ? colors.green : colors.red;
    const isClosing = closingId === item.id;

    return (
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        {/* Top row: ticker + exchange */}
        <View style={styles.cardTopRow}>
          <Text style={styles.ticker}>{item.ticker ?? item.symbol ?? '—'}</Text>
          {item.exchange ? (
            <View style={styles.exchangeBadge}>
              <Text style={styles.exchangeText}>{item.exchange}</Text>
            </View>
          ) : null}
        </View>

        {/* Entry / Current */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Entry</Text>
          <Text style={styles.cardValue}>${formatPrice(item.price)}</Text>
          <Text style={[styles.cardLabel, { marginLeft: spacing.lg }]}>Current</Text>
          <Text style={styles.cardValue}>
            {item.current_price != null ? `$${formatPrice(item.current_price)}` : '—'}
          </Text>
        </View>

        {/* Qty / PnL */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Qty</Text>
          <Text style={styles.cardValue}>{item.qty ?? item.quantity ?? '—'}</Text>
          <Text style={[styles.cardLabel, { marginLeft: spacing.lg }]}>PnL</Text>
          <Text style={[styles.cardValue, { color: pnlColor, fontWeight: '700' }]}>
            {pnl >= 0 ? '+' : ''}${formatPrice(pnl)}
          </Text>
        </View>

        {/* Opened date */}
        <Text style={styles.openedDate}>Opened: {formatDate(item.created_at)}</Text>

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, isClosing && styles.closeBtnDisabled]}
          onPress={() => handleClose(item.id, item.ticker ?? item.symbol ?? 'position')}
          disabled={isClosing}
        >
          {isClosing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.closeBtnText}>Close Position</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Open Positions</Text>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {positions.length} position{positions.length !== 1 ? 's' : ''}
          {'  ·  '}
          <Text style={{ color: totalPnlColor, fontWeight: '700' }}>
            Total PnL: {totalPnl >= 0 ? '+' : ''}${formatPrice(totalPnl)}
          </Text>
        </Text>
      </View>

      <FlatList
        data={positions}
        keyExtractor={(item, i) => String(item.id ?? i)}
        renderItem={renderItem}
        contentContainerStyle={positions.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No open positions</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
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
  summaryBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  summaryText: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: font.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  ticker: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  exchangeBadge: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exchangeText: {
    fontSize: font.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardLabel: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  cardValue: {
    fontSize: font.sm,
    color: colors.text,
    fontWeight: '600',
  },
  openedDate: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  closeBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  closeBtnDisabled: {
    opacity: 0.6,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: font.sm,
    fontWeight: '700',
  },
});
