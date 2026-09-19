import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{t('home.greeting')}</Text>
        <Text style={styles.title}>{t('home.title')}</Text>
      </View>

      <TouchableOpacity
        style={styles.scanBanner}
        onPress={() => navigation.navigate('Scan')}
        activeOpacity={0.9}
      >
        <View style={styles.scanBannerText}>
          <View style={styles.badgeAi}>
            <Ionicons name="flash" size={14} color="#059669" />
            <Text style={styles.badgeAiText}>{t('home.aiBadge')}</Text>
          </View>
          <Text style={styles.scanBannerTitle}>{t('home.scanTitle')}</Text>
          <Text style={styles.scanBannerSub}>{t('home.scanSub')}</Text>
        </View>
        <View style={styles.scanIconBox}>
          <Ionicons name="camera" size={26} color="#ffffff" />
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.recommendations')}</Text>
        <View style={styles.cardPlaceholder}>
          <View style={styles.iconCircle}>
            <Ionicons name="location" size={20} color="#059669" />
          </View>
          <Text style={styles.cardText}>{t('home.loadingSites')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  contentContainer: { paddingHorizontal: 20 },
  header: { marginBottom: 22 },
  greeting: { color: '#64748b', fontSize: 14, marginBottom: 4, fontWeight: '500' },
  title: { color: '#0f172a', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  scanBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    marginBottom: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  scanBannerText: { flex: 1, marginRight: 12 },
  badgeAi: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badgeAiText: { color: '#059669', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  scanBannerTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  scanBannerSub: { color: '#64748b', fontSize: 13, lineHeight: 18 },
  scanIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  cardPlaceholder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardText: { color: '#64748b', fontSize: 13, flex: 1 },
});
