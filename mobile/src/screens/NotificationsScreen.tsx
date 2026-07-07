import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { colors, spacing, radius, font, shadow } from '../theme';
import { getUserNotifications } from '../lib/api';

type Notification = {
  id: number | string;
  title?: string;
  message?: string;
  notification_type?: string;
  is_read?: boolean;
  created_at?: string;
};

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  price_alert:  { icon: '🔔', color: colors.accent },
  trade:        { icon: '⚡', color: colors.green },
  bot_update:   { icon: '🤖', color: '#a78bfa' },
  news:         { icon: '📰', color: '#60a5fa' },
  deposit:      { icon: '💰', color: colors.green },
  withdrawal:   { icon: '💸', color: colors.red },
  system:       { icon: '⚙️', color: colors.textSecondary },
};

function timeAgo(isoString?: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getUserNotifications();
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch { setNotifications([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderItem = ({ item, index }: { item: Notification; index: number }) => {
    const cfg = TYPE_CONFIG[item.notification_type ?? ''] ?? TYPE_CONFIG.system;
    return (
      <View style={[styles.row, item.is_read ? styles.rowRead : styles.rowUnread, index < notifications.length - 1 && styles.rowBorder]}>
        <View style={[styles.iconBox, { backgroundColor: cfg.color + '22' }]}>
          <Text style={styles.iconEmoji}>{cfg.icon}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
              {item.title ?? 'Notification'}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>{item.message ?? ''}</Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
          </View>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>No new notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ItemSeparatorComponent={() => null}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  unreadBadge: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  unreadBadgeText: { fontSize: font.xs, fontWeight: '700', color: '#000' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    backgroundColor: colors.card, marginBottom: 1,
    borderRadius: radius.md,
  },
  rowRead: { opacity: 0.7 },
  rowUnread: { opacity: 1 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji: { fontSize: 18 },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 3 },
  title: { fontSize: font.sm, fontWeight: '500', color: colors.textSecondary, flex: 1 },
  titleUnread: { fontWeight: '700', color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, flexShrink: 0 },
  message: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 18, marginBottom: 5 },
  time: { fontSize: 10, color: colors.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptySub: { fontSize: font.sm, color: colors.textSecondary },
});
