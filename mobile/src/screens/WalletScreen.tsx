import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { getMyTransactions, getMyDepositConfig, requestWithdrawal, p2pSend } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

type ModalType = 'deposit' | 'withdraw' | 'p2p' | null;

function TxRow({ tx }: { tx: any }) {
  const isIn  = ['deposit', 'bonus', 'trade_profit', 'p2p_receive'].includes(tx.transaction_type);
  const isOut = ['withdrawal', 'trade_loss', 'fee', 'p2p_send'].includes(tx.transaction_type);
  const amountColor = isIn ? colors.green : isOut ? colors.red : colors.textSecondary;
  const sign        = isIn ? '+' : isOut ? '-' : '';
  const status      = tx.status ?? 'pending';
  const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.red : colors.accent;
  const iconBg      = isIn ? colors.greenMuted : isOut ? colors.redMuted : colors.accentMuted;
  const iconColor   = isIn ? colors.green : isOut ? colors.red : colors.accent;
  const iconChar    = isIn ? '↓' : isOut ? '↑' : '⇄';
  const label       = (tx.transaction_type ?? '').replace(/_/g, ' ');

  return (
    <View style={txStyles.card}>
      <View style={[txStyles.iconCircle, { backgroundColor: iconBg }]}>
        <Text style={[txStyles.iconText, { color: iconColor }]}>{iconChar}</Text>
      </View>
      <View style={txStyles.middle}>
        <Text style={txStyles.type}>{label}</Text>
        <Text style={txStyles.date}>
          {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
        </Text>
      </View>
      <View style={txStyles.right}>
        <Text style={[txStyles.amount, { color: amountColor }]}>
          {sign}${Math.abs(tx.amount_usdt ?? 0).toFixed(2)}
        </Text>
        <View style={[txStyles.statusPill, { borderColor: statusColor }]}>
          <Text style={[txStyles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

const txStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconCircle: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  iconText: { fontSize: 16, fontWeight: '700' },
  middle: { flex: 1 },
  type: { fontSize: font.sm, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  date: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: font.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
});

export default function WalletScreen() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [depositConfig, setDepositConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [txRes, cfgRes] = await Promise.allSettled([getMyTransactions(), getMyDepositConfig()]);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data ?? []);
      if (cfgRes.status === 'fulfilled') setDepositConfig(cfgRes.value.data);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); refreshUser(); };

  const openModal = (type: ModalType) => { setAmount(''); setAddress(''); setRecipientEmail(''); setModal(type); };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Enter a withdrawal address.'); return; }
    setSubmitting(true);
    try {
      await requestWithdrawal({ amount_usdt: amt, address: address.trim(), network: 'TRC20' });
      setModal(null);
      Alert.alert('Submitted', 'Withdrawal request submitted. Pending admin approval.');
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to submit withdrawal.');
    } finally { setSubmitting(false); }
  };

  const handleP2P = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    if (!recipientEmail.trim()) { Alert.alert('Error', 'Enter recipient email.'); return; }
    setSubmitting(true);
    try {
      await p2pSend({ amount_usdt: amt, recipient_email: recipientEmail.trim() });
      setModal(null);
      Alert.alert('Sent', `$${amt} sent to ${recipientEmail}.`);
      load(); refreshUser();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to send.');
    } finally { setSubmitting(false); }
  };

  const balance = user?.balance_usdt ?? 0;

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  const ACTION_BTNS = [
    { label: 'Deposit',  icon: '↓', type: 'deposit' as ModalType,  color: colors.green },
    { label: 'Withdraw', icon: '↑', type: 'withdraw' as ModalType, color: colors.accent },
    { label: 'P2P Send', icon: '⇄', type: 'p2p' as ModalType,     color: '#3b82f6' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Hero balance card with glow */}
        <View style={styles.heroWrapper}>
          <View style={styles.glowLayer} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="walletGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.15" />
                  <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="50%" rx="80%" ry="80%" fill="url(#walletGlow)" />
            </Svg>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.balanceValue}>
              ${Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.balanceCurrency}>USDT</Text>

            <View style={styles.actionRow}>
              {ACTION_BTNS.map(a => (
                <TouchableOpacity key={a.type} style={styles.actionBtn} onPress={() => openModal(a.type)} activeOpacity={0.8}>
                  <View style={[styles.actionIconBox, { backgroundColor: a.color + '22' }]}>
                    <Text style={[styles.actionIconText, { color: a.color }]}>{a.icon}</Text>
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Activity */}
        <Text style={styles.sectionHeader}>TRANSACTION HISTORY</Text>
        <View style={styles.txCard}>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.slice(0, 20).map((tx, i) => <TxRow key={i} tx={tx} />)
          )}
        </View>
      </ScrollView>

      {/* Deposit Modal */}
      <Modal visible={modal === 'deposit'} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Deposit USDT</Text>
            {depositConfig ? (
              <>
                <Text style={styles.sheetNote}>Send USDT to the address below. Your balance updates after confirmation.</Text>
                <View style={styles.addressBox}>
                  <Text style={styles.networkLabel}>{depositConfig.network ?? 'TRC20'}</Text>
                  <Text style={styles.addressText} selectable>{depositConfig.address ?? 'Contact support'}</Text>
                </View>
                {depositConfig.min_deposit && (
                  <Text style={styles.metaText}>Min deposit: ${depositConfig.min_deposit} USDT</Text>
                )}
              </>
            ) : (
              <Text style={styles.sheetNote}>Contact support to get your deposit address.</Text>
            )}
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setModal(null)}>
              <Text style={styles.ghostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={modal === 'withdraw'} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Withdraw USDT</Text>
            <Text style={styles.inputLabel}>Amount (USDT)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
            <Text style={styles.inputLabel}>Wallet Address (TRC20)</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="T..." placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setModal(null)}><Text style={styles.ghostBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleWithdraw} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.primaryBtnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* P2P Modal */}
      <Modal visible={modal === 'p2p'} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>P2P Transfer</Text>
            <Text style={styles.inputLabel}>Amount (USDT)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
            <Text style={styles.inputLabel}>Recipient Email</Text>
            <TextInput style={styles.input} value={recipientEmail} onChangeText={setRecipientEmail} placeholder="friend@example.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setModal(null)}><Text style={styles.ghostBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleP2P} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.primaryBtnText}>Send</Text>}
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
  content: { paddingBottom: spacing.xl },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing.sm, paddingHorizontal: spacing.md,
  },

  // Hero
  heroWrapper: { marginHorizontal: spacing.md, marginBottom: spacing.lg, position: 'relative' },
  glowLayer: { ...StyleSheet.absoluteFillObject, borderRadius: radius.xl, overflow: 'hidden' },
  heroCard: {
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.lg, ...shadow.card,
  },
  balanceLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs },
  balanceValue: { fontSize: 36, fontWeight: '800', color: colors.text },
  balanceCurrency: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6 },
  actionIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionIconText: { fontSize: 20, fontWeight: '700' },
  actionLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },

  // Transactions
  txCard: {
    marginHorizontal: spacing.md, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card,
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 32, marginBottom: spacing.sm },
  emptyText: { fontSize: font.sm, color: colors.textMuted },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderColor: colors.border,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  sheetNote: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  addressBox: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  networkLabel: { fontSize: font.xs, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  addressText: { fontSize: font.sm, color: colors.text, fontFamily: 'monospace' },
  metaText: { fontSize: font.xs, color: colors.textMuted, marginBottom: spacing.md },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '500' },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md, marginBottom: spacing.md,
  },
  sheetBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  ghostBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center',
  },
  ghostBtnText: { color: colors.textSecondary, fontWeight: '600' },
  primaryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '700' },
});
