import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Keyboard,
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
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  const send = async () => {
    const q = query.trim();
    if (!q || !monumentId || loading) return;
    Keyboard.dismiss();

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
        <ScrollView
          style={styles.thread}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {messages.map((m, i) => (
            <View
              key={`${m.role}-${i}`}
              style={[
                styles.bubble,
                m.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: colors.bubbleUser }
                  : {
                      alignSelf: 'flex-start',
                      backgroundColor: isDark
                        ? 'rgba(148,163,184,0.22)'
                        : 'rgba(15,23,42,0.06)',
                    },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  {
                    color:
                      m.role === 'user'
                        ? '#f8fafc'
                        : colors.modalText,
                  },
                ]}
              >
                {m.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {loading && (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.thinkingText, { color: colors.modalMuted }]}>
            {t('scan.askThinking')}
          </Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(15,23,42,0.05)',
              borderColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(15,23,42,0.1)',
            },
          ]}
        >
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={colors.modalMuted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={[styles.input, { color: colors.modalText }]}
            placeholder={t('scan.askPlaceholder')}
            placeholderTextColor={colors.modalMuted}
            value={query}
            onChangeText={setQuery}
            editable={!loading}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit
            accessibilityLabel={t('scan.askPlaceholder')}
            onFocus={() => onInputFocus?.()}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, (!query.trim() || loading) && styles.sendDisabled]}
          onPress={send}
          disabled={!query.trim() || loading}
          accessibilityRole="button"
          accessibilityLabel={t('scan.askTitle')}
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
  bubbleText: { fontSize: 13, lineHeight: 19 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  thinkingText: { fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
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
