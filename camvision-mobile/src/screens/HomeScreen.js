import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const go = (route) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    navigation.navigate(route);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + 16, paddingBottom: 110 + Math.max(insets.bottom, 8) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.textMuted }]}>{t('home.greeting')}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{t('home.title')}</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.scanBanner,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => go('Scan')}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t('home.scanTitle')}
      >
        <View style={styles.scanBannerText}>
          <View style={styles.badgeAi}>
            <Ionicons name="flash" size={14} color={colors.primary} />
            <Text style={[styles.badgeAiText, { color: colors.primary }]}>{t('home.aiBadge')}</Text>
          </View>
          <Text style={[styles.scanBannerTitle, { color: colors.text }]}>{t('home.scanTitle')}</Text>
          <Text style={[styles.scanBannerSub, { color: colors.textMuted }]}>{t('home.scanSub')}</Text>
        </View>
        <View style={[styles.scanIconBox, { backgroundColor: colors.primary }]}>
          <Ionicons name="camera" size={26} color="#ffffff" />
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.recommendations')}</Text>
        <View style={[styles.cardPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="map" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardText, { color: colors.text }]}>{t('home.emptyTitle')}</Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]}>{t('home.emptySub')}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.ctaRow, { backgroundColor: colors.primary }]}
          onPress={() => go('Carte')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('home.openMap')}
        >
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={styles.ctaText}>{t('home.openMap')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20 },
  header: { marginBottom: 22 },
  greeting: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  scanBanner: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    minHeight: 88,
  },
  scanBannerText: { flex: 1, marginRight: 12 },
  badgeAi: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badgeAiText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  scanBannerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  scanBannerSub: { fontSize: 13, lineHeight: 18 },
  scanIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  cardPlaceholder: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardText: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardSub: { fontSize: 13, lineHeight: 18 },
  ctaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
