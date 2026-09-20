import Constants from 'expo-constants';

/** Base API (hôte Expo / LAN → port backend 8000). */
export function getApiUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.developer?.tool ||
    '';
  const host = hostUri ? String(hostUri).split(':')[0] : 'localhost';
  return `http://${host}:8000`;
}

/** Token Mapbox (app.config extra ou EXPO_PUBLIC_). */
export function getMapboxToken() {
  return (
    Constants.expoConfig?.extra?.mapboxAccessToken ||
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ''
  ).trim();
}
