import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

export default function ExploreScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const go = (route) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    navigation.navigate(route);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + 24,
          paddingBottom: 120 + Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="compass" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('explore.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('explore.subtitle')}</Text>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: colors.primary }]}
        onPress={() => go('Carte')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('explore.openMap')}
      >
        <Ionicons name="map" size={18} color="#fff" />
        <Text style={styles.ctaText}>{t('explore.openMap')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.ctaSecondary, { borderColor: colors.primary }]}
        onPress={() => go('Scan')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('explore.openScan')}
      >
        <Ionicons name="scan" size={18} color={colors.primary} />
        <Text style={[styles.ctaSecondaryText, { color: colors.primary }]}>
          {t('explore.openScan')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', marginTop: 16 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, marginBottom: 24 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    minHeight: 48,
    minWidth: 220,
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ctaSecondary: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 48,
    minWidth: 220,
    justifyContent: 'center',
  },
  ctaSecondaryText: { fontWeight: '800', fontSize: 15 },
});
