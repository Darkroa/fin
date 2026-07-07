import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getMyTransactions, getMyDepositConfig, requestWithdrawal, p2pSend } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

type ModalType = 'deposit' | 'withdraw' | 'p2p' | null;

function TxRow({ tx }: { tx: any }) {
  const isIn = ['deposit', 'bonus', 'trade_profit'].includes(tx.transaction_type);
  const isOut = ['withdrawal', 'trade_loss', 'fee'].includes(tx.transaction_type);
  const color = isIn ? colors.green : isOut ? colors.red : colors.textSecondary;
  const sign = isIn ? '+' : isOut ? '-' : '';
  const status = tx.status ?? 'pending';
  const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.red : colors.accent;

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isIn ? '#0d2e1f' : '#2e0d0d' }]}>
        <Text style={{ fontSize: 16 }}>{isIn ? '↓' : '↑'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txType}>{tx.transaction_type?.replace(/_/g, ' ') ?? '—'}</Text>
        <Text style={styles.txDate}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.txAmount, { color }]}>
          {sign}${Math.abs(tx.amount_usdt ?? 0).toFixed(2)}
        </Text>
        <Text style={[styles.txStatus, { color: statusColor }]}>{status}</Text>
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.headerTitle}>Wallet</Text>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.balanceSub}>USDT</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {[
            { label: 'Deposit', icon: '↓', type: 'deposit' as ModalType, color: colors.green },
            { label: 'Withdraw', icon: '↑', type: 'withdraw' as ModalType, color: colors.red },
            { label: 'P2P Send', icon: '→', type: 'p2p' as ModalType, color: colors.accent },
          ].map(a => (
            <TouchableOpacity key={a.type} style={styles.actionBtn} onPress={() => openModal(a.type)}>
              <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
                <Text style={[styles.actionIconText, { color: a.color }]}>{a.icon}</Text>
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {transactions.length === 0
            ? <Text style={styles.empty}>No transactions yet</Text>
            : transactions.slice(0, 20).map((tx, i) => <TxRow key={i} tx={tx} />)
          }
        </View>
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
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
            <Text style={styles.inputLabel}>Wallet Address (TRC20)</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="T..." placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleWithdraw} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.confirmBtnText}>Submit</Text>}
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
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
            <Text style={styles.inputLabel}>Recipient Email</Text>
            <TextInput style={styles.input} value={recipientEmail} onChangeText={setRecipientEmail} placeholder="friend@example.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleP2P} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.confirmBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  balanceCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  balanceLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  balanceValue: { fontSize: 36, fontWeight: '700', color: colors.text },
  balanceSub: { fontSize: font.sm, color: colors.textMuted, marginTop: 4 },

  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  actionIconText: { fontSize: 22, fontWeight: '700' },
  actionLabel: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },

  section: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txType: { fontSize: font.sm, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  txDate: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: font.md, fontWeight: '700' },
  txStatus: { fontSize: font.xs, textTransform: 'capitalize', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  inputLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: font.md, marginBottom: spacing.md,
  },
  depositNote: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  depositAddressBox: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  depositNetwork: { fontSize: font.xs, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  depositAddress: { fontSize: font.sm, color: colors.text, fontFamily: 'monospace' },
  depositMeta: { fontSize: font.xs, color: colors.textMuted, marginBottom: spacing.md },
  closeBtn: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { color: colors.text, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  confirmBtnText: { color: colors.bg, fontWeight: '700' },
});
