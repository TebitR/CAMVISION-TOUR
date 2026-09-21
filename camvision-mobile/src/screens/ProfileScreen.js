import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { useTheme } from '../theme/ThemeContext';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();

  const themeOptions = [
    { id: 'light', label: t('profile.themeLight'), icon: 'sunny' },
    { id: 'dark', label: t('profile.themeDark'), icon: 'moon' },
    { id: 'system', label: t('profile.themeSystem'), icon: 'phone-portrait' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="person" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('profile.subtitle')}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.language')}</Text>
        <LanguageSelector />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.theme')}</Text>
        <View style={[styles.segment, { backgroundColor: colors.primarySoft }]}>
          {themeOptions.map((opt) => {
            const active = mode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: colors.primary },
                ]}
                onPress={() => setMode(opt.id)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={active ? '#fff' : colors.text}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? '#fff' : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', marginTop: 16 },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  section: {
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 14,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 11,
    minHeight: 44,
  },
  segmentLabel: { fontWeight: '700', fontSize: 11 },
});
