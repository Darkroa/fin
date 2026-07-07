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
              <Text style={styles.formTitle}>New Price Alert</Text>

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
                    style={[
                      styles.chip,
                      selectedSymbol === sym && styles.chipActive,
                    ]}
                    onPress={() => setSelectedSymbol(sym)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedSymbol === sym && styles.chipTextActive,
                      ]}
                    >
                      {sym}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Direction */}
              <Text style={styles.formLabel}>Direction</Text>
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[
                    styles.directionButton,
                    direction === 'above' && styles.directionButtonAbove,
                  ]}
                  onPress={() => setDirection('above')}
                >
                  <Text
                    style={[
                      styles.directionText,
                      direction === 'above' && styles.directionTextActive,
                    ]}
                  >
                    Above ↑
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.directionButton,
                    direction === 'below' && styles.directionButtonBelow,
                  ]}
                  onPress={() => setDirection('below')}
                >
                  <Text
                    style={[
                      styles.directionText,
                      direction === 'below' && styles.directionTextActive,
                    ]}
                  >
                    Below ↓
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
              <Text style={styles.emptyText}>No price alerts set</Text>
              <Text style={styles.emptySubText}>Tap + to create your first alert</Text>
            </View>
          ) : (
            (Array.isArray(alerts) ? alerts : []).map((alert) => (
              <View key={String(alert.id)} style={styles.alertCard}>
                <View style={styles.alertLeft}>
                  <Text style={styles.alertSymbol}>{alert.symbol}</Text>
                  <View style={styles.alertBadgesRow}>
                    <View
                      style={[
                        styles.directionBadge,
                        alert.direction === 'above'
                          ? styles.directionBadgeAbove
                          : styles.directionBadgeBelow,
                      ]}
                    >
                      <Text
                        style={[
                          styles.directionBadgeText,
                          alert.direction === 'above'
                            ? styles.directionBadgeTextAbove
                            : styles.directionBadgeTextBelow,
                        ]}
                      >
                        {alert.direction === 'above' ? 'Above ↑' : 'Below ↓'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusChip,
                        alert.is_active ? styles.statusChipActive : styles.statusChipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          alert.is_active
                            ? styles.statusChipTextActive
                            : styles.statusChipTextInactive,
                        ]}
                      >
                        {alert.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alertPrice}>
                    ${Number(alert.target_price).toLocaleString()}
                  </Text>
                  {!!alert.triggered_at && (
                    <Text style={styles.triggeredText}>
                      Triggered: {new Date(alert.triggered_at).toLocaleString()}
                    </Text>
                  )}
                </View>
                <View style={styles.alertActions}>
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => handleToggle(Number(alert.id))}
                  >
                    <Text style={styles.toggleButtonText}>
                      {alert.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(Number(alert.id))}
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonActive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.bg,
    lineHeight: 22,
  },
  addButtonTextActive: {
    color: colors.textSecondary,
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
  // Form
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  formTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textSecondary,
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
    borderRadius: radius.xl,
    backgroundColor: colors.cardAlt,
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
    color: colors.bg,
  },
  directionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  directionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  directionButtonAbove: {
    backgroundColor: 'rgba(3,166,109,0.15)',
    borderColor: colors.green,
  },
  directionButtonBelow: {
    backgroundColor: 'rgba(207,48,74,0.15)',
    borderColor: colors.red,
  },
  directionText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  directionTextActive: {
    color: colors.text,
  },
  priceInput: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.md,
    color: colors.text,
    marginTop: spacing.xs,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.bg,
  },
  // Alert rows
  alertCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  alertLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  alertSymbol: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  alertBadgesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  directionBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  directionBadgeAbove: {
    borderColor: colors.green,
    backgroundColor: 'rgba(3,166,109,0.12)',
  },
  directionBadgeBelow: {
    borderColor: colors.red,
    backgroundColor: 'rgba(207,48,74,0.12)',
  },
  directionBadgeText: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  directionBadgeTextAbove: {
    color: colors.green,
  },
  directionBadgeTextBelow: {
    color: colors.red,
  },
  statusChip: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusChipActive: {
    borderColor: colors.green,
    backgroundColor: 'rgba(3,166,109,0.12)',
  },
  statusChipInactive: {
    borderColor: colors.textMuted,
    backgroundColor: 'rgba(94,102,115,0.12)',
  },
  statusChipText: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: colors.green,
  },
  statusChipTextInactive: {
    color: colors.textMuted,
  },
  alertPrice: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.accent,
  },
  triggeredText: {
    fontSize: font.xs,
    color: colors.textMuted,
  },
  alertActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  toggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(207,48,74,0.15)',
    borderWidth: 1,
    borderColor: colors.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.red,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: font.md,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
