import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity,
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
    { pair: 'BTC/USDT', id: 'bitcoin', data: data.bitcoin },
    { pair: 'ETH/USDT', id: 'ethereum', data: data.ethereum },
    { pair: 'BNB/USDT', id: 'binancecoin', data: data.binancecoin },
    { pair: 'SOL/USDT', id: 'solana', data: data.solana },
    { pair: 'XRP/USDT', id: 'ripple', data: data.ripple },
    { pair: 'DOGE/USDT', id: 'dogecoin', data: data.dogecoin },
    { pair: 'ADA/USDT', id: 'cardano', data: data.cardano },
    { pair: 'AVAX/USDT', id: 'avalanche-2', data: data['avalanche-2'] },
  ].filter(i => i.data);
}

type TabType = 'crypto' | 'macro';

function PriceRow({ item }: { item: any }) {
  const price = item.data?.usd ?? 0;
  const change = item.data?.usd_24h_change ?? 0;
  const isPos = change >= 0;
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.pair}>{item.pair}</Text>
        <Text style={styles.rowSub}>24h change</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.price}>
          ${price >= 1 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : price.toFixed(6)}
        </Text>
        <Text style={[styles.change, { color: isPos ? colors.green : colors.red }]}>
          {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </Text>
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
  const [tab, setTab] = useState<TabType>('crypto');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Markets</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['crypto', 'macro'] as TabType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'crypto' ? 'Crypto' : 'Macro'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'crypto' ? (
        <FlatList
          data={cryptoPrices}
          keyExtractor={item => item.pair}
          renderItem={({ item }) => <PriceRow item={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <FlatList
          data={macro ? Object.entries(macro) : []}
          keyExtractor={([k]) => k}
          renderItem={({ item: [k, v] }) => <MacroRow label={k.replace(/_/g, ' ').toUpperCase()} value={v} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={[styles.macroContainer, { paddingBottom: spacing.xl }]}
          ListEmptyComponent={<Text style={styles.empty}>No macro data available</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.md, paddingBottom: 0 },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  tab: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600' },
  tabTextActive: { color: colors.bg },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  rowLeft: {},
  rowRight: { alignItems: 'flex-end' },
  pair: { fontSize: font.md, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  price: { fontSize: font.md, fontWeight: '600', color: colors.text },
  change: { fontSize: font.sm, fontWeight: '600', marginTop: 2 },
  macroContainer: { padding: spacing.md },
  macroRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  macroLabel: { fontSize: font.xs, color: colors.textSecondary, flex: 1 },
  macroValue: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
