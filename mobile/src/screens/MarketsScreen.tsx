import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, ScrollView, SafeAreaView,
} from 'react-native';
import { colors, spacing, radius, font, shadow } from '../theme';

const COIN_META = [
  { pair: 'BTC/USDT', name: 'Bitcoin',   id: 'bitcoin',       symbol: 'BTC' },
  { pair: 'ETH/USDT', name: 'Ethereum',  id: 'ethereum',      symbol: 'ETH' },
  { pair: 'BNB/USDT', name: 'BNB',       id: 'binancecoin',   symbol: 'BNB' },
  { pair: 'SOL/USDT', name: 'Solana',    id: 'solana',        symbol: 'SOL' },
  { pair: 'XRP/USDT', name: 'Ripple',    id: 'ripple',        symbol: 'XRP' },
  { pair: 'DOGE/USDT', name: 'Dogecoin', id: 'dogecoin',      symbol: 'DOGE' },
  { pair: 'ADA/USDT', name: 'Cardano',   id: 'cardano',       symbol: 'ADA' },
  { pair: 'AVAX/USDT', name: 'Avalanche', id: 'avalanche-2',  symbol: 'AVAX' },
];

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', BNB: '#F0B90B', SOL: '#9945FF',
  XRP: '#00AAE4', DOGE: '#C2A633', ADA: '#0033AD', AVAX: '#E84142',
};

async function fetchCryptoPrices() {
  const ids = COIN_META.map(c => c.id).join(',');
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  );
  const data = await res.json();
  return COIN_META.map(c => ({ ...c, data: data[c.id] })).filter(i => i.data);
}

type FilterTab = 'All' | 'Crypto' | 'Metals' | 'Stocks';
const FILTER_TABS: FilterTab[] = ['All', 'Crypto', 'Metals', 'Stocks'];

function PriceRow({ item, index, total }: { item: any; index: number; total: number }) {
  const price  = item.data?.usd ?? 0;
  const change = item.data?.usd_24h_change ?? 0;
  const isPos  = change >= 0;
  const coinColor = COIN_COLORS[item.symbol] ?? colors.accent;

  return (
    <View style={[styles.priceRow, index < total - 1 && styles.priceRowBorder]}>
      <View style={[styles.coinCircle, { backgroundColor: coinColor + '22' }]}>
        <Text style={[styles.coinAbbrev, { color: coinColor }]}>{item.symbol.slice(0, 3)}</Text>
      </View>
      <View style={styles.coinInfo}>
        <Text style={styles.pairText}>{item.pair}</Text>
        <Text style={styles.pairName}>{item.name}</Text>
      </View>
      <View style={styles.priceRight}>
        <Text style={styles.priceText}>
          ${price >= 1
            ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : price.toFixed(6)}
        </Text>
        <View style={[styles.changePill, { backgroundColor: isPos ? colors.greenMuted : colors.redMuted }]}>
          <Text style={[styles.changeText, { color: isPos ? colors.green : colors.red }]}>
            {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function MarketsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cryptoPrices, setCryptoPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const prices = await fetchCryptoPrices();
      setCryptoPrices(prices);
    } catch { /* keep existing */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filteredPrices = cryptoPrices.filter(item => {
    const matchesSearch = searchQuery.trim() === '' ||
      item.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || activeFilter === 'Crypto';
    return matchesSearch && matchesFilter;
  });

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Markets</Text>
          <Text style={styles.headerSub}>{cryptoPrices.length} assets tracked</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search assets..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Price list */}
      <View style={styles.listCard}>
        <FlatList
          data={filteredPrices}
          keyExtractor={item => item.pair}
          renderItem={({ item, index }) => (
            <PriceRow item={item} index={index} total={filteredPrices.length} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeFilter !== 'All' && activeFilter !== 'Crypto' ? `No ${activeFilter} data available` : 'No assets found'}
              </Text>
            </View>
          }
          scrollEnabled={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.greenMuted, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveText: { fontSize: font.xs, fontWeight: '700', color: colors.green },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.md,
  },
  searchIcon: { fontSize: 14, marginRight: spacing.xs },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: font.sm },

  filterRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: 4,
  },
  filterTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterTabText: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive: { color: '#000', fontWeight: '700' },

  listCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden', ...shadow.card,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md },
  priceRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  coinCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  coinAbbrev: { fontSize: font.xs, fontWeight: '800', letterSpacing: -0.3 },
  coinInfo: { flex: 1 },
  pairText: { fontSize: font.md, fontWeight: '700', color: colors.text },
  pairName: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  priceRight: { alignItems: 'flex-end', gap: 5 },
  priceText: { fontSize: font.md, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  changePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  changeText: { fontSize: font.xs, fontWeight: '700' },

  emptyContainer: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: font.sm },
});
