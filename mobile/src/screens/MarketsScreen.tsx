import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput,
  ScrollView, SafeAreaView,
} from 'react-native';
import { getMacroOverview } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

const CRYPTO_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT',
];

// Coingecko public price fetch (no key needed for simple prices)
async function fetchCryptoPrices() {
  const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,avalanche-2';
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  );
  const data = await res.json();
  return [
    { pair: 'BTC/USDT', name: 'Bitcoin',   id: 'bitcoin',      data: data.bitcoin },
    { pair: 'ETH/USDT', name: 'Ethereum',  id: 'ethereum',     data: data.ethereum },
    { pair: 'BNB/USDT', name: 'BNB',       id: 'binancecoin',  data: data.binancecoin },
    { pair: 'SOL/USDT', name: 'Solana',    id: 'solana',       data: data.solana },
    { pair: 'XRP/USDT', name: 'Ripple',    id: 'ripple',       data: data.ripple },
    { pair: 'DOGE/USDT', name: 'Dogecoin', id: 'dogecoin',     data: data.dogecoin },
    { pair: 'ADA/USDT', name: 'Cardano',   id: 'cardano',      data: data.cardano },
    { pair: 'AVAX/USDT', name: 'Avalanche', id: 'avalanche-2', data: data['avalanche-2'] },
  ].filter(i => i.data);
}

// Deterministic color from first char of coin name
function coinColor(pair: string): string {
  const palette = [
    '#F0B90B', '#3498DB', '#E74C3C', '#2ECC71',
    '#9B59B6', '#1ABC9C', '#E67E22', '#E91E63',
  ];
  const idx = pair.charCodeAt(0) % palette.length;
  return palette[idx];
}

type FilterTab = 'All' | 'Crypto' | 'Metals' | 'Stocks';
const FILTER_TABS: FilterTab[] = ['All', 'Crypto', 'Metals', 'Stocks'];

function PriceRow({ item }: { item: any }) {
  const price = item.data?.usd ?? 0;
  const change = item.data?.usd_24h_change ?? 0;
  const isPos = change >= 0;
  const symbol = item.pair.split('/')[0];
  const abbrev = symbol.slice(0, 2).toUpperCase();
  const circleColor = coinColor(symbol);

  return (
    <View style={styles.priceRow}>
      {/* Left: avatar + name */}
      <View style={styles.priceLeft}>
        <View style={[styles.coinCircle, { backgroundColor: circleColor + '33' }]}>
          <Text style={[styles.coinAbbrev, { color: circleColor }]}>{abbrev}</Text>
        </View>
        <View>
          <Text style={styles.pairText}>{item.pair}</Text>
          <Text style={styles.pairName}>{item.name}</Text>
        </View>
      </View>
      {/* Right: price + change pill */}
      <View style={styles.priceRight}>
        <Text style={styles.priceText}>
          ${price >= 1
            ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : price.toFixed(6)}
        </Text>
        <View style={[styles.changePill, { backgroundColor: isPos ? colors.green + '26' : colors.red + '26' }]}>
          <Text style={[styles.changeText, { color: isPos ? colors.green : colors.red }]}>
            {isPos ? '+' : ''}{change.toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

function MacroRow({ label, value }: { label: string; value: any }) {
  if (value == null) return null;
  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{typeof value === 'number' ? value.toFixed(2) : String(value)}</Text>
    </View>
  );
}

export default function MarketsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cryptoPrices, setCryptoPrices] = useState<any[]>([]);
  const [macro, setMacro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pricesRes, macroRes] = await Promise.allSettled([
        fetchCryptoPrices(),
        getMacroOverview(),
      ]);
      if (pricesRes.status === 'fulfilled') setCryptoPrices(pricesRes.value);
      if (macroRes.status === 'fulfilled') setMacro(macroRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Filter prices based on search + active filter tab
  const filteredPrices = cryptoPrices.filter(item => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    // For now all items are crypto; Metals/Stocks show empty (no data source)
    const matchesFilter =
      activeFilter === 'All' || activeFilter === 'Crypto';
    return matchesSearch && matchesFilter;
  });

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
        <Text style={styles.headerTitle}>Markets</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍  Search assets..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Price list */}
      <FlatList
        data={filteredPrices}
        keyExtractor={item => item.pair}
        renderItem={({ item }) => <PriceRow item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {activeFilter !== 'All' && activeFilter !== 'Crypto'
              ? `No ${activeFilter} data available`
              : 'No assets found'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  liveText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.green,
    letterSpacing: 0.5,
  },

  // Search
  searchContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: font.sm,
  },

  // Filter tabs
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  filterTabActive: {
    backgroundColor: colors.accent,
  },
  filterTabText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#000',
    fontWeight: '700',
  },

  // Price rows
  listContent: {
    paddingBottom: spacing.xl,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinAbbrev: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  pairText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  pairName: {
    fontSize: font.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priceText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  changeText: {
    fontSize: font.xs,
    fontWeight: '600',
  },

  // Macro
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  macroLabel: {
    fontSize: font.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  macroValue: {
    fontSize: font.sm,
    color: colors.text,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: font.sm,
  },
});
