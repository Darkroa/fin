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
import { getUserNotifications, markAllNotificationsRead } from '../lib/api';

type Notification = {
  id: number | string;
  title?: string;
  message?: string;
  is_read: boolean;
  created_at?: string;
  type?: string;
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

function getIconForType(type?: string): { emoji: string; bg: string } {
  if (type === 'alert' || type === 'price_alert') return { emoji: '🔔', bg: 'rgba(240,185,11,0.18)' };
  if (type === 'success' || type === 'trade') return { emoji: '✅', bg: 'rgba(3,166,109,0.18)' };
  if (type === 'warning' || type === 'error') return { emoji: '⚠️', bg: 'rgba(207,48,74,0.18)' };
  return { emoji: '🔔', bg: 'rgba(240,185,11,0.18)' };
}

export default function NotificationsScreen({ navigation }: { navigation: any }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getUserNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      await fetchNotifications();
    } catch (e) {
      // silently ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const { emoji, bg } = getIconForType(item.type);
    return (
      <View style={[styles.row, item.is_read ? styles.rowRead : styles.rowUnread]}>
        {!item.is_read && <View style={styles.unreadBar} />}
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Text style={styles.iconEmoji}>{emoji}</Text>
        </View>
        <View style={styles.rowContent}>
          {!!item.title && (
            <Text style={[styles.rowTitle, !item.is_read && styles.rowTitleUnread]}>
              {item.title}
            </Text>
          )}
          {!!item.message && (
            <Text style={styles.rowMessage} numberOfLines={2}>
              {item.message}
            </Text>
          )}
          <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} disabled={markingAll}>
          <Text style={[styles.markAllText, markingAll && styles.markAllTextDisabled]}>
            {markingAll ? 'Marking…' : 'Mark all read'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={Array.isArray(notifications) ? notifications : []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyContainer : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>🔕</Text>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  markAllText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.accent,
  },
  markAllTextDisabled: {
    color: colors.textMuted,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowRead: {
    backgroundColor: colors.cardAlt,
  },
  rowUnread: {
    backgroundColor: '#111518',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 16,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: font.sm,
    fontWeight: '400',
    color: colors.text,
  },
  rowTitleUnread: {
    fontWeight: '600',
  },
  rowMessage: {
    fontSize: font.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  rowTime: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
