import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGE_OPTIONS } from '../i18n';
import { LANG_STORAGE_KEY, ONBOARDING_DONE_KEY } from '../screens/OnboardingScreen';
import { useTheme } from '../theme/ThemeContext';
import { storageSet } from '../utils/safeStorage';

/** Liste radio de langues — sélection dynamique. */
export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const active = String(i18n.language || 'fr').toLowerCase().split('-')[0];

  const changeAppLanguage = async (langCode) => {
    await i18n.changeLanguage(langCode);
    await storageSet(LANG_STORAGE_KEY, langCode);
    await storageSet(ONBOARDING_DONE_KEY, '1');
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {LANGUAGE_OPTIONS.map((lang) => {
        const selected = active === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => changeAppLanguage(lang.code)}
            style={[
              styles.row,
              {
                backgroundColor: colors.card,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={styles.flag}>{lang.flag}</Text>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {t(lang.labelKey)}
            </Text>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selected ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: 8,
  },
  wrapCompact: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  flag: { fontSize: 20, marginRight: 12 },
  label: { flex: 1, fontWeight: '700', fontSize: 15 },
});
