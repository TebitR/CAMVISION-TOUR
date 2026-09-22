import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CAROUSEL_W = SCREEN_W - 40;
const AUTO_MS = 4000;

const SLIDES = [
  {
    id: 'reunification',
    titleKey: 'home.slide1Title',
    subKey: 'home.slide1Sub',
    image: require('../../assets/images/home/monument_reunification.jpg'),
  },
  {
    id: 'musee',
    titleKey: 'home.slide2Title',
    subKey: 'home.slide2Sub',
    image: require('../../assets/images/home/musee_national.png'),
  },
  {
    id: 'atangana',
    titleKey: 'home.slide3Title',
    subKey: 'home.slide3Sub',
    image: require('../../assets/images/home/atangana.png'),
  },
  {
    id: 'morts',
    titleKey: 'home.slide4Title',
    subKey: 'home.slide4Sub',
    image: require('../../assets/images/home/monument_morts.png'),
  },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const next = (indexRef.current + 1) % SLIDES.length;
      indexRef.current = next;
      setIndex(next);
      try {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      } catch (_) {}
    }, AUTO_MS);
    return () => clearInterval(id);
  }, []);

  const go = (route) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    navigation.navigate(route);
  };

  const onScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / CAROUSEL_W);
    if (i >= 0 && i < SLIDES.length) {
      indexRef.current = i;
      setIndex(i);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 16,
          paddingBottom: 110 + Math.max(insets.bottom, 8),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.badgeRow}>
        <Text style={styles.flag}>{'🇨🇲'}</Text>
        <Text style={[styles.badge, { color: colors.primary }]}>CAMVISION TOUR</Text>
      </View>

      <Text style={[styles.welcome, { color: colors.text }]}>{t('home.welcomeTitle')}</Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>{t('home.welcomeBody')}</Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.carouselTitle')}</Text>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({
          length: CAROUSEL_W,
          offset: CAROUSEL_W * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.slide,
              {
                width: CAROUSEL_W,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Image source={item.image} style={styles.slideImage} resizeMode="cover" />
            <View style={styles.slideCopy}>
              <Text style={[styles.slideTitle, { color: colors.text }]} numberOfLines={2}>
                {t(item.titleKey)}
              </Text>
              <Text style={[styles.slideSub, { color: colors.textMuted }]} numberOfLines={2}>
                {t(item.subKey)}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.dot,
              {
                backgroundColor: i === index ? colors.primary : colors.border,
                width: i === index ? 18 : 7,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>
        {t('home.quickActions')}
      </Text>

      <TouchableOpacity
        style={[styles.primaryAction, { backgroundColor: colors.primary }]}
        onPress={() => go('Scan')}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t('home.scanActionTitle')}
      >
        <View style={styles.actionIconBox}>
          <Ionicons name="scan" size={26} color="#fff" />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.primaryActionTitle}>{t('home.scanActionTitle')}</Text>
          <Text style={styles.primaryActionSub}>{t('home.scanActionSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.secondaryAction,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => go('Carte')}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t('home.mapActionTitle')}
      >
        <View style={[styles.actionIconBoxAlt, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="map" size={24} color={colors.primary} />
        </View>
        <View style={styles.actionText}>
          <Text style={[styles.secondaryActionTitle, { color: colors.text }]}>
            {t('home.mapActionTitle')}
          </Text>
          <Text style={[styles.secondaryActionSub, { color: colors.textMuted }]}>
            {t('home.mapActionSub')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  flag: { fontSize: 18 },
  badge: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  welcome: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginBottom: 10 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  slide: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  slideImage: { width: '100%', height: 168, backgroundColor: '#e2e8f0' },
  slideCopy: { padding: 14 },
  slideTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  slideSub: { fontSize: 13, lineHeight: 18 },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 20,
  },
  dot: { height: 7, borderRadius: 4 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    minHeight: 88,
    gap: 12,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBoxAlt: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  primaryActionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  primaryActionSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 17 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
    gap: 12,
  },
  secondaryActionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  secondaryActionSub: { fontSize: 12, lineHeight: 17 },
});
