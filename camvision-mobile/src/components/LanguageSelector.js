import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_OPTIONS } from '../i18n';

export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const active = String(i18n.language || 'fr').toLowerCase().split('-')[0];

  const changeAppLanguage = async (langCode) => {
    await i18n.changeLanguage(langCode);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {LANGUAGE_OPTIONS.map((lang) => {
        const selected = active === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => changeAppLanguage(lang.code)}
            style={[styles.chip, selected && styles.chipActive]}
            activeOpacity={0.85}
          >
            <Text style={styles.flag}>{lang.flag}</Text>
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
              {t(lang.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wrapCompact: {
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#047857',
  },
  flag: { fontSize: 14, marginRight: 6 },
  label: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
  labelActive: { color: '#ffffff' },
});
