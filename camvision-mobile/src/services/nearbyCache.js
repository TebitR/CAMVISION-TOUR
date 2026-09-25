import { storageGet, storageSet, storageRemove } from '../utils/safeStorage';

const CACHE_KEY = '@camvision/nearby_monuments_v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * Cache local des monuments nearby — affichage instantané à l'ouverture Carte.
 * La langue est stockée : un changement de langue invalide le cache.
 */
export async function loadNearbyCache(lang = 'fr') {
  try {
    const raw = await storageGet(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.monuments)) return null;
    const cachedLang = (parsed.lang || 'fr').toLowerCase();
    const want = (lang || 'fr').toLowerCase();
    if (cachedLang !== want) return null;
    return {
      monuments: parsed.monuments,
      lat: parsed.lat,
      lng: parsed.lng,
      lang: cachedLang,
      savedAt: parsed.savedAt || 0,
      fresh: Date.now() - (parsed.savedAt || 0) < CACHE_TTL_MS,
    };
  } catch (e) {
    console.warn('loadNearbyCache:', e?.message || e);
    return null;
  }
}

export async function saveNearbyCache(monuments, lat, lng, lang = 'fr') {
  try {
    await storageSet(
      CACHE_KEY,
      JSON.stringify({
        monuments: monuments || [],
        lat,
        lng,
        lang: (lang || 'fr').toLowerCase(),
        savedAt: Date.now(),
      })
    );
  } catch (e) {
    console.warn('saveNearbyCache:', e?.message || e);
  }
}

export async function clearNearbyCache() {
  try {
    await storageRemove(CACHE_KEY);
  } catch (e) {
    console.warn('clearNearbyCache:', e?.message || e);
  }
}
