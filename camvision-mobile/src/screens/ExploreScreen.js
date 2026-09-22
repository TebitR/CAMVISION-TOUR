import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { resolveAppLanguage } from '../i18n';
import { getApiUrl } from '../config';
import { monumentImageSource } from '../utils/imageUtils';
import MapMonumentSheet from '../components/MapMonumentSheet';

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const lang = resolveAppLanguage(i18n.language);

  const [query, setQuery] = useState('');
  const [monuments, setMonuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const fetchCatalog = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${getApiUrl()}/api/monuments`, {
          params: { lang, limit: 80, light: true },
          timeout: 15000,
        });
        setMonuments(data.monuments || []);
      } catch (e) {
        console.warn('catalog:', e?.message || e);
        setError(t('explore.loadError'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [lang, t]
  );

  useEffect(() => {
    if (!isFocused) return;
    fetchCatalog();
  }, [isFocused, fetchCatalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return monuments;
    return monuments.filter((m) => {
      const blob = `${m.title || ''} ${m.city || ''} ${m.region || ''} ${m.category || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [monuments, query]);

  const openMonument = (m) => {
    Keyboard.dismiss();
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelected(m);
  };

  const clearSearch = () => setQuery('');

  const renderItem = ({ item }) => {
    const place = [item.city, item.region].filter(Boolean).join(', ');
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => openMonument(item)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Image
          source={monumentImageSource(item.image_url)}
          style={styles.thumb}
          resizeMode="cover"
        />
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {!!place && (
            <Text style={[styles.cardPlace, { color: colors.textMuted }]} numberOfLines={1}>
              {place}
            </Text>
          )}
          {item.audio_available ? (
            <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="headset" size={12} color={colors.primary} />
              <Text style={[styles.tagText, { color: colors.primary }]}>
                {t('explore.audioAvailable')}
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 16, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('explore.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('explore.subtitle')}</Text>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('explore.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {!!query && (
            <TouchableOpacity onPress={clearSearch} hitSlop={10} accessibilityRole="button">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && monuments.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('explore.loading')}</Text>
        </View>
      ) : error && monuments.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.hint, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchCatalog()}
          >
            <Text style={styles.retryText}>{t('explore.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 120 + Math.max(insets.bottom, 8) },
            filtered.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchCatalog({ silent: true });
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('explore.emptyTitle')}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {t('explore.emptySub')}
              </Text>
              {!!query && (
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={clearSearch}
                >
                  <Text style={styles.retryText}>{t('explore.clearSearch')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      {selected && (
        <MapMonumentSheet
          monument={selected}
          colors={colors}
          apiUrl={getApiUrl()}
          language={lang}
          bottomInset={insets.bottom}
          onClose={() => setSelected(null)}
          onDirections={() => {
            setSelected(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 2 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  cardPlace: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
