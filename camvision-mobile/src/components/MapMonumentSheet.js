import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { monumentImageSource } from '../utils/imageUtils';
import { formatDistance } from '../services/locationService';
import { estimateWalkMinutes } from '../utils/mapCategories';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return global.btoa(binary);
}

async function resolvePlayableAudioUri(base64, preferredFileName) {
  const dataUri = `data:audio/mpeg;base64,${base64}`;
  if (!FileSystem.cacheDirectory || !preferredFileName) return dataUri;
  const fileUri = `${FileSystem.cacheDirectory}${preferredFileName}`;
  try {
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  } catch {
    return dataUri;
  }
}

function guideTextFromMonument(m) {
  if (!m) return '';
  return [m.explanation, m.history].filter(Boolean).join('\n\n');
}

/**
 * Fiche monument : Audio / Question en place (sans Scan),
 * les autres actions se rangent en tiroir latéral.
 */
export default function MapMonumentSheet({
  monument,
  colors,
  apiUrl,
  language = 'fr',
  bottomInset = 0,
  navLoading = false,
  autoStartAudio = false,
  onClose,
  onDirections,
  onAutoAudioConsumed,
}) {
  const { t } = useTranslation();
  const slide = useRef(new Animated.Value(320)).current;
  const drawer = useRef(new Animated.Value(0)).current;

  /** 'idle' | 'audio' | 'ask' */
  const [panel, setPanel] = useState('idle');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askMessages, setAskMessages] = useState([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const player = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(player);
  const audioUriRef = useRef(null);
  const genRef = useRef(0);

  const isPlaying = !!audioStatus?.playing;
  const progress =
    audioStatus?.duration > 0
      ? audioStatus.currentTime / audioStatus.duration
      : 0;

  const openDrawer = useCallback(() => {
    Animated.spring(drawer, {
      toValue: 1,
      useNativeDriver: false,
      friction: 8,
      tension: 60,
    }).start();
  }, [drawer]);

  const closeDrawer = useCallback(() => {
    Animated.spring(drawer, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
      tension: 60,
    }).start();
  }, [drawer]);

  const expandActions = useCallback(() => {
    Keyboard.dismiss();
    try {
      player.pause();
    } catch (_) {
      /* ignore */
    }
    setPanel('idle');
    closeDrawer();
  }, [player, closeDrawer]);

  const resetForMonument = useCallback(() => {
    genRef.current += 1;
    try {
      player.pause();
    } catch (_) {
      /* ignore */
    }
    audioUriRef.current = null;
    setAudioUri(null);
    setAudioLoading(false);
    setAskQuery('');
    setAskLoading(false);
    setAskMessages([]);
    setPanel('idle');
    drawer.setValue(0);
  }, [player, drawer]);

  useEffect(() => {
    if (!monument) return;
    resetForMonument();
    slide.setValue(320);
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 65,
    }).start();
  }, [monument?.id, resetForMonument, slide]);

  // Geofence / deep-link : démarrer l'audio sans ouvrir Scan
  useEffect(() => {
    if (!monument || !autoStartAudio) return;
    const t = setTimeout(() => {
      startAudioPanel();
      onAutoAudioConsumed?.();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monument?.id, autoStartAudio]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    };
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    if (panel !== 'ask') {
      Keyboard.dismiss();
    }
  }, [panel]);

  const playUri = async (uri) => {
    await setAudioModeAsync({ playsInSilentMode: true });
    player.replace({ uri });
    player.play();
  };

  const fetchAndPlayGuide = async () => {
    const text = guideTextFromMonument(monument);
    if (!text) {
      Alert.alert(t('map.actionAudio'), t('map.noAudioText'));
      return;
    }
    const gen = ++genRef.current;
    setAudioLoading(true);
    try {
      const response = await axios.post(
        `${apiUrl}/api/tts/generate`,
        { text },
        { responseType: 'arraybuffer', timeout: 60000 }
      );
      if (gen !== genRef.current) return;
      const base64 = arrayBufferToBase64(response.data);
      const uri = await resolvePlayableAudioUri(
        base64,
        `map_guide_${monument.id}_${Date.now()}.mp3`
      );
      if (gen !== genRef.current) return;
      audioUriRef.current = uri;
      setAudioUri(uri);
      await playUri(uri);
    } catch (e) {
      console.warn('Map TTS:', e?.message || e);
      Alert.alert(t('scan.errorAudio'), t('scan.errorAudioMsg'));
    } finally {
      if (gen === genRef.current) setAudioLoading(false);
    }
  };

  const startAudioPanel = async () => {
    setPanel('audio');
    openDrawer();
    if (audioUriRef.current) {
      await playUri(audioUriRef.current);
      return;
    }
    await fetchAndPlayGuide();
  };

  const togglePlayPause = async () => {
    if (audioLoading) return;
    if (!audioUriRef.current) {
      await fetchAndPlayGuide();
      return;
    }
    if (isPlaying) {
      player.pause();
    } else {
      // Relance depuis le début si terminé
      if (progress >= 0.98) {
        try {
          await player.seekTo(0);
        } catch (_) {
          /* ignore */
        }
      }
      player.play();
    }
  };

  const startAskPanel = () => {
    try {
      player.pause();
    } catch (_) {
      /* ignore */
    }
    setPanel('ask');
    openDrawer();
  };

  const sendAsk = async () => {
    const q = askQuery.trim();
    if (!q || !monument?.id || askLoading) return;
    setAskMessages((prev) => [...prev, { role: 'user', text: q }]);
    setAskQuery('');
    setAskLoading(true);
    try {
      const { data } = await axios.post(
        `${apiUrl}/api/rag/ask`,
        { monument_id: monument.id, query: q, language },
        { timeout: 90000 }
      );
      const answer = data?.answer || t('scan.askError');
      setAskMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setAskMessages((prev) => [
        ...prev,
        { role: 'assistant', text: t('scan.askError') },
      ]);
    } finally {
      setAskLoading(false);
    }
  };

  if (!monument) return null;

  const distKm =
    monument.distance_km ??
    (monument.distance_m != null ? monument.distance_m / 1000 : null);
  const walkMin = estimateWalkMinutes(
    monument.distance_m ?? (distKm != null ? distKm * 1000 : null)
  );

  const railWidth = drawer.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });
  const railOpacity = drawer.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });
  const mainFlex = drawer.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1],
  });

  const handleClose = () => {
    Keyboard.dismiss();
    resetForMonument();
    onClose?.();
  };

  const dockBottom = 78 + Math.min(bottomInset, 14);
  const sheetBottom =
    keyboardHeight > 0 ? Math.max(keyboardHeight + 8, 12) : dockBottom;
  const keyboardOpen = keyboardHeight > 0;
  const compactHeader = panel === 'ask' && keyboardOpen;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          bottom: sheetBottom,
          transform: [{ translateY: slide }],
          zIndex: keyboardOpen ? 40 : 20,
        },
      ]}
    >
      <TouchableOpacity style={styles.close} onPress={handleClose} hitSlop={12}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.handle} />

      <View style={styles.header}>
        {!compactHeader && (
          <Image
            source={monumentImageSource(monument.image_url)}
            style={styles.thumb}
            resizeMode="cover"
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={compactHeader ? 1 : 2}>
            {monument.title}
          </Text>
          {!compactHeader && (
            <>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {(monument.category || '').toUpperCase()}
                {monument.region ? ` · ${monument.region}` : ''}
              </Text>
              <Text style={[styles.distance, { color: colors.primary }]}>
                {formatDistance(distKm)}
                {walkMin != null ? ` · ${t('map.walkMinutes', { count: walkMin })}` : ''}
              </Text>
            </>
          )}
        </View>
      </View>

      {!!monument.explanation && panel === 'idle' && (
        <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>
          {monument.explanation}
        </Text>
      )}

      {/* Rangée d'actions : idle = 3 boutons ; audio/ask = tiroir + panneau */}
      <View style={styles.actionRow}>
        {panel === 'idle' ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={startAudioPanel}
              activeOpacity={0.85}
            >
              <Ionicons name="headset" size={16} color="#fff" />
              <Text style={styles.actionPrimaryText}>{t('map.actionAudio')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary, { borderColor: colors.primary }]}
              onPress={() => onDirections?.(monument)}
              disabled={navLoading}
              activeOpacity={0.85}
            >
              {navLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="navigate" size={16} color={colors.primary} />
                  <Text style={[styles.actionSecondaryText, { color: colors.primary }]}>
                    {t('map.actionGo')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary, { borderColor: colors.border }]}
              onPress={startAskPanel}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={16} color={colors.text} />
              <Text style={[styles.actionSecondaryText, { color: colors.text }]}>
                {t('map.actionAsk')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Tiroir latéral : options rangées */}
            <Animated.View
              style={[
                styles.rail,
                {
                  width: railWidth,
                  opacity: railOpacity,
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.railBtn}
                onPress={expandActions}
                accessibilityLabel={t('map.expandActions')}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>

              {panel === 'audio' ? (
                <>
                  <TouchableOpacity
                    style={styles.railBtn}
                    onPress={() => onDirections?.(monument)}
                    disabled={navLoading}
                  >
                    <Ionicons name="navigate" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.railBtn} onPress={startAskPanel}>
                    <Ionicons name="create-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.railBtn} onPress={startAudioPanel}>
                    <Ionicons name="headset" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.railBtn}
                    onPress={() => onDirections?.(monument)}
                    disabled={navLoading}
                  >
                    <Ionicons name="navigate" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>

            {/* Panneau principal Audio */}
            {panel === 'audio' && (
              <Animated.View style={[styles.focusPanel, { flex: mainFlex, borderColor: colors.primary }]}>
                {audioLoading ? (
                  <View style={styles.audioBusy}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[styles.audioBusyText, { color: colors.textMuted }]}>
                      {t('map.audioPreparing')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.playBtn, { backgroundColor: colors.primary }]}
                      onPress={togglePlayPause}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={22}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <View style={styles.audioMeta}>
                      <Text style={[styles.audioLabel, { color: colors.text }]} numberOfLines={1}>
                        {isPlaying ? t('map.audioPlaying') : t('map.audioReady')}
                      </Text>
                      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: colors.primary,
                              width: `${Math.round(Math.min(1, progress) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.expandIcon}
                      onPress={expandActions}
                      hitSlop={10}
                    >
                      <Ionicons name="options-outline" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            )}

            {/* Panneau principal Question */}
            {panel === 'ask' && (
              <Animated.View style={[styles.focusPanelAsk, { flex: mainFlex, borderColor: colors.border }]}>
                {askMessages.length > 0 && (
                  <ScrollView
                    style={[styles.askThread, keyboardOpen && styles.askThreadCompact]}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {askMessages.slice(-6).map((m, i) => (
                      <View
                        key={`${m.role}-${i}`}
                        style={[
                          styles.askBubble,
                          m.role === 'user'
                            ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
                            : { alignSelf: 'flex-start', backgroundColor: colors.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.askBubbleText,
                            { color: m.role === 'user' ? '#fff' : colors.text },
                          ]}
                        >
                          {m.text}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                {askLoading && (
                  <View style={styles.askThinking}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                      {t('scan.askThinking')}
                    </Text>
                  </View>
                )}
                <View style={styles.askInputRow}>
                  <TextInput
                    style={[
                      styles.askInput,
                      {
                        color: colors.text,
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder={t('scan.askPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={askQuery}
                    onChangeText={setAskQuery}
                    editable={!askLoading}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    blurOnSubmit={false}
                  />
                  <View style={styles.askSideBtns}>
                    <TouchableOpacity
                      style={[
                        styles.askSend,
                        { backgroundColor: colors.primary },
                        (!askQuery.trim() || askLoading) && { opacity: 0.45 },
                      ]}
                      onPress={sendAsk}
                      disabled={!askQuery.trim() || askLoading}
                    >
                      <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.expandIcon} onPress={expandActions} hitSlop={8}>
                      <Ionicons name="options-outline" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingTop: 10,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    marginBottom: 10,
  },
  close: { position: 'absolute', right: 10, top: 10, zIndex: 2, padding: 4 },
  header: { flexDirection: 'row', gap: 12, paddingRight: 24 },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#e2e8f0' },
  title: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  distance: { fontSize: 13, marginTop: 6, fontWeight: '700' },
  desc: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 14,
    minHeight: 48,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderRadius: 12,
    minHeight: 42,
  },
  actionSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  actionPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  actionSecondaryText: { fontWeight: '800', fontSize: 11 },
  rail: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    gap: 2,
  },
  railBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusPanel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 56,
  },
  focusPanelAsk: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
    minHeight: 140,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioMeta: { flex: 1, gap: 6 },
  audioLabel: { fontSize: 12, fontWeight: '700' },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  expandIcon: {
    padding: 4,
  },
  audioBusy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  audioBusyText: { fontSize: 12, fontWeight: '600' },
  askThread: { maxHeight: 150 },
  askThreadCompact: { maxHeight: 88 },
  askBubble: {
    maxWidth: '94%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  askBubbleText: { fontSize: 14, lineHeight: 20 },
  askThinking: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  askInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  askInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 88,
    maxHeight: 130,
  },
  askSideBtns: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 2,
  },
  askSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
