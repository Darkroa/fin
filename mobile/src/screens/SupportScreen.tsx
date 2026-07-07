import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';
import {
  getSupportTickets,
  createSupportTicket,
  getTicketMessages,
  replyToTicket,
} from '../lib/api';

type Priority = 'normal' | 'high' | 'urgent';

interface Ticket {
  id: number | string;
  subject: string;
  status: string;
  priority?: string;
  createdAt?: string;
  created_at?: string;
}

interface Message {
  id: number | string;
  message: string;
  isAdmin?: boolean;
  is_admin?: boolean;
  createdAt?: string;
  created_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: colors.textSecondary,
  in_progress: colors.accent,
  resolved: colors.green,
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export default function SupportScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New ticket form
  const [showNewForm, setShowNewForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [submitting, setSubmitting] = useState(false);

  // Ticket detail
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await getSupportTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (_) {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchTickets();
      setLoading(false);
    })();
  }, [fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both subject and message.');
      return;
    }
    setSubmitting(true);
    try {
      await createSupportTicket({ subject: subject.trim(), message: message.trim(), priority });
      setSubject('');
      setMessage('');
      setPriority('normal');
      setShowNewForm(false);
      await fetchTickets();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create ticket.');
    }
    setSubmitting(false);
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessagesLoading(true);
    try {
      const data = await getTicketMessages(Number(ticket.id));
      setMessages(Array.isArray(data) ? data : []);
    } catch (_) {
      setMessages([]);
    }
    setMessagesLoading(false);
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      await replyToTicket(Number(selectedTicket.id), reply.trim());
      setReply('');
      const data = await getTicketMessages(Number(selectedTicket.id));
      setMessages(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send reply.');
    }
    setSendingReply(false);
  };

  const formatDate = (ticket: Ticket) => {
    const raw = ticket.createdAt ?? ticket.created_at;
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleDateString();
    } catch {
      return '';
    }
  };

  const formatMsgDate = (msg: Message) => {
    const raw = msg.createdAt ?? msg.created_at;
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ── Ticket Detail View ──────────────────────────────────────────────────────
  if (selectedTicket) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Detail Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setSelectedTicket(null);
              setMessages([]);
            }}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Tickets</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.detailTitleRow}>
          <Text style={styles.detailSubject} numberOfLines={2}>
            {selectedTicket.subject}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { borderColor: STATUS_COLORS[selectedTicket.status] ?? colors.textSecondary },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: STATUS_COLORS[selectedTicket.status] ?? colors.textSecondary },
              ]}
            >
              {STATUS_LABELS[selectedTicket.status] ?? selectedTicket.status}
            </Text>
          </View>
        </View>

        {/* Messages */}
        {messagesLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <ScrollView
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.length === 0 && (
              <Text style={styles.emptyText}>No messages yet.</Text>
            )}
            {messages.map((msg) => {
              const isAdmin = msg.isAdmin ?? msg.is_admin ?? false;
              return (
                <View
                  key={String(msg.id)}
                  style={[
                    styles.messageBubbleWrap,
                    isAdmin ? styles.adminWrap : styles.userWrap,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isAdmin ? styles.adminBubble : styles.userBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isAdmin ? styles.adminText : styles.userText,
                      ]}
                    >
                      {msg.message}
                    </Text>
                    <Text style={styles.msgTime}>{formatMsgDate(msg)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Reply Input */}
        <View style={styles.replyRow}>
          <TextInput
            style={styles.replyInput}
            value={reply}
            onChangeText={setReply}
            placeholder="Type a reply…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!reply.trim() || sendingReply) && styles.sendBtnDisabled]}
            onPress={handleSendReply}
            disabled={!reply.trim() || sendingReply}
            activeOpacity={0.8}
          >
            {sendingReply ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Main List View ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Support</Text>
        <TouchableOpacity
          style={styles.newTicketBtn}
          onPress={() => setShowNewForm(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.newTicketText}>{showNewForm ? 'Cancel' : 'New Ticket'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* New Ticket Form */}
        {showNewForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Support Ticket</Text>

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of your issue"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['normal', 'high', 'urgent'] as Priority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    priority === p && styles.priorityChipActive,
                  ]}
                  onPress={() => setPriority(p)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      priority === p && styles.priorityChipTextActive,
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue in detail…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitTicket}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Ticket</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Ticket List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No tickets yet.</Text>
            <Text style={styles.emptySubText}>
              Tap "New Ticket" to contact support.
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => {
            const statusColor =
              STATUS_COLORS[ticket.status] ?? colors.textSecondary;
            const statusLabel =
              STATUS_LABELS[ticket.status] ?? ticket.status;
            return (
              <TouchableOpacity
                key={String(ticket.id)}
                style={styles.ticketRow}
                onPress={() => handleSelectTicket(ticket)}
                activeOpacity={0.7}
              >
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  <Text style={styles.ticketDate}>{formatDate(ticket)}</Text>
                </View>
                <View style={styles.ticketRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      { borderColor: statusColor },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: statusColor }]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  newTicketBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  newTicketText: {
    color: colors.bg,
    fontSize: font.sm,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    paddingTop: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.md,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptySubText: {
    color: colors.textMuted,
    fontSize: font.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Form
  formCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  formTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    fontSize: font.md,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
  },
  priorityChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  priorityChipText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  priorityChipTextActive: {
    color: colors.bg,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.bg,
    fontSize: font.md,
    fontWeight: '700',
  },
  // Ticket rows
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  ticketInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  ticketSubject: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  ticketDate: {
    fontSize: font.xs,
    color: colors.textMuted,
  },
  ticketRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs + 2,
  },
  statusText: {
    fontSize: font.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: font.lg,
    color: colors.textSecondary,
    lineHeight: font.lg + 4,
  },
  // Detail view
  backBtn: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontSize: font.md,
    color: colors.accent,
    fontWeight: '600',
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  detailSubject: {
    flex: 1,
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageBubbleWrap: {
    marginBottom: spacing.sm,
  },
  adminWrap: {
    alignItems: 'flex-start',
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  adminBubble: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    backgroundColor: colors.accent,
  },
  messageText: {
    fontSize: font.md,
  },
  adminText: {
    color: colors.text,
  },
  userText: {
    color: colors.bg,
  },
  msgTime: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  replyInput: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    color: colors.text,
    fontSize: font.md,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: colors.bg,
    fontSize: font.sm,
    fontWeight: '700',
  },
});
