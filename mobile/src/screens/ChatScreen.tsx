import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { chatWithAI } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'What is Bitcoin doing today?',
  'Analyze AAPL trendline',
  'Should I buy or sell ETH?',
  'Explain my portfolio risk',
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>⚡</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
          {msg.content}
        </Text>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant',
    content: "Hi! I'm Fin, your AI trading assistant. Ask me about markets, trading strategies, portfolio analysis, or any financial questions.",
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await chatWithAI(trimmed, history);
      const reply = res.data?.response ?? res.data?.message ?? 'I could not process that request.';
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail ?? 'Network error. Please try again.';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date() }]);
    } finally { setLoading(false); }
  }, [messages, loading]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>⚡</Text>
        </View>
        <View>
          <Text style={styles.headerName}>Fin AI</Text>
          <View style={styles.headerOnline}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>Trading Intelligence · Online</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>⚡</Text>
          </View>
          <View style={styles.typingBubble}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.typingText}>Fin is thinking…</Text>
          </View>
        </View>
      )}

      {/* Suggestions */}
      {messages.length === 1 && (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Fin anything…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    ...shadow.accent,
  },
  headerAvatarText: { fontSize: 20 },
  headerName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  headerOnline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  headerSub: { fontSize: font.xs, color: colors.textSecondary },

  messageList: { padding: spacing.md, paddingBottom: spacing.sm },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-end', gap: spacing.xs },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  botAvatar: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  botAvatarText: { fontSize: 14 },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, padding: 12 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: font.sm, lineHeight: 20 },
  bubbleTextUser: { color: '#000' },
  bubbleTextAI: { color: colors.text },
  bubbleTime: { fontSize: 10, color: 'rgba(0,0,0,0.45)', marginTop: 5, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: 'rgba(0,0,0,0.45)' },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  typingText: { fontSize: font.xs, color: colors.textSecondary },

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  suggestionChip: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  suggestionText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '500' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.xl,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    color: colors.text, fontSize: font.sm, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    ...shadow.accent,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#000', fontSize: font.lg, fontWeight: '700' },
});
