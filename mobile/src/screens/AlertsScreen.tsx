import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { listAlerts, createAlert, deleteAlert, toggleAlert } from '../lib/api';

type PriceAlert = {
  id: number | string;
  symbol: string;
  target_price: number | string;
  direction: string;
  is_active: boolean;
  triggered_at?: string | null;
};

const SYMBOL_CHIPS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT',
];

export default function AlertsScreen({ navigation }: { navigation: any }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await listAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAlerts();
  }, [fetchAlerts]);

  const handleCreate = async () => {
    if (!price || isNaN(Number(price))) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    setCreating(true);
    try {
      await createAlert({
        symbol: selectedSymbol,
        target_price: parseFloat(price),
        direction,
      });
      setPrice('');
      setSelectedSymbol('BTC/USDT');
      setDirection('above');
      setShowForm(false);
      await fetchAlerts();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create alert.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleAlert(id);
      await fetchAlerts();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to toggle alert.');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Alert', 'Are you sure you want to delete this alert?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlert(id);
            await fetchAlerts();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete alert.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Price Alerts</Text>
        <TouchableOpacity
          style={[styles.addButton, showForm && styles.addButtonActive]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Text style={[styles.addButtonText, showForm && styles.addButtonTextActive]}>
            {showForm ? '✕' : '+'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {/* Create Alert Form */}
          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.sectionHeader}>NEW PRICE ALERT</Text>

              {/* Symbol Chips */}
              <Text style={styles.formLabel}>Symbol</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContent}
              >
                {SYMBOL_CHIPS.map((sym) => (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.chip, selectedSymbol === sym && styles.chipActive]}
                    onPress={() => setSelectedSymbol(sym)}
                  >
                    <Text style={[styles.chipText, selectedSymbol === sym && styles.chipTextActive]}>
                      {sym}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Direction */}
              <Text style={styles.formLabel}>Condition</Text>
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[styles.directionButton, direction === 'above' && styles.directionButtonAbove]}
                  onPress={() => setDirection('above')}
                >
                  <Text style={[styles.directionText, direction === 'above' && styles.directionTextAbove]}>
                    ABOVE ↑
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.directionButton, direction === 'below' && styles.directionButtonBelow]}
                  onPress={() => setDirection('below')}
                >
                  <Text style={[styles.directionText, direction === 'below' && styles.directionTextBelow]}>
                    BELOW ↓
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Price Input */}
              <Text style={styles.formLabel}>Target Price</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />

              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                  <Text style={styles.createButtonText}>Create Alert</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Alerts List */}
          {(Array.isArray(alerts) ? alerts : []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No price alerts set</Text>
              <Text style={styles.emptySubText}>Tap + to create your first alert</Text>
            </View>
          ) : (
            (Array.isArray(alerts) ? alerts : []).map((alert) => (
              <View key={String(alert.id)} style={styles.alertCard}>
                {/* Row 1: symbol | condition | price */}
                <View style={styles.alertRow1}>
                  <View style={styles.symbolBadge}>
                    <Text style={styles.symbolBadgeText}>{alert.symbol}</Text>
                  </View>
                  <Text style={styles.conditionText}>
                    {alert.direction === 'above' ? 'ABOVE ↑' : 'BELOW ↓'}
                  </Text>
                  <Text style={styles.targetPrice}>
                    ${Number(alert.target_price).toLocaleString()}
                  </Text>
                </View>

                {/* Row 2: status | toggle | delete */}
                <View style={styles.alertRow2}>
                  <TouchableOpacity
                    style={[styles.statusPill, alert.is_active ? styles.statusPillActive : styles.statusPillInactive]}
                    onPress={() => handleToggle(Number(alert.id))}
                  >
                    <Text style={[styles.statusPillText, alert.is_active ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
                      {alert.is_active ? '● Active' : '○ Inactive'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.alertSpacer} />
                  {!!alert.triggered_at && (
                    <Text style={styles.triggeredText}>
                      Triggered {new Date(alert.triggered_at).toLocaleDateString()}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(Number(alert.id))}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonActive: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: '#000',
    lineHeight: 34,
    textAlign: 'center',
  },
  addButtonTextActive: {
    color: colors.textSecondary,
    fontSize: font.md,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  // Form
  formCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  formLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContent: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#000',
  },
  directionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  directionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  directionButtonAbove: {
    backgroundColor: 'rgba(3,166,109,0.12)',
    borderColor: colors.green,
  },
  directionButtonBelow: {
    backgroundColor: 'rgba(207,48,74,0.12)',
    borderColor: colors.red,
  },
  directionText: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  directionTextAbove: {
    color: colors.green,
  },
  directionTextBelow: {
    color: colors.red,
  },
  priceInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.md,
    color: colors.text,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: font.md,
    fontWeight: '700',
    color: '#000',
  },
  // Alert cards
  alertCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  alertRow1: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  symbolBadgeText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent,
  },
  conditionText: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  targetPrice: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  alertRow2: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: 'rgba(3,166,109,0.12)',
    borderColor: colors.green,
  },
  statusPillInactive: {
    backgroundColor: 'rgba(94,102,115,0.12)',
    borderColor: colors.textMuted,
  },
  statusPillText: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: colors.green,
  },
  statusPillTextInactive: {
    color: colors.textMuted,
  },
  alertSpacer: {
    flex: 1,
  },
  triggeredText: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  deleteButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: 'transparent',
  },
  deleteButtonText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.red,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: font.md,
    color: colors.text,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
