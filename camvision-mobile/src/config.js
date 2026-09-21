import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

/**
 * Extrait l'hôte LAN depuis l'URL du bundle Metro (le plus fiable sur appareil).
 */
function hostFromScriptURL() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (!scriptURL || typeof scriptURL !== 'string') return null;
    const m = scriptURL.match(/https?:\/\/([^/:]+)(?::\d+)?/);
    if (!m) return null;
    const host = m[1];
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Hôte de développement Expo (change automatiquement si le réseau / Metro change).
 */
export function getDevHost() {
  const explicit =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_HOST) ||
    Constants.expoConfig?.extra?.apiHost ||
    '';
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim();
  }

  const fromScript = hostFromScriptURL();
  if (fromScript) return fromScript;

  const hostUri =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    '';

  if (hostUri) {
    const host = String(hostUri).split(':')[0].trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }

  // Émulateur Android → machine hôte
  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
}

/** Base API (même IP que Metro / Expo Go → port backend 8000). */
export function getApiUrl() {
  return `http://${getDevHost()}:8000`;
}

/** Token Mapbox (app.config extra ou EXPO_PUBLIC_). */
export function getMapboxToken() {
  return (
    Constants.expoConfig?.extra?.mapboxAccessToken ||
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ''
  ).trim();
}
