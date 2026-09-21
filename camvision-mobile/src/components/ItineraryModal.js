import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const DURATIONS = [
  { minutes: 30, labelKey: 'map.tourDur30' },
  { minutes: 60, labelKey: 'map.tourDur60' },
  { minutes: 120, labelKey: 'map.tourDur120' },
  { minutes: 240, labelKey: 'map.tourDur240' },
];

const THEMES = [
  { id: 'histoire', labelKey: 'map.filterHistory', icon: 'business-outline' },
  { id: 'nature', labelKey: 'map.filterNature', icon: 'leaf-outline' },
  { id: 'culture', labelKey: 'map.filterCulture', icon: 'color-palette-outline' },
  { id: 'gastronomie', labelKey: 'map.themeFood', icon: 'restaurant-outline' },
];

/**
 * Modal parcours IA — durée + thématiques (sans remplacer la nav mono-destination).
 */
export default function ItineraryModal({
  visible,
  colors,
  loading = false,
  onClose,
  onGenerate,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState(60);
  const [prefs, setPrefs] = useState(['histoire', 'culture']);

  const canSubmit = useMemo(() => !loading && duration >= 15, [loading, duration]);

  const togglePref = (id) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    setPrefs((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const submit = () => {
    if (!canSubmit) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onGenerate?.({
      max_duration_minutes: duration,
      preferences: prefs,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text }]}>{t('map.tourTitle')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('map.tourHint')}</Text>

          <Text style={[styles.section, { color: colors.text }]}>{t('map.tourDuration')}</Text>
          <View style={styles.rowWrap}>
            {DURATIONS.map((d) => {
              const active = duration === d.minutes;
              return (
                <TouchableOpacity
                  key={d.minutes}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.bg,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.selectionAsync().catch(() => {});
                    }
                    setDuration(d.minutes);
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {t(d.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.section, { color: colors.text }]}>{t('map.tourThemes')}</Text>
          <View style={styles.rowWrap}>
            {THEMES.map((theme) => {
              const active = prefs.includes(theme.id);
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.bg,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => togglePref(theme.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={theme.icon}
                    size={14}
                    color={active ? '#fff' : colors.primary}
                  />
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {t(theme.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 }]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.ctaText}>{t('map.tourGenerate')}</Text>
              </>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
      },
      android: { elevation: 10 },
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
    opacity: 0.6,
    marginBottom: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  section: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  cta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 50,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
