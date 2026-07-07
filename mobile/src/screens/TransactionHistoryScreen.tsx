import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';
import { getMyTransactions, getBotTrades } from '../lib/api';

type TabType = 'wallet' | 'bot';
type FilterType = 'All' | 'Deposit' | 'Withdrawal' | 'P2P';

const WALLET_FILTERS: FilterType[] = ['All', 'Deposit', 'Withdrawal', 'P2P'];

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAmount(amount: any) {
  const n = parseFloat(amount);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTxTypeLabel(type: string): string {
  switch (type) {
    case 'deposit': return 'Deposit';
    case 'withdrawal': return 'Withdrawal';
    case 'p2p_send': return 'P2P Send';
    case 'p2p_receive': return 'P2P Receive';
    case 'trade': return 'Trade';
    case 'vps': return 'VPS';
    case 'asset': return 'Asset';
    default: return type ?? 'Unknown';
  }
}

function isIncoming(type: string): boolean {
  return type === 'deposit' || type === 'p2p_receive';
}

function matchesFilter(tx: any, filter: FilterType): boolean {
  if (filter === 'All') return true;
  if (filter === 'Deposit') return tx.type === 'deposit';
  if (filter === 'Withdrawal') return tx.type === 'withdrawal';
  if (filter === 'P2P') return tx.type === 'p2p_send' || tx.type === 'p2p_receive';
  return true;
}

export default function TransactionHistoryScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [walletFilter, setWalletFilter] = useState<FilterType>('All');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [botTrades, setBotTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [txRes, botRes] = await Promise.allSettled([
        getMyTransactions(),
        getBotTrades(50),
      ]);
      if (txRes.status === 'fulfilled') {
        const raw = txRes.value?.data;
        setTransactions(Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : []);
      }
      if (botRes.status === 'fulfilled') {
        const raw = botRes.value?.data;
        setBotTrades(Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : []);
      }
    } catch (_) {
      // errors handled per-request
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const filteredTx = (Array.isArray(transactions) ? transactions : []).filter((tx) =>
    matchesFilter(tx, walletFilter)
  );

  const renderWalletRow = ({ item }: { item: any }) => {
    const incoming = isIncoming(item.type);
    const statusColor =
      item.status === 'completed' ? colors.green :
      item.status === 'rejected' ? colors.red :
      colors.accent;

    return (
      <View style={styles.txRow}>
        <View style={styles.txIconCol}>
          <Text style={[styles.txIcon, { color: incoming ? colors.green : colors.red }]}>
            {incoming ? '▼' : '▲'}
          </Text>
        </View>
        <View style={styles.txMiddle}>
          <Text style={styles.txTypeLabel}>{getTxTypeLabel(item.type)}</Text>
          <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txAmount}>${formatAmount(item.amount)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status ?? 'pending'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBotTradeRow = ({ item }: { item: any }) => {
    const isBuy = (item.action ?? item.side ?? '').toUpperCase() === 'BUY';
    const pnl = parseFloat(item.pnl ?? item.realized_pnl ?? 0);
    const pnlColor = pnl >= 0 ? colors.green : colors.red;

    return (
      <View style={styles.txRow}>
        <View style={styles.txMiddle}>
          <View style={styles.botTradeTopRow}>
            <Text style={styles.botTicker}>{item.ticker ?? item.symbol ?? '—'}</Text>
            <View style={[styles.actionBadge, { backgroundColor: isBuy ? colors.green : colors.red }]}>
              <Text style={styles.actionBadgeText}>{isBuy ? 'BUY' : 'SELL'}</Text>
            </View>
          </View>
          <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txAmount}>${formatAmount(item.price)}</Text>
          <Text style={styles.txQty}>Qty: {item.qty ?? item.quantity ?? '—'}</Text>
          {pnl !== 0 && (
            <Text style={[styles.txPnl, { color: pnlColor }]}>
              PnL: {pnl >= 0 ? '+' : ''}${formatAmount(pnl)}
            </Text>
          )}
        </View>
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
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['wallet', 'bot'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'wallet' ? 'Wallet' : 'Bot Trades'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'wallet' && (
        <>
          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {WALLET_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, walletFilter === f && styles.filterChipActive]}
                onPress={() => setWalletFilter(f)}
              >
                <Text style={[styles.filterChipText, walletFilter === f && styles.filterChipTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredTx}
            keyExtractor={(item, i) => String(item.id ?? i)}
            renderItem={renderWalletRow}
            contentContainerStyle={filteredTx.length === 0 ? styles.emptyContainer : styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No transactions found</Text>}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
          />
        </>
      )}

      {activeTab === 'bot' && (
        <FlatList
          data={Array.isArray(botTrades) ? botTrades : []}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={renderBotTradeRow}
          contentContainerStyle={botTrades.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No bot trades found</Text>}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.bg,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.bg,
    fontWeight: '700',
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
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  txIconCol: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  txIcon: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  txMiddle: {
    flex: 1,
  },
  txTypeLabel: {
    fontSize: font.md,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  txDate: {
    fontSize: font.xs,
    color: colors.textMuted,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  txQty: {
    fontSize: font.xs,
    color: colors.textSecondary,
  },
  txPnl: {
    fontSize: font.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  botTradeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  botTicker: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  actionBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionBadgeText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: '#fff',
  },
});
