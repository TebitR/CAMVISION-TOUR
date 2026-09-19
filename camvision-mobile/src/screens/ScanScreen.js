import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
  Animated,
  Easing,
  Platform,
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

const debuggerHost =
  Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.developer?.tool;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:8000`;
const CONFIDENCE_THRESHOLD = 0.6;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return global.btoa(binary);
}

export default function ScanScreen() {
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
  const [userLang, setUserLang] = useState('fr');

  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioReady, setAudioReady] = useState(false);

  const player = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(player);

  const isAnalyzingRef = useRef(false);
  const scanPulse = useRef(new Animated.Value(0.4)).current;

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
    }
  }, [audioStatus]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.textDark}>Permission d'accéder à la caméra requise.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnTextLight}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
    formData.append('lang', userLang);

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
        Alert.alert('Non reconnu', "Aucun monument ou objet du patrimoine n'a été identifié.");
        setIsLiveScanning(true);
      }
    } catch (error) {
      if (isManual) {
        Alert.alert('Erreur', "Impossible de contacter le serveur d'analyse.");
        setIsLiveScanning(true);
      }
    }
  };

  const stopAudio = async () => {
    try {
      player.pause();
      await player.seekTo(0);
    } catch (_) {}
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const playElevenLabsAudio = async () => {
    if (!analysisResult?.explanation) return;

    try {
      // Pause / reprise si l'audio est déjà chargé
      if (audioReady) {
        if (audioStatus.playing) {
          player.pause();
          setIsPlaying(false);
        } else {
          player.play();
          setIsPlaying(true);
        }
        return;
      }

      setLoadingAudio(true);

      const speakText = [analysisResult.explanation, analysisResult.history]
        .filter(Boolean)
        .join('\n\n');

      // 1. Flux MP3 binaire depuis FastAPI (voix = ELEVENLABS_VOICE_ID côté serveur)
      const response = await axios.post(
        `${API_URL}/api/tts/generate`,
        { text: speakText },
        { responseType: 'arraybuffer', timeout: 60000 }
      );

      // 2. Conversion binaire → Base64 (pas de Buffer en React Native)
      const base64Audio = arrayBufferToBase64(response.data);
      const fileUri = `${FileSystem.cacheDirectory}elevenlabs_guide.mp3`;

      // 3. Écriture cache via API legacy Expo SDK 54+
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. Lecture via expo-audio (SDK 57 — pas expo-av)
      await setAudioModeAsync({ playsInSilentMode: true });
      player.replace({ uri: fileUri });
      player.play();
      setAudioReady(true);
      setIsPlaying(true);
    } catch (error) {
      console.error('Erreur lecture audio ElevenLabs :', error?.response?.status || error.message);
      Alert.alert('Erreur Audio', 'Impossible de lire la synthèse vocale ElevenLabs.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const closeModal = async () => {
    await stopAudio();
    setAudioReady(false);
    setModalVisible(false);
    setAnalysisResult(null);
    setScore(null);
    setIsLiveScanning(true);
  };

  const cycleLang = () => {
    const order = ['fr', 'en', 'de'];
    const next = order[(order.indexOf(userLang) + 1) % order.length];
    setUserLang(next);
  };

  return (
    <View style={styles.container}>
      {isFocused ? (
        <View style={styles.camera}>
          <CameraView style={StyleSheet.absoluteFill} ref={(ref) => setCameraRef(ref)} />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topRow}>
              <BlurView intensity={40} tint="dark" style={[styles.statusBadge, scanning && styles.statusBadgeActive]}>
                <ActivityIndicator size="small" color="#a7f3d0" style={{ marginRight: 8 }} />
                <Animated.Text style={[styles.statusText, { opacity: scanPulse }]}>
                  {scanning ? "Analyse IA de l'image..." : 'Recherche d’objets & monuments...'}
                </Animated.Text>
              </BlurView>
              <TouchableOpacity onPress={cycleLang} activeOpacity={0.85}>
                <BlurView intensity={40} tint="dark" style={styles.langBtn}>
                  <Ionicons name="globe-outline" size={16} color="#a7f3d0" />
                  <Text style={styles.langText}>{userLang.toUpperCase()}</Text>
                </BlurView>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.textDark}>Caméra en pause</Text>
        </View>
      )}

      {scanning && (
        <BlurView intensity={45} tint="dark" style={[styles.scanningCard, { bottom: tabClearance + 70 }]}>
          <View style={styles.glassInner}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.scanningTitle}>Scan en cours</Text>
          </View>
        </BlurView>
      )}

      <View style={[styles.bottomDock, { bottom: tabClearance }]}>
        <TouchableOpacity onPress={pickImage} disabled={scanning} activeOpacity={0.9}>
          <BlurView intensity={40} tint="dark" style={styles.btnGallery}>
            <Ionicons name="images" size={18} color="#ffffff" />
            <Text style={styles.btnText}>Importer de la galerie</Text>
          </BlurView>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={45}
            tint="dark"
            style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          >
            <View style={styles.glassInner}>
              <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>

              {analysisResult && (
                <ScrollView showsVerticalScrollIndicator={false}>
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

                  <View style={styles.audioPlayerCard}>
                    <View style={styles.audioInfo}>
                      <Ionicons name="volume-high" size={22} color="#6ee7b7" />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.audioTitle}>Guide vocal ElevenLabs</Text>
                        <Text style={styles.audioSub}>Écoute haute fidélité · {userLang.toUpperCase()}</Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.round(audioProgress * 100)}%` }]} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.audioActions}>
                      <TouchableOpacity
                        style={styles.playBtn}
                        onPress={playElevenLabsAudio}
                        disabled={loadingAudio}
                      >
                        {loadingAudio ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#ffffff" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.stopBtn} onPress={stopAudio}>
                        <Ionicons name="stop" size={18} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.sectionHeading}>Explication & Origine</Text>
                  <Text style={styles.bodyText}>{analysisResult.explanation}</Text>

                  {!!analysisResult.history && (
                    <>
                      <Text style={styles.sectionHeading}>Histoire & Patrimoine</Text>
                      <Text style={styles.bodyText}>{analysisResult.history}</Text>
                    </>
                  )}

                  {!!analysisResult.anecdotes && (
                    <>
                      <Text style={styles.sectionHeading}>Anecdote</Text>
                      <Text style={styles.bodyText}>{analysisResult.anecdotes}</Text>
                    </>
                  )}

                  <TouchableOpacity style={styles.btnRescan} onPress={closeModal}>
                    <Ionicons name="refresh" size={18} color="#ffffff" />
                    <Text style={styles.btnTextLight}>Relancer le scan</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </BlurView>
        </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '88%',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.14)',
    padding: 8,
    borderRadius: 20,
    marginBottom: 8,
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
