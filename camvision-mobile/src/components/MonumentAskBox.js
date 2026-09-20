import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

/**
 * Chat RAG : question touriste → /api/rag/ask → bulle + callback TTS.
 */
export default function MonumentAskBox({
  apiUrl,
  monumentId,
  language,
  onAnswerAudio,
  onInputFocus,
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  const send = async () => {
    const q = query.trim();
    if (!q || !monumentId || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setQuery('');
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${apiUrl}/api/rag/ask`,
        { monument_id: monumentId, query: q, language },
        { timeout: 90000 }
      );
      const answer = data?.answer || t('scan.askError');
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
      if (answer && onAnswerAudio) {
        onAnswerAudio(answer);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: t('scan.askError') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.modalText }]}>{t('scan.askTitle')}</Text>

      {messages.length > 0 && (
        <ScrollView style={styles.thread} nestedScrollEnabled>
          {messages.map((m, i) => (
            <View
              key={`${m.role}-${i}`}
              style={[
                styles.bubble,
                m.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: colors.bubbleUser }
                  : { alignSelf: 'flex-start', backgroundColor: 'rgba(148,163,184,0.22)' },
              ]}
            >
              <Text style={styles.bubbleText}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {loading && (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color="#6ee7b7" />
          <Text style={styles.thinkingText}>{t('scan.askThinking')}</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="mic-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            placeholder={t('scan.askPlaceholder')}
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            editable={!loading}
            onSubmitEditing={send}
            returnKeyType="send"
            onFocus={() => onInputFocus?.()}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, (!query.trim() || loading) && styles.sendDisabled]}
          onPress={send}
          disabled={!query.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  thread: { maxHeight: 180, marginBottom: 10 },
  bubble: {
    maxWidth: '88%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  bubbleText: { color: '#f8fafc', fontSize: 13, lineHeight: 19 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  thinkingText: { color: '#94a3b8', fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
});
