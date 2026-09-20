import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { resolveAppLanguage } from '../i18n';
import SoundWave from '../components/SoundWave';
import MonumentAskBox from '../components/MonumentAskBox';
import { useTheme } from '../theme/ThemeContext';

const debuggerHost =
  Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.developer?.tool;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:8000`;
const CONFIDENCE_THRESHOLD = 0.6;

/** Invites vocales embarquées (0 ms — aucun réseau). */
const LOCAL_PROMPT_ASSETS = {
  fr: require('../../assets/audio/prompt_fr.mp3'),
  en: require('../../assets/audio/prompt_en.mp3'),
  es: require('../../assets/audio/prompt_es.mp3'),
  de: require('../../assets/audio/prompt_de.mp3'),
  zh: require('../../assets/audio/prompt_zh.mp3'),
  ar: require('../../assets/audio/prompt_ar.mp3'),
};

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return global.btoa(binary);
}

/** URI jouable : fichier cache si possible, sinon data URI (disque plein). */
async function resolvePlayableAudioUri(base64, preferredFileName) {
  const dataUri = `data:audio/mpeg;base64,${base64}`;
  if (!FileSystem.cacheDirectory || !preferredFileName) return dataUri;
  const fileUri = `${FileSystem.cacheDirectory}${preferredFileName}`;
  try {
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  } catch (e) {
    console.warn('Cache audio indisponible (disque plein?) → lecture mémoire');
    return dataUri;
  }
}

function guideTextFromArtifact(artifact) {
  if (!artifact) return '';
  return [artifact.explanation, artifact.history, artifact.anecdotes]
    .filter(Boolean)
    .join('\n\n');
}

export default function ScanScreen() {
  const { t, i18n } = useTranslation();
  const userLanguage = resolveAppLanguage(i18n.language);
  const { colors, isDark } = useTheme();

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabClearance = 72 + Math.min(insets.bottom, 14);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(true);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [score, setScore] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showInviteBanner, setShowInviteBanner] = useState(false);
  const [mainAudioUri, setMainAudioUri] = useState(null);
  const [isWaitingForPrefetch, setIsWaitingForPrefetch] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const player = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(player);
  const modalScrollRef = useRef(null);

  const isAnalyzingRef = useRef(false);
  const audioRoleRef = useRef(null); // 'prompt' | 'guide'
  const promptStartedForIdRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const analysisRef = useRef(null);
  const langRef = useRef(userLanguage);
  const mainAudioUriRef = useRef(null);
  const waitingForPrefetchRef = useRef(false);
  const prefetchGenRef = useRef(0);
  const scanPulse = useRef(new Animated.Value(0.4)).current;
  const micPulse = useRef(new Animated.Value(0.35)).current;

  analysisRef.current = analysisResult;
  langRef.current = userLanguage;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(scanPulse, { toValue: 0.35, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    if (isLiveScanning && isFocused) loop.start();
    return () => loop.stop();
  }, [isLiveScanning, isFocused, scanPulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 0.3, duration: 550, useNativeDriver: true }),
      ])
    );
    if (isListening) loop.start();
    else micPulse.setValue(0.35);
    return () => loop.stop();
  }, [isListening, micPulse]);

  useEffect(() => {
    let interval = null;
    if (isFocused && isLiveScanning && cameraRef && !modalVisible) {
      const kickoff = setTimeout(() => captureAndAnalyzeLive(), 700);
      interval = setInterval(() => captureAndAnalyzeLive(), 2500);
      return () => {
        clearTimeout(kickoff);
        if (interval) clearInterval(interval);
      };
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFocused, cameraRef, isLiveScanning, modalVisible]);

  useEffect(() => {
    if (audioStatus.duration > 0) {
      setAudioProgress(audioStatus.currentTime / audioStatus.duration);
    }
    setIsPlaying(!!audioStatus.playing);

    if (audioStatus.didJustFinish) {
      setIsPlaying(false);
      setAudioProgress(0);
      audioRoleRef.current = null;
    }
  }, [audioStatus]);

  // Après un scan réussi : bannière + invite locale + prefetch guide en parallèle
  useEffect(() => {
    if (!modalVisible || !analysisResult?.id) return;
    if (promptStartedForIdRef.current === analysisResult.id) return;
    promptStartedForIdRef.current = analysisResult.id;
    handlePostScanInteractivePrompt();
  }, [modalVisible, analysisResult?.id]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const scrollAskIntoView = () => {
    setTimeout(() => {
      modalScrollRef.current?.scrollToEnd?.({ animated: true });
    }, 80);
  };

  const hideInviteBanner = () => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setShowInviteBanner(false);
    setIsListening(false);
  };

  const playGuideFromUri = async (uri) => {
    await setAudioModeAsync({ playsInSilentMode: true });
    audioRoleRef.current = 'guide';
    player.replace({ uri });
    player.play();
    setIsPlaying(true);
    setAudioReady(true);
    setLoadingAudio(false);
    setIsWaitingForPrefetch(false);
  };

  /** Prefetch guide TTS — mémoire d'abord ; fichier optionnel si l'espace le permet. */
  const prefetchMainAudio = async (text) => {
    if (!text) return;
    const gen = prefetchGenRef.current;
    const lang = langRef.current || 'fr';

    try {
      const response = await axios.post(
        `${API_URL}/api/tts/generate`,
        { text },
        { responseType: 'arraybuffer', timeout: 60000 }
      );
      if (gen !== prefetchGenRef.current) return;

      const base64 = arrayBufferToBase64(response.data);
      const playUri = await resolvePlayableAudioUri(
        base64,
        `monument_description_${lang}.mp3`
      );
      if (gen !== prefetchGenRef.current) return;

      mainAudioUriRef.current = playUri;
      setMainAudioUri(playUri);
      setAudioReady(true);

      if (waitingForPrefetchRef.current) {
        waitingForPrefetchRef.current = false;
        await playGuideFromUri(playUri);
      }
    } catch (error) {
      console.error('Prefetch guide vocal :', error?.response?.status || error.message);
      if (waitingForPrefetchRef.current && gen === prefetchGenRef.current) {
        waitingForPrefetchRef.current = false;
        setIsWaitingForPrefetch(false);
        setLoadingAudio(false);
        Alert.alert(t('scan.errorAudio'), t('scan.errorAudioMsg'));
      }
    }
  };

  const handlePostScanInteractivePrompt = async () => {
    // Reset état audio du monument précédent
    prefetchGenRef.current += 1;
    mainAudioUriRef.current = null;
    setMainAudioUri(null);
    setAudioReady(false);
    waitingForPrefetchRef.current = false;
    setIsWaitingForPrefetch(false);
    setLoadingAudio(false);

    // 1) Bannière Oui / Non — reste affichée jusqu'à interaction (pas de timeout)
    setShowInviteBanner(true);
    setIsListening(true);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }

    // 3) Prefetch guide SANS await — parallèle à l'invite
    prefetchMainAudio(guideTextFromArtifact(analysisRef.current));

    // 2) Lecture invite locale (0 ms réseau)
    try {
      const lang = langRef.current || 'fr';
      const source = LOCAL_PROMPT_ASSETS[lang] || LOCAL_PROMPT_ASSETS.fr;
      await setAudioModeAsync({ playsInSilentMode: true });
      audioRoleRef.current = 'prompt';
      player.replace(source);
      player.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Erreur invite vocale locale :", error?.message || error);
    }
  };

  /** Oui : lecture instantanée si le prefetch est prêt, sinon attente du cache. */
  const handleConfirmPlay = async () => {
    hideInviteBanner();
    try {
      if (audioRoleRef.current === 'prompt') {
        player.pause();
        await player.seekTo(0);
      }
    } catch (_) {}

    const uri = mainAudioUriRef.current;
    if (uri) {
      await playGuideFromUri(uri);
      return;
    }

    waitingForPrefetchRef.current = true;
    setIsWaitingForPrefetch(true);
    setLoadingAudio(true);
  };

  const captureAndAnalyzeLive = async () => {
    if (isAnalyzingRef.current || !cameraRef || !isFocused || modalVisible) return;
    isAnalyzingRef.current = true;
    setScanning(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.5, skipProcessing: true });
      await sendImageToAnalyze(photo.uri, false);
    } catch (e) {
      console.log('Erreur live frame:', e);
    } finally {
      setScanning(false);
      isAnalyzingRef.current = false;
    }
  };

  const pickImage = async () => {
    setIsLiveScanning(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled) {
      setScanning(true);
      await sendImageToAnalyze(res.assets[0].uri, true);
      setScanning(false);
    } else {
      setIsLiveScanning(true);
    }
  };

  const sendImageToAnalyze = async (imageUri, isManual = false) => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'scan.jpg',
      type: 'image/jpeg',
    });
    formData.append('lang', langRef.current || 'fr');

    try {
      const response = await axios.post(`${API_URL}/api/vision/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      if (response.data.found && response.data.score >= CONFIDENCE_THRESHOLD) {
        setAnalysisResult(response.data.artifact);
        setScore(response.data.score);
        setIsLiveScanning(false);
        setModalVisible(true);
      } else if (isManual) {
        Alert.alert(t('scan.notRecognized'), t('scan.notRecognizedMsg'));
        setIsLiveScanning(true);
      }
    } catch (error) {
      if (isManual) {
        Alert.alert(t('scan.errorTitle'), t('scan.errorServer'));
        setIsLiveScanning(true);
      }
    }
  };

  const stopAudio = async () => {
    try {
      player.pause();
      await player.seekTo(0);
    } catch (_) {}
    audioRoleRef.current = null;
    setIsPlaying(false);
    setAudioProgress(0);
  };

  // Contrôle tactile Play / Pause (toujours disponible)
  const playElevenLabsAudio = async () => {
    if (!analysisResult?.explanation) return;

    try {
      if (showInviteBanner || isListening) hideInviteBanner();

      if (audioReady && mainAudioUriRef.current) {
        if (audioStatus.playing && audioRoleRef.current === 'guide') {
          player.pause();
          setIsPlaying(false);
        } else {
          await playGuideFromUri(mainAudioUriRef.current);
        }
        return;
      }

      await handleConfirmPlay();
    } catch (error) {
      console.error(error);
      Alert.alert(t('scan.errorAudio'), t('scan.errorAudioMsg'));
    }
  };

  const confirmYes = async () => {
    await handleConfirmPlay();
  };

  const confirmNo = async () => {
    hideInviteBanner();
    try {
      if (audioRoleRef.current === 'prompt') {
        player.pause();
        await player.seekTo(0);
      }
    } catch (_) {}
    audioRoleRef.current = null;
    setIsPlaying(false);
  };

  const playAnswerAudio = async (text) => {
    if (!text) return;
    try {
      setLoadingAudio(true);
      const response = await axios.post(
        `${API_URL}/api/tts/generate`,
        { text },
        { responseType: 'arraybuffer', timeout: 60000 }
      );
      const base64 = arrayBufferToBase64(response.data);
      const playUri = await resolvePlayableAudioUri(base64, `rag_answer_${Date.now()}.mp3`);
      await playGuideFromUri(playUri);
    } catch (e) {
      console.error('TTS réponse RAG:', e?.message || e);
    } finally {
      setLoadingAudio(false);
    }
  };

  const closeModal = async () => {
    hideInviteBanner();
    prefetchGenRef.current += 1;
    waitingForPrefetchRef.current = false;
    mainAudioUriRef.current = null;
    setMainAudioUri(null);
    setIsWaitingForPrefetch(false);
    setLoadingAudio(false);
    await stopAudio();
    setAudioReady(false);
    setModalVisible(false);
    setAnalysisResult(null);
    setScore(null);
    promptStartedForIdRef.current = null;
    setIsLiveScanning(true);
  };

  if (!permission) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;

  if (!permission.granted) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.textDark, { color: colors.text }]}>{t('scan.cameraPermission')}</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnTextLight}>{t('scan.allowCamera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const modalPadBottom = keyboardVisible
    ? Math.max(insets.bottom, 8)
    : Math.max(insets.bottom, 10);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b1220' : '#0f172a' }]}>
      {isFocused ? (
        <View style={styles.camera}>
          <CameraView style={StyleSheet.absoluteFill} ref={(ref) => setCameraRef(ref)} />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topRow}>
              <BlurView intensity={40} tint="dark" style={[styles.statusBadge, scanning && styles.statusBadgeActive]}>
                <ActivityIndicator size="small" color="#a7f3d0" style={{ marginRight: 8 }} />
                <Animated.Text style={[styles.statusText, { opacity: scanPulse }]}>
                  {scanning ? t('scan.analyzing') : t('scan.searching')}
                </Animated.Text>
              </BlurView>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.cameraPlaceholder, { backgroundColor: colors.bg }]}>
          <Text style={[styles.textDark, { color: colors.text }]}>{t('scan.cameraPaused')}</Text>
        </View>
      )}

      {scanning && (
        <BlurView intensity={45} tint="dark" style={[styles.scanningCard, { bottom: tabClearance + 70 }]}>
          <View style={styles.glassInner}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.scanningTitle}>{t('scan.scanning')}</Text>
          </View>
        </BlurView>
      )}

      <View style={[styles.bottomDock, { bottom: tabClearance }]}>
        <TouchableOpacity onPress={pickImage} disabled={scanning} activeOpacity={0.9}>
          <BlurView intensity={40} tint="dark" style={styles.btnGallery}>
            <Ionicons name="images" size={18} color="#ffffff" />
            <Text style={styles.btnText}>{t('scan.importGallery')}</Text>
          </BlurView>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View
            style={[
              styles.modalShell,
              {
                backgroundColor: colors.modalBg,
                paddingBottom: modalPadBottom,
              },
            ]}
          >
            <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>

            {analysisResult && (
              <View style={styles.modalBody}>
                <ScrollView
                  ref={modalScrollRef}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                >
                  <View style={styles.badgeRow}>
                    <Text style={styles.categoryBadge}>
                      {(analysisResult.category || 'artifact').toUpperCase()}
                    </Text>
                    <View style={styles.locationBadge}>
                      <Ionicons name="location" size={14} color="#6ee7b7" />
                      <Text style={styles.locationText}>{analysisResult.region}</Text>
                    </View>
                    {score != null && (
                      <Text style={styles.scoreBadge}>{Math.round(score * 100)}%</Text>
                    )}
                  </View>

                  <Text style={styles.modalTitle}>{analysisResult.title}</Text>

                  {(showInviteBanner || isListening) && (
                    <View style={styles.listenBanner}>
                      <Animated.View style={{ opacity: micPulse }}>
                        <Ionicons name="mic" size={22} color="#6ee7b7" />
                      </Animated.View>
                      <Text style={styles.listenText}>{t('scan.confirmBanner')}</Text>
                      <View style={styles.listenActions}>
                        <TouchableOpacity style={styles.yesBtn} onPress={confirmYes}>
                          <Text style={styles.yesBtnText}>{t('scan.yes')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.noBtn} onPress={confirmNo}>
                          <Text style={styles.noBtnText}>{t('scan.no')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <Text style={styles.sectionHeading}>{t('scan.sectionOrigin')}</Text>
                  <Text style={styles.bodyText}>{analysisResult.explanation}</Text>

                  {!!analysisResult.history && (
                    <>
                      <Text style={styles.sectionHeading}>{t('scan.sectionHistory')}</Text>
                      <Text style={styles.bodyText}>{analysisResult.history}</Text>
                    </>
                  )}

                  {!!analysisResult.anecdotes && (
                    <>
                      <Text style={styles.sectionHeading}>{t('scan.sectionAnecdote')}</Text>
                      <Text style={styles.bodyText}>{analysisResult.anecdotes}</Text>
                    </>
                  )}

                  <MonumentAskBox
                    apiUrl={API_URL}
                    monumentId={analysisResult.id}
                    language={userLanguage}
                    onAnswerAudio={playAnswerAudio}
                    onInputFocus={scrollAskIntoView}
                  />
                </ScrollView>

                {/* Mini-player dans le flux (pas absolute) — visible avec le contenu */}
                {!keyboardVisible && (
                  <View
                    style={[
                      styles.miniPlayerDock,
                      { backgroundColor: colors.miniPlayer },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.miniPlayBtn}
                      onPress={playElevenLabsAudio}
                      disabled={loadingAudio || isWaitingForPrefetch}
                    >
                      {loadingAudio || isWaitingForPrefetch ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
                      )}
                    </TouchableOpacity>

                    <View style={styles.miniMeta}>
                      <Text style={styles.miniTitle} numberOfLines={1}>
                        {t('scan.miniPlayerTitle')}
                      </Text>
                      <SoundWave active={!!isPlaying} />
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.round(audioProgress * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>

                    <TouchableOpacity style={styles.miniRescan} onPress={closeModal}>
                      <Ionicons name="refresh" size={18} color="#6ee7b7" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  camera: { flex: 1 },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  overlay: { flex: 1, justifyContent: 'flex-start', paddingTop: 56, paddingHorizontal: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    overflow: 'hidden',
    flex: 1,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  statusBadgeActive: { backgroundColor: 'rgba(5, 150, 105, 0.25)' },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  langText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  textDark: { color: '#0f172a', fontSize: 14, marginBottom: 20 },
  btnPrimary: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  btnTextLight: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    marginLeft: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  scanningCard: {
    position: 'absolute',
    alignSelf: 'center',
    left: 24,
    right: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  glassInner: {
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    padding: 18,
  },
  scanningTitle: {
    marginTop: 10,
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  bottomDock: { position: 'absolute', left: 16, right: 16 },
  btnGallery: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    paddingVertical: 14,
    borderRadius: 28,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalShell: {
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingTop: 12,
    paddingHorizontal: 18,
  },
  modalBody: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.14)',
    padding: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  miniPlayerDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  miniPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMeta: { flex: 1 },
  miniTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  miniRescan: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  categoryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 6,
  },
  locationBadge: { flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 6 },
  locationText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scoreBadge: {
    color: '#6ee7b7',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  listenBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(110, 231, 183, 0.35)',
    backgroundColor: 'rgba(5, 150, 105, 0.18)',
    alignItems: 'center',
  },
  listenText: {
    color: '#ecfdf5',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  listenActions: { flexDirection: 'row', gap: 10 },
  yesBtn: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  yesBtnText: { color: '#fff', fontWeight: '800' },
  noBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  noBtnText: { color: '#fff', fontWeight: '700' },
  audioPlayerCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  audioInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  audioTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  audioSub: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#10b981' },
  audioActions: { flexDirection: 'row', alignItems: 'center' },
  playBtn: {
    backgroundColor: '#059669',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtn: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6ee7b7',
    marginTop: 12,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bodyText: {
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 22,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  btnRescan: {
    marginTop: 18,
    marginBottom: 10,
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
