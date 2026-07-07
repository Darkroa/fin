import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { getEvents } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

type CalEvent = {
  id: number | string;
  headline?: string;
  title?: string;
  description?: string;
  event_type?: string;
  scheduled_at?: string;
  created_at?: string;
  impact_score?: number;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function impactColor(score?: number): string {
  if (!score) return colors.textMuted;
  if (score >= 7) return colors.red;
  if (score >= 4) return colors.accent;
  return colors.green;
}

function getDayLabel(dateStr?: string): string {
  if (!dateStr) return '?';
  const d = new Date(dateStr);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function CalendarScreen() {
  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number | string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getEvents(50);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch { setEvents([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Group events by date
  const grouped: Record<string, CalEvent[]> = {};
  events.forEach(ev => {
    const dateStr = ev.scheduled_at ?? ev.created_at ?? '';
    const key = dateStr ? new Date(dateStr).toDateString() : 'Undated';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market Calendar</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{events.length} events</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {sortedGroups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No Events</Text>
            <Text style={styles.emptySub}>Market events will appear here</Text>
          </View>
        ) : (
          sortedGroups.map(([dateKey, evs]) => {
            const dateLabel = dateKey === 'Undated'
              ? 'Undated Events'
              : (() => {
                  const d = new Date(dateKey);
                  const today = new Date().toDateString();
                  const tomorrow = new Date(Date.now() + 86400000).toDateString();
                  if (dateKey === today) return 'Today';
                  if (dateKey === tomorrow) return 'Tomorrow';
                  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
                })();
            return (
              <View key={dateKey} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayDot} />
                  <Text style={styles.dayLabel}>{dateLabel}</Text>
                  <View style={styles.dayCountBadge}>
                    <Text style={styles.dayCountText}>{evs.length}</Text>
                  </View>
                </View>
                <View style={styles.eventsCard}>
                  {evs.map((ev, i) => {
                    const ic = impactColor(ev.impact_score);
                    const title = ev.headline ?? ev.title ?? 'Market Event';
                    const isExpanded = selected === ev.id;
                    return (
                      <TouchableOpacity
                        key={String(ev.id ?? i)}
                        style={[styles.eventRow, i < evs.length - 1 && styles.eventRowBorder]}
                        onPress={() => setSelected(isExpanded ? null : (ev.id ?? i))}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.impactBar, { backgroundColor: ic }]} />
                        <View style={styles.eventBody}>
                          <Text style={styles.eventTitle} numberOfLines={isExpanded ? undefined : 1}>{title}</Text>
                          {ev.event_type && (
                            <View style={styles.typeBadge}>
                              <Text style={styles.typeText}>{ev.event_type}</Text>
                            </View>
                          )}
                          {isExpanded && ev.description && (
                            <Text style={styles.eventDesc}>{ev.description}</Text>
                          )}
                        </View>
                        <View style={[styles.impactScore, { borderColor: ic }]}>
                          <Text style={[styles.impactScoreText, { color: ic }]}>{ev.impact_score ?? '—'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  countBadge: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  countText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  dayGroup: { marginBottom: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  dayLabel: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  dayCountBadge: { backgroundColor: colors.accentMuted, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  dayCountText: { fontSize: 10, color: colors.accent, fontWeight: '700' },
  eventsCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, paddingHorizontal: spacing.sm, gap: spacing.sm },
  eventRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  impactBar: { width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 20, marginTop: 2 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text, lineHeight: 20, marginBottom: 4 },
  typeBadge: { backgroundColor: colors.cardAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  typeText: { fontSize: 10, color: colors.textMuted, textTransform: 'capitalize' },
  eventDesc: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 18, marginTop: 6 },
  impactScore: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  impactScoreText: { fontSize: font.xs, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptySub: { fontSize: font.sm, color: colors.textSecondary },
});
