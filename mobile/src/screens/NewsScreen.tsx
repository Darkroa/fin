import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, radius, font } from '../theme';
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
  const now = new Date();
  const past = new Date(isoString);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
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

export default function NewsScreen({ navigation }: { navigation: any }) {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'news' | 'events'>('news');

  const fetchData = useCallback(async () => {
    try {
      const data = await getEvents(40);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredData = (Array.isArray(events) ? events : []).filter((item) => {
    if (activeTab === 'events') {
      return item.event_type && item.event_type !== 'news';
    }
    return !item.event_type || item.event_type === 'news';
  });

  const renderItem = ({ item }: { item: NewsEvent }) => {
    const impactColor = getImpactColor(item.impact_score);
    const sentimentColor = getSentimentColor(item.sentiment);
    const headline = item.headline || item.title || 'No headline';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.dot, { backgroundColor: impactColor }]} />
          <Text style={styles.headline} numberOfLines={2}>
            {headline}
          </Text>
        </View>
        {!!item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.cardFooter}>
          {!!item.sentiment && (
            <View style={[styles.sentimentBadge, { borderColor: sentimentColor }]}>
              <Text style={[styles.sentimentText, { color: sentimentColor }]}>
                {item.sentiment}
              </Text>
            </View>
          )}
          {item.impact_score !== undefined && (
            <View style={styles.impactContainer}>
              <Text style={styles.impactLabel}>Impact </Text>
              <Text style={[styles.impactScore, { color: impactColor }]}>
                {item.impact_score}/10
              </Text>
            </View>
          )}
          {!!item.tickers_affected && item.tickers_affected.length > 0 && (
            <Text style={styles.tickers} numberOfLines={1}>
              {item.tickers_affected.slice(0, 3).join(', ')}
            </Text>
          )}
          <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News & Events</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'news' && styles.activeTab]}
          onPress={() => setActiveTab('news')}
        >
          <Text style={[styles.tabText, activeTab === 'news' && styles.activeTabText]}>
            News
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
            Events
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab} available</Text>
            </View>
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
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.bg,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
    flexShrink: 0,
  },
  headline: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  description: {
    fontSize: font.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
    marginLeft: spacing.md + spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginLeft: spacing.md + spacing.xs,
  },
  sentimentBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  sentimentText: {
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  impactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
  },
  impactScore: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  tickers: {
    fontSize: font.xs,
    color: colors.textMuted,
    flex: 1,
  },
  timeAgo: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: font.md,
    color: colors.textMuted,
  },
});
