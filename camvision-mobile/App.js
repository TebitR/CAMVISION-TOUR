import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import Constants from 'expo-constants';
import WelcomeScreen from './WelcomeScreen';

const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.developer?.tool;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:8000`;

const CONFIDENCE_THRESHOLD = 0.60;

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [locked, setLocked] = useState(false);

  const isAnalyzingRef = useRef(false);
  const notFoundTimerRef = useRef(null);
  const scanPulse = useRef(new Animated.Value(0.4)).current;
  const scanLine = useRef(new Animated.Value(0)).current;

  const handleContinue = useCallback(() => {
    setShowWelcome(false);
  }, []);

  // Animation visuelle pendant le scan
  useEffect(() => {
    if (!scanning && !isLiveScanning) {
      scanPulse.setValue(0.4);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(scanPulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );

    const lineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );

    pulseLoop.start();
    lineLoop.start();

    return () => {
      pulseLoop.stop();
      lineLoop.stop();
    };
  }, [scanning, isLiveScanning, scanPulse, scanLine]);

  // Scan automatique tant qu'aucun résultat n'est capturé
  useEffect(() => {
    let interval = null;
    if (!showWelcome && isLiveScanning && !locked && cameraRef && !selectedImage) {
      // Premier scan rapide, puis toutes les 2.5 s
      const kickoff = setTimeout(() => captureAndAnalyzeLive(), 600);
      interval = setInterval(() => {
        captureAndAnalyzeLive();
      }, 2500);

      return () => {
        clearTimeout(kickoff);
        if (interval) clearInterval(interval);
      };
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showWelcome, cameraRef, isLiveScanning, selectedImage, locked]);

  useEffect(() => {
    return () => {
      if (notFoundTimerRef.current) clearTimeout(notFoundTimerRef.current);
    };
  }, []);

  if (showWelcome) {
    return <WelcomeScreen onContinue={handleContinue} />;
  }

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Permission d'accéder à la caméra requise.</Text>
        <TouchableOpacity style={styles.btnCapture} onPress={requestPermission}>
          <Text style={styles.btnTextLight}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showTransientNotFound = () => {
    setNotFound(true);
    if (notFoundTimerRef.current) clearTimeout(notFoundTimerRef.current);
    notFoundTimerRef.current = setTimeout(() => {
      setNotFound(false);
    }, 2800);
  };

  const captureAndAnalyzeLive = async () => {
    if (isAnalyzingRef.current || !cameraRef || locked) return;
    isAnalyzingRef.current = true;
    setScanning(true);
    setNotFound(false);

    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.5, skipProcessing: true });
      await processImage(photo.uri, false);
    } catch (e) {
      console.log('Erreur frame live:', e);
    } finally {
      setScanning(false);
      isAnalyzingRef.current = false;
    }
  };

  const processImage = async (imageUri, isManual = false) => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'scan.jpg',
      type: 'image/jpeg',
    });

    try {
      const response = await axios.post(`${API_URL}/api/vision/search?limit=1`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.results && response.data.results.length > 0) {
        const topResult = response.data.results[0];

        if (topResult.score >= CONFIDENCE_THRESHOLD) {
          // Capture le résultat et stoppe le scan live
          setResult(topResult);
          setNotFound(false);
          setSelectedImage(imageUri);
          setIsLiveScanning(false);
          setLocked(true);
        } else {
          setResult(null);
          if (isManual) {
            setNotFound(true);
          } else {
            showTransientNotFound();
          }
        }
      } else {
        setResult(null);
        if (isManual) {
          setNotFound(true);
        } else {
          showTransientNotFound();
        }
      }
    } catch (error) {
      if (isManual) {
        Alert.alert('Erreur Connexion', 'Impossible de contacter le serveur FastAPI.');
      } else {
        showTransientNotFound();
      }
    }
  };

  const pickImage = async () => {
    setIsLiveScanning(false);
    let res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setSelectedImage(uri);
      setScanning(true);
      setLocked(false);
      await processImage(uri, true);
      setScanning(false);
    } else if (!locked) {
      setIsLiveScanning(true);
    }
  };

  const resetScan = () => {
    if (notFoundTimerRef.current) clearTimeout(notFoundTimerRef.current);
    setSelectedImage(null);
    setResult(null);
    setNotFound(false);
    setLocked(false);
    setIsLiveScanning(true);
    isAnalyzingRef.current = false;
  };

  const lineTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });

  return (
    <View style={styles.container}>
      {!selectedImage ? (
        <CameraView style={styles.camera} ref={(ref) => setCameraRef(ref)}>
          <View style={styles.overlay}>
            {/* Cadre de scan */}
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              {(scanning || isLiveScanning) && (
                <Animated.View
                  style={[
                    styles.scanBeam,
                    {
                      opacity: scanPulse,
                      transform: [{ translateY: lineTranslate }],
                    },
                  ]}
                />
              )}
            </View>

            {/* Badge statut toujours visible */}
            <View style={[styles.statusBadge, scanning && styles.statusBadgeActive]}>
              <ActivityIndicator size="small" color="#059669" style={{ marginRight: 8 }} />
              <Text style={styles.statusText}>
                {scanning ? 'Scan en cours...' : 'Scan IA actif — pointez une œuvre'}
              </Text>
            </View>
          </View>
        </CameraView>
      ) : (
        <Image source={{ uri: selectedImage }} style={styles.preview} />
      )}

      {/* Overlay chargement — verre flouté */}
      {scanning && (
        <BlurView intensity={35} tint="light" style={styles.scanningCard}>
          <View style={[styles.glassInner, { alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.scanningTitle}>Scan en cours</Text>
            <Text style={styles.scanningSub}>Analyse OpenCLIP de la scène…</Text>
          </View>
        </BlurView>
      )}

      {/* Résultat capturé — glassmorphism clair + flou derrière le texte */}
      {result && !scanning && (
        <BlurView intensity={40} tint="default" style={styles.glassCard}>
          <View style={styles.glassInner}>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeText}>
                Capturé · {(result.score * 100).toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.title}>{result.name?.fr || result.name}</Text>
            <Text style={styles.desc}>{result.description?.fr || result.description}</Text>
          </View>
        </BlurView>
      )}

      {/* Non reconnu */}
      {notFound && !scanning && !result && (
        <BlurView intensity={40} tint="default" style={[styles.glassCard, styles.glassCardError]}>
          <View style={styles.glassInner}>
            <Text style={styles.notFoundTitle}>Objet non reconnu</Text>
            <Text style={styles.notFoundDesc}>
              Aucun artefact correspondant. Continuez à viser ou relancez le scan.
            </Text>
          </View>
        </BlurView>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        {locked || selectedImage ? (
          <TouchableOpacity style={styles.btnReset} onPress={resetScan}>
            <Text style={styles.btnTextLight}>🔄 Relancer le scan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnGallery} onPress={pickImage} disabled={scanning}>
            <Text style={styles.btnText}>🖼️ Importer de la galerie</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  preview: { flex: 1, resizeMode: 'cover' },
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 56,
  },

  viewfinder: {
    position: 'absolute',
    top: '28%',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#34d399',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  scanBeam: {
    width: '88%',
    height: 2,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    overflow: 'hidden',
  },
  statusBadgeActive: {
    borderColor: 'rgba(52, 211, 153, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  scanningCard: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    minWidth: 230,
    ...Platform.select({
      android: { backgroundColor: 'rgba(255,255,255,0.10)' },
      default: {},
    }),
  },
  scanningTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scanningSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Glassmorphism plus transparent
  glassCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
    ...Platform.select({
      android: { backgroundColor: 'rgba(255,255,255,0.08)' },
      default: {},
    }),
  },
  glassInner: {
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  glassCardError: {
    borderColor: 'rgba(255, 120, 120, 0.45)',
  },
  badgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  desc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  notFoundTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  notFoundDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  actionRow: { position: 'absolute', bottom: 35, left: 20, right: 20, alignItems: 'center' },
  btnCapture: { backgroundColor: '#10b981', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 30 },
  btnGallery: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  btnReset: { backgroundColor: '#f59e0b', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30 },
  btnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
  btnTextLight: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  text: { color: '#fff', textAlign: 'center', marginBottom: 20 },
});
