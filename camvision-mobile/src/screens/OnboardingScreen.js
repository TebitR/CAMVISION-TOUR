import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LANGUAGE_OPTIONS } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { storageSet } from '../utils/safeStorage';

export const LANG_STORAGE_KEY = '@camvision_language';
export const ONBOARDING_DONE_KEY = '@camvision_onboarding_done';

export default function OnboardingScreen({ onDone }) {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(
    String(i18n.language || 'fr').split('-')[0]
  );

  const confirm = async () => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await i18n.changeLanguage(selected);
    await storageSet(LANG_STORAGE_KEY, selected);
    await storageSet(ONBOARDING_DONE_KEY, '1');
    onDone?.(selected);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t('onboarding.subtitle')}
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {LANGUAGE_OPTIONS.map((lang) => {
          const active = selected === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.row,
                Platform.OS === 'android' && styles.rowAndroid,
                {
                  backgroundColor: colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => setSelected(lang.code)}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <Text style={[styles.label, { color: colors.text }]}>{t(lang.labelKey)}</Text>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.cta,
          Platform.OS === 'android' && styles.ctaAndroid,
          { backgroundColor: colors.accent },
        ]}
        onPress={confirm}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.continue')}
      >
        <Text style={styles.ctaText}>{t('onboarding.continue')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  rowAndroid: {
    borderRadius: 10,
    elevation: 1,
  },
  flag: { fontSize: 22, marginRight: 14 },
  label: { fontSize: 17, fontWeight: '700', flex: 1 },
  cta: {
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  ctaAndroid: {
    borderRadius: 10,
    elevation: 3,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
