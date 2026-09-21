import { storageGet, storageSet } from '../utils/safeStorage';

const CACHE_KEY = '@camvision/nearby_monuments_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (équivalent staleTime React Query)

/**
 * Cache local des monuments nearby — affichage instantané à l'ouverture Carte.
 */
export async function loadNearbyCache() {
  try {
    const raw = await storageGet(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.monuments)) return null;
    return {
      monuments: parsed.monuments,
      lat: parsed.lat,
      lng: parsed.lng,
      savedAt: parsed.savedAt || 0,
      fresh: Date.now() - (parsed.savedAt || 0) < CACHE_TTL_MS,
    };
  } catch (e) {
    console.warn('loadNearbyCache:', e?.message || e);
    return null;
  }
}

export async function saveNearbyCache(monuments, lat, lng) {
  try {
    await storageSet(
      CACHE_KEY,
      JSON.stringify({
        monuments: monuments || [],
        lat,
        lng,
        savedAt: Date.now(),
      })
    );
  } catch (e) {
    console.warn('saveNearbyCache:', e?.message || e);
  }
}
