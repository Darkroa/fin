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

  const renderItem = ({ item }: { item: Notification }) => (
    <View
      style={[
        styles.card,
        item.is_read ? styles.cardRead : styles.cardUnread,
      ]}
    >
      {!item.is_read && <View style={styles.unreadBar} />}
      <View style={styles.cardContent}>
        {!!item.title && (
          <Text style={styles.cardTitle}>{item.title}</Text>
        )}
        {!!item.message && (
          <Text style={styles.cardMessage} numberOfLines={3}>
            {item.message}
          </Text>
        )}
        <View style={styles.cardFooter}>
          {!!item.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.type}</Text>
            </View>
          )}
          <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    </View>
  );

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
              <Text style={styles.emptyText}>No notifications yet</Text>
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
  listContent: {
    padding: spacing.md,
  },
  card: {
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRead: {
    backgroundColor: colors.cardAlt,
  },
  cardUnread: {
    backgroundColor: colors.card,
  },
  unreadBar: {
    width: 3,
    backgroundColor: colors.accent,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  cardMessage: {
    fontSize: font.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(240,185,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.3)',
  },
  typeBadgeText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'capitalize',
  },
  timeAgo: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: font.md,
    color: colors.textMuted,
  },
});
