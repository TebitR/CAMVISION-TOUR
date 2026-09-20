import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
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
        onPress={() => navigation.navigate('Scan')}
        activeOpacity={0.9}
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
            <Ionicons name="location" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.cardText, { color: colors.textMuted }]}>{t('home.loadingSites')}</Text>
        </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardText: { fontSize: 13, flex: 1 },
});
