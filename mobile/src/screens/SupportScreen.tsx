import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, SafeAreaView, Linking,
} from 'react-native';
import { createSupportTicket } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

const CATEGORIES = ['Technical Issue', 'Billing', 'Trading', 'Security', 'Bot Error', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const FAQS = [
  { q: 'How do I deposit funds?', a: 'Go to Wallet → Deposit. Send USDT to the provided TRC20 address.' },
  { q: 'How long do deposits take?', a: 'Deposits are credited after 1–6 blockchain confirmations, typically under 10 minutes.' },
  { q: 'How do I start a trading bot?', a: 'Go to Bots → New Bot. Enter the ticker, capital amount, and choose paper or live mode.' },
  { q: 'What leverage is available?', a: 'Leverage up to 25x is available on eligible pairs in the Trade screen.' },
  { q: 'How do withdrawals work?', a: 'Withdrawals are processed within 24 hours after admin approval. Min withdrawal is $20 USDT.' },
];

export default function SupportScreen() {
  const [subject, setSubject]           = useState('');
  const [description, setDescription]   = useState('');
  const [category, setCategory]         = useState(CATEGORIES[0]);
  const [priority, setPriority]         = useState<typeof PRIORITIES[number]>('Medium');
  const [submitting, setSubmitting]     = useState(false);
  const [expandedFaq, setExpandedFaq]   = useState<number | null>(null);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in subject and description.');
      return;
    }
    setSubmitting(true);
    try {
      await createSupportTicket({ subject: subject.trim(), message: description.trim(), priority: priority.toLowerCase() });
      Alert.alert('Ticket Submitted ✓', "Your support request was submitted. We'll respond within 24 hours.");
      setSubject(''); setDescription('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to submit ticket. Try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Quick contact row */}
        <Text style={styles.sectionHeader}>QUICK CONTACT</Text>
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('mailto:support@finai.app')}>
            <Text style={styles.contactIcon}>✉️</Text>
            <Text style={styles.contactLabel}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard} onPress={() => Alert.alert('Live Chat', 'Live chat coming soon.')}>
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactLabel}>Live Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard} onPress={() => Alert.alert('Telegram', 'Join our Telegram for updates.')}>
            <Text style={styles.contactIcon}>📱</Text>
            <Text style={styles.contactLabel}>Telegram</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionHeader}>FAQ</Text>
        <View style={styles.faqCard}>
          {FAQS.map((faq, i) => (
            <View key={i} style={[i < FAQS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.faqRow}
                onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
                activeOpacity={0.7}
              >
                <Text style={styles.faqQuestion} numberOfLines={expandedFaq === i ? undefined : 1}>{faq.q}</Text>
                <Text style={[styles.faqArrow, { transform: [{ rotate: expandedFaq === i ? '90deg' : '0deg' }] }]}>›</Text>
              </TouchableOpacity>
              {expandedFaq === i && (
                <Text style={styles.faqAnswer}>{faq.a}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Support ticket form */}
        <Text style={styles.sectionHeader}>SUBMIT A TICKET</Text>
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.formLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => {
              const colors2: Record<typeof PRIORITIES[number], string> = {
                Low: colors.green, Medium: colors.accent, High: '#f97316', Critical: colors.red
              };
              const c = colors2[p];
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, priority === p && { backgroundColor: c + '22', borderColor: c }]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.priorityText, priority === p && { color: c }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.formLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject} onChangeText={setSubject}
            placeholder="Brief description of your issue"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description} onChangeText={setDescription}
            placeholder="Provide as much detail as possible…"
            placeholderTextColor={colors.textMuted}
            multiline numberOfLines={6} textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.submitBtnText}>Submit Ticket</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing.sm, marginTop: spacing.md,
  },
  contactRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  contactCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    alignItems: 'center', gap: 8, ...shadow.card,
  },
  contactIcon: { fontSize: 24 },
  contactLabel: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },
  faqCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.sm, ...shadow.card,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  faqQuestion: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  faqArrow: { fontSize: font.xl, color: colors.textMuted },
  faqAnswer: { fontSize: font.sm, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingBottom: spacing.md, lineHeight: 20 },
  formCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card,
  },
  formLabel: { fontSize: font.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  chipRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000', fontWeight: '700' },
  priorityRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  priorityBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt,
  },
  priorityText: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.sm, marginBottom: spacing.xs,
  },
  textarea: { minHeight: 100, paddingTop: 13 },
  submitBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: spacing.md },
  submitBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
});
