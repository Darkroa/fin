import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getMyTransactions, getMyDepositConfig, requestWithdrawal, p2pSend } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

type ModalType = 'deposit' | 'withdraw' | 'p2p' | null;

function TxRow({ tx }: { tx: any }) {
  const isIn = ['deposit', 'bonus', 'trade_profit'].includes(tx.transaction_type);
  const isOut = ['withdrawal', 'trade_loss', 'fee'].includes(tx.transaction_type);
  const isTrade = tx.transaction_type?.startsWith('trade');
  const amountColor = isIn ? colors.green : isOut ? colors.red : colors.textSecondary;
  const sign = isIn ? '+' : isOut ? '-' : '';
  const status = tx.status ?? 'pending';
  const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.red : colors.accent;

  const iconBg = isIn
    ? colors.green + '26'
    : isOut
    ? colors.red + '26'
    : colors.accent + '26';
  const iconColor = isIn ? colors.green : isOut ? colors.red : colors.accent;
  const iconChar = isIn ? '↓' : isTrade ? '⇄' : '↑';

  return (
    <View style={styles.txCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.txIconCircle, { backgroundColor: iconBg }]}>
          <Text style={[styles.txIconText, { color: iconColor }]}>{iconChar}</Text>
        </View>
        <View style={styles.txMiddle}>
          <Text style={styles.txType}>{tx.transaction_type?.replace(/_/g, ' ') ?? '—'}</Text>
          <Text style={styles.txDate}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: amountColor }]}>
            {sign}${Math.abs(tx.amount_usdt ?? 0).toFixed(2)}
          </Text>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

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
      const [txRes, cfgRes] = await Promise.allSettled([
        getMyTransactions(),
        getMyDepositConfig(),
      ]);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data ?? []);
      if (cfgRes.status === 'fulfilled') setDepositConfig(cfgRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); refreshUser(); };

  const openModal = (type: ModalType) => {
    setAmount(''); setAddress(''); setRecipientEmail('');
    setModal(type);
  };

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
    } finally {
      setSubmitting(false);
    }
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
    } finally {
      setSubmitting(false);
    }
  };

  const balance = user?.balance_usdt ?? 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Hero balance card */}
        <View style={styles.heroCard}>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.balanceValue}>
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>

          {/* 3 action buttons */}
          <View style={styles.actionRow}>
            {[
              { label: 'Deposit', type: 'deposit' as ModalType },
              { label: 'Withdraw', type: 'withdraw' as ModalType },
              { label: 'Send', type: 'p2p' as ModalType },
            ].map(a => (
              <TouchableOpacity key={a.type} style={styles.actionBtn} onPress={() => openModal(a.type)}>
                <Text style={styles.actionBtnText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Activity section */}
        <Text style={styles.sectionHeader}>ACTIVITY</Text>

        {transactions.length === 0 ? (
          <Text style={styles.empty}>No transactions yet</Text>
        ) : (
          transactions.slice(0, 20).map((tx, i) => <TxRow key={i} tx={tx} />)
        )}
      </ScrollView>

      {/* Deposit Modal */}
      <Modal visible={modal === 'deposit'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Deposit USDT</Text>
            {depositConfig ? (
              <>
                <Text style={styles.depositNote}>Send USDT to the address below. Your balance will be updated after confirmation.</Text>
                <View style={styles.depositAddressBox}>
                  <Text style={styles.depositNetwork}>{depositConfig.network ?? 'TRC20'}</Text>
                  <Text style={styles.depositAddress} selectable>{depositConfig.address ?? 'Contact support for deposit address'}</Text>
                </View>
                {depositConfig.min_deposit && (
                  <Text style={styles.depositMeta}>Min deposit: ${depositConfig.min_deposit} USDT</Text>
                )}
              </>
            ) : (
              <Text style={styles.depositNote}>Contact support to get your deposit address.</Text>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModal(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={modal === 'withdraw'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw USDT</Text>
            <Text style={styles.inputLabel}>Amount (USDT)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.inputLabel}>Wallet Address (TRC20)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="T..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
                onPress={handleWithdraw}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.confirmBtnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* P2P Modal */}
      <Modal visible={modal === 'p2p'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>P2P Send</Text>
            <Text style={styles.inputLabel}>Amount (USDT)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.inputLabel}>Recipient Email</Text>
            <TextInput
              style={styles.input}
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder="friend@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
                onPress={handleP2P}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.confirmBtnText}>Send</Text>}
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

  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },

  content: { paddingBottom: spacing.xl },

  // Hero card
  heroCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#000', fontWeight: '700', fontSize: font.sm },

  // Section header
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },

  // Transaction cards
  txCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  txIconText: { fontSize: 18, fontWeight: '700' },
  txMiddle: { flex: 1 },
  txType: { fontSize: font.sm, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  txDate: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: font.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusPillText: { fontSize: font.xs, fontWeight: '600', textTransform: 'capitalize' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: font.md,
    marginBottom: spacing.md,
  },
  depositNote: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  depositAddressBox: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  depositNetwork: { fontSize: font.xs, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  depositAddress: { fontSize: font.sm, color: colors.text, fontFamily: 'monospace' },
  depositMeta: { fontSize: font.xs, color: colors.textMuted, marginBottom: spacing.md },
  closeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeBtnText: { color: colors.textSecondary, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#000', fontWeight: '700' },
});
