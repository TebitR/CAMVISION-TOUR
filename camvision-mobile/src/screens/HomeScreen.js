import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Bonjour</Text>
        <Text style={styles.title}>Prêt à explorer le Cameroun ?</Text>
      </View>

      <TouchableOpacity
        style={styles.scanBanner}
        onPress={() => navigation.navigate('Scan')}
        activeOpacity={0.9}
      >
        <View style={styles.scanBannerText}>
          <View style={styles.badgeAi}>
            <Ionicons name="flash" size={14} color="#059669" />
            <Text style={styles.badgeAiText}>Reconnaissance IA</Text>
          </View>
          <Text style={styles.scanBannerTitle}>Scanner un objet ou monument</Text>
          <Text style={styles.scanBannerSub}>Pointez votre caméra pour découvrir son histoire</Text>
        </View>
        <View style={styles.scanIconBox}>
          <Ionicons name="camera" size={26} color="#ffffff" />
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommandations</Text>
        <View style={styles.cardPlaceholder}>
          <View style={styles.iconCircle}>
            <Ionicons name="location" size={20} color="#059669" />
          </View>
          <Text style={styles.cardText}>Chargement des sites phares de Yaoundé...</Text>
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
    borderRadius: 26,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { marginTop: 4 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  cardPlaceholder: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
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
  },
  cardText: { color: '#64748b', fontSize: 13, marginLeft: 12, flex: 1, lineHeight: 18 },
});
