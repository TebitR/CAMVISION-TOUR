import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import LanguageSelector from '../components/LanguageSelector';
import { useTheme } from '../theme/ThemeContext';
import { clearNearbyCache } from '../services/nearbyCache';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const [clearing, setClearing] = useState(false);

  const themeOptions = [
    { id: 'light', label: t('profile.themeLight'), icon: 'sunny' },
    { id: 'dark', label: t('profile.themeDark'), icon: 'moon' },
    { id: 'system', label: t('profile.themeSystem'), icon: 'phone-portrait' },
  ];

  const version =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0';

  const onClearCache = () => {
    Alert.alert(t('profile.clearCacheTitle'), t('profile.clearCacheMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.clearCacheConfirm'),
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await clearNearbyCache();
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              ).catch(() => {});
            }
            Alert.alert(t('profile.clearCacheDone'));
          } catch (_) {
            Alert.alert(t('profile.clearCacheError'));
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 24,
          paddingBottom: 120 + Math.max(insets.bottom, 8),
        },
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

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.data')}</Text>
        <TouchableOpacity
          style={[styles.rowBtn, { borderColor: colors.border }]}
          onPress={onClearCache}
          disabled={clearing}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {t('profile.clearCache')}
            </Text>
            <Text style={[styles.rowSub, { color: colors.textMuted }]}>
              {t('profile.clearCacheHint')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.about')}</Text>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>
          {t('profile.aboutBody')}
        </Text>
        <Text style={[styles.version, { color: colors.textMuted }]}>
          {t('profile.version', { version })}
        </Text>
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
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  aboutText: { fontSize: 13, lineHeight: 20 },
  version: { fontSize: 12, fontWeight: '600', marginTop: 12 },
});
