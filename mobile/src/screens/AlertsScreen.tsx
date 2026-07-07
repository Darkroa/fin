import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, SafeAreaView,
} from 'react-native';
import { listAlerts, createAlert, deleteAlert } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

type PriceAlert = {
  id: number | string;
  ticker?: string;
  symbol?: string;
  target_price: number;
  condition?: string;
  direction?: string;
  triggered?: boolean;
  created_at?: string;
};

export default function AlertsScreen() {
  const [alerts, setAlerts]         = useState<PriceAlert[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [ticker, setTicker]         = useState('');
  const [price, setPrice]           = useState('');
  const [direction, setDirection]   = useState<'above' | 'below'>('above');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listAlerts();
      setAlerts(Array.isArray(res.data) ? res.data : []);
    } catch { setAlerts([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleCreate = async () => {
    if (!ticker.trim()) { Alert.alert('Error', 'Enter a ticker.'); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { Alert.alert('Error', 'Enter a valid price.'); return; }
    setSubmitting(true);
    try {
      await createAlert({ symbol: ticker.trim().toUpperCase(), target_price: p, direction });
      setShowModal(false); setTicker(''); setPrice('');
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to create alert.');
    } finally { setSubmitting(false); }
  };

  const handleDelete = (id: number | string) => {
    Alert.alert('Delete Alert', 'Remove this price alert?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAlert(Number(id)); load(); }
        catch { Alert.alert('Error', 'Could not delete alert.'); }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Price Alerts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No Alerts Set</Text>
          <Text style={styles.emptySub}>Get notified when prices hit your targets</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.emptyBtnText}>Create Alert</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.listCard}>
            {alerts.map((item, index) => {
              const dir     = item.condition ?? item.direction ?? 'above';
              const isAbove = dir === 'above' || dir === 'ABOVE';
              const sym     = item.ticker ?? item.symbol ?? '—';
              return (
                <View key={String(item.id)} style={[styles.alertRow, index < alerts.length - 1 && styles.alertRowBorder]}>
                  <View style={[styles.alertIconBox, { backgroundColor: isAbove ? colors.greenMuted : colors.redMuted }]}>
                    <Text style={[styles.alertIcon, { color: isAbove ? colors.green : colors.red }]}>
                      {isAbove ? '▲' : '▼'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTicker}>{sym}</Text>
                    <Text style={styles.alertSub}>
                      {isAbove ? 'Above' : 'Below'} ${Number(item.target_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  {!!item.triggered && (
                    <View style={styles.triggeredBadge}>
                      <Text style={styles.triggeredText}>Triggered</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New Price Alert</Text>

            <Text style={styles.inputLabel}>Ticker Symbol</Text>
            <TextInput style={styles.input} value={ticker} onChangeText={setTicker} autoCapitalize="characters" placeholder="e.g. BTC" placeholderTextColor={colors.textMuted} />

            <Text style={styles.inputLabel}>Target Price (USDT)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} />

            <Text style={styles.inputLabel}>Trigger When Price Is</Text>
            <View style={styles.dirRow}>
              {(['above', 'below'] as const).map(dir => (
                <TouchableOpacity
                  key={dir}
                  style={[styles.dirBtn, direction === dir && (dir === 'above' ? styles.dirBtnGreen : styles.dirBtnRed)]}
                  onPress={() => setDirection(dir)}
                >
                  <Text style={[styles.dirBtnText, direction === dir && styles.dirBtnTextActive]}>
                    {dir === 'above' ? '▲ Above' : '▼ Below'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setShowModal(false)}><Text style={styles.ghostBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.primaryBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 8 },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: font.sm },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  listCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, gap: spacing.sm },
  alertRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  alertIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertIcon: { fontSize: 14, fontWeight: '700' },
  alertTicker: { fontSize: font.md, fontWeight: '600', color: colors.text },
  alertSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  triggeredBadge: { backgroundColor: colors.greenMuted, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  triggeredText: { fontSize: 10, fontWeight: '700', color: colors.green },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.redMuted, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: colors.red, fontSize: font.xs, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptySub: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  emptyBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: spacing.xl },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '500' },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md, marginBottom: spacing.md },
  dirRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dirBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt },
  dirBtnGreen: { backgroundColor: colors.greenMuted, borderColor: colors.green },
  dirBtnRed: { backgroundColor: colors.redMuted, borderColor: colors.red },
  dirBtnText: { color: colors.textSecondary, fontWeight: '600' },
  dirBtnTextActive: { color: colors.text, fontWeight: '700' },
  sheetBtns: { flexDirection: 'row', gap: spacing.sm },
  ghostBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  ghostBtnText: { color: colors.textSecondary, fontWeight: '600' },
  primaryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '700' },
});
