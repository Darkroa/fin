import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { colors, spacing, radius, font, shadow } from '../theme';
import { getEvents } from '../lib/api';

type NewsEvent = {
  id: number | string;
  headline?: string;
  title?: string;
  description?: string;
  event_type?: string;
  tickers_affected?: string[];
  sentiment?: string;
  impact_score?: number;
  created_at?: string;
};

function timeAgo(isoString?: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function getImpactColor(score?: number): string {
  if (!score && score !== 0) return colors.textMuted;
  if (score >= 7) return colors.red;
  if (score >= 4) return colors.accent;
  return colors.green;
}

function getSentimentColor(sentiment?: string): string {
  if (!sentiment) return colors.textMuted;
  const s = sentiment.toLowerCase();
  if (s === 'bullish' || s === 'positive') return colors.green;
  if (s === 'bearish' || s === 'negative') return colors.red;
  return colors.textSecondary;
}

export default function NewsScreen() {
  const [events, setEvents]     = useState<NewsEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'news' | 'events'>('news');

  const fetchData = useCallback(async () => {
    try {
      const res = await getEvents(40);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch { setEvents([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filteredData = events.filter(item => {
    if (activeTab === 'events') return item.event_type && item.event_type !== 'news';
    return !item.event_type || item.event_type === 'news';
  });

  const renderItem = ({ item, index }: { item: NewsEvent; index: number }) => {
    const impactColor    = getImpactColor(item.impact_score);
    const sentimentColor = getSentimentColor(item.sentiment);
    const headline       = item.headline || item.title || 'No headline';

    return (
      <View style={[styles.card, index < filteredData.length - 1 && styles.cardBorder]}>
        <View style={styles.cardHeader}>
          <View style={[styles.impactDot, { backgroundColor: impactColor }]} />
          <Text style={styles.headline} numberOfLines={2}>{headline}</Text>
        </View>
        {!!item.description && (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        )}
        <View style={styles.cardFooter}>
          {!!item.sentiment && (
            <View style={[styles.sentimentBadge, { backgroundColor: getSentimentColor(item.sentiment) + '22', borderColor: sentimentColor }]}>
              <Text style={[styles.sentimentText, { color: sentimentColor }]}>{item.sentiment}</Text>
            </View>
          )}
          {item.impact_score !== undefined && (
            <View style={[styles.impactBadge, { backgroundColor: impactColor + '22' }]}>
              <Text style={[styles.impactText, { color: impactColor }]}>Impact {item.impact_score}/10</Text>
            </View>
          )}
          {!!item.tickers_affected?.length && (
            <Text style={styles.tickers}>{item.tickers_affected.slice(0, 3).join(', ')}</Text>
          )}
          <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News & Events</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['news', 'events'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📰</Text>
              <Text style={styles.emptyText}>No {activeTab} available</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },

  tabBar: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontSize: font.sm, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#000', fontWeight: '700' },

  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card, paddingVertical: spacing.md,
  },
  cardBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs, gap: spacing.sm },
  impactDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  headline: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.text, lineHeight: 21 },
  description: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm, paddingLeft: spacing.md + spacing.xs },
  cardFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: spacing.md + spacing.xs },
  sentimentBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sentimentText: { fontSize: font.xs, fontWeight: '600', textTransform: 'capitalize' },
  impactBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  impactText: { fontSize: font.xs, fontWeight: '600' },
  tickers: { fontSize: font.xs, color: colors.textMuted },
  timeAgo: { fontSize: font.xs, color: colors.textMuted, marginLeft: 'auto' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: font.md, color: colors.textMuted },
});
