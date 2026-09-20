import { Image } from 'react-native';
import { getApiUrl } from '../config';

const PLACEHOLDER = require('../../assets/images/placeholder_monument.png');

/**
 * Résout une URL d'image monument pour l'appareil (Expo Go / LAN).
 * - remplace localhost/127.0.0.1 par l'hôte de l'API
 * - préfixe les chemins relatifs avec API_URL
 * - fallback placeholder si vide
 *
 * @returns {string|number} uri string ou require() number pour Image source
 */
export function resolveImageUrl(path) {
  if (path == null || path === '') {
    return PLACEHOLDER;
  }

  // Déjà un require() / asset local
  if (typeof path === 'number') {
    return path;
  }

  const api = getApiUrl().replace(/\/$/, '');
  let url = String(path).trim();

  // URL absolue avec localhost → rewrite host
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        const apiParsed = new URL(api);
        parsed.hostname = apiParsed.hostname;
        parsed.port = apiParsed.port;
        parsed.protocol = apiParsed.protocol;
        return parsed.toString();
      }
    } catch (_) {
      /* keep url */
    }
    return url;
  }

  // Chemin relatif (sample_images/... ou /media/...)
  if (!url.startsWith('/')) {
    url = `/${url}`;
  }
  return `${api}${url}`;
}

/** Source Image RN : { uri } ou require(). */
export function monumentImageSource(path) {
  const resolved = resolveImageUrl(path);
  if (typeof resolved === 'number') {
    return resolved;
  }
  return { uri: resolved };
}

export const PLACEHOLDER_MONUMENT = PLACEHOLDER;
