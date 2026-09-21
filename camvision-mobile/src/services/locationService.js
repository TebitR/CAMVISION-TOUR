import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

const EARTH_RADIUS_KM = 6371;

/**
 * Distance Haversine entre deux points GPS (km).
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

/** Formate une distance pour l'UI (ex. "350 m" / "2,4 km"). */
export function formatDistance(distanceKm) {
  if (distanceKm == null || Number.isNaN(distanceKm)) return '—';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

/**
 * Demande permission et renvoie une position rapidement.
 * Prefere lastKnown, sinon GPS Balanced (évite Accuracy.High trop lent).
 * @returns {{ latitude, longitude, accuracy, heading, fromCache?: boolean } | null}
 */
export async function getCurrentPosition(options = {}) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const preferLastKnown = options.preferLastKnown !== false;
  if (preferLastKnown) {
    try {
      const last = await Location.getLastKnownPositionAsync({
        maxAge: options.maxAgeMs ?? 120000,
        requiredAccuracy: options.requiredAccuracy ?? 500,
      });
      if (last?.coords) {
        return {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy,
          heading: last.coords.heading,
          fromCache: true,
        };
      }
    } catch (e) {
      console.warn('getLastKnownPositionAsync:', e?.message || e);
    }
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: options.accuracy ?? Location.Accuracy.Balanced,
  });

  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading: pos.coords.heading,
    fromCache: false,
  };
}

/** Affinage GPS en arrière-plan (Balanced / High selon options). */
export async function getFreshPosition(options = {}) {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: options.accuracy ?? Location.Accuracy.Balanced,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      fromCache: false,
    };
  } catch (e) {
    console.warn('getFreshPosition:', e?.message || e);
    return null;
  }
}

/**
 * Suit la position GPS (premier plan). Retourne le subscription à .remove().
 * Inclut le cap (heading) quand le GPS / la boussole le fournit.
 */
export async function watchPosition(onUpdate, options = {}) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  return Location.watchPositionAsync(
    {
      accuracy: options.accuracy ?? Location.Accuracy.Balanced,
      timeInterval: options.timeInterval ?? 4000,
      distanceInterval: options.distanceInterval ?? 15,
    },
    (pos) => {
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
      });
    }
  );
}

/**
 * Suit le cap boussole (degrés). Fusionner avec watchPosition pour le cône d'orientation.
 * @returns {Promise<{ remove: Function } | null>}
 */
export async function watchHeading(onUpdate) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  try {
    return await Location.watchHeadingAsync((obj) => {
      const h =
        typeof obj.trueHeading === 'number' && obj.trueHeading >= 0
          ? obj.trueHeading
          : obj.magHeading;
      if (typeof h === 'number' && !Number.isNaN(h)) {
        onUpdate(h);
      }
    });
  } catch (e) {
    console.warn('watchHeading:', e?.message || e);
    return null;
  }
}

/** Ouvre Google Maps / Apple Maps pour un itinéraire vers lat,lng. */
export async function openNativeDirections(latitude, longitude, label = '') {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const encodedLabel = encodeURIComponent(label || 'Destination');

  if (Platform.OS === 'ios') {
    const apple = `maps://app?daddr=${lat},${lng}&q=${encodedLabel}`;
    const canApple = await Linking.canOpenURL(apple);
    if (canApple) {
      await Linking.openURL(apple);
      return;
    }
  }

  // Android navigation intent, fallback universal Google Maps
  const googleNav = `google.navigation:q=${lat},${lng}`;
  const canNav = await Linking.canOpenURL(googleNav);
  if (canNav) {
    await Linking.openURL(googleNav);
    return;
  }

  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  await Linking.openURL(web);
}

/** Seuil geofencing léger (mètres). */
export const GEOFENCE_RADIUS_M = 250;
