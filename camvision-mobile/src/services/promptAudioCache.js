import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return global.btoa(binary);
}

export function getPromptCacheUri(lang) {
  const code = String(lang || 'fr').toLowerCase().split('-')[0];
  return `${FileSystem.cacheDirectory}camvision_prompt_${code}.mp3`;
}

export async function isPromptCached(lang) {
  try {
    const info = await FileSystem.getInfoAsync(getPromptCacheUri(lang));
    return !!(info.exists && info.size > 500);
  } catch (_) {
    return false;
  }
}

/** Génère et stocke l'invite ElevenLabs pour une langue (idempotent). */
export async function ensurePromptCached(apiUrl, lang) {
  const code = String(lang || 'fr').toLowerCase().split('-')[0];
  const uri = getPromptCacheUri(code);
  if (await isPromptCached(code)) return uri;

  const text = i18n.getFixedT(code)('scan.prompt');
  const response = await axios.post(
    `${apiUrl}/api/tts/generate`,
    { text },
    { responseType: 'arraybuffer', timeout: 60000 }
  );

  const base64 = arrayBufferToBase64(response.data);
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

/** Précharge les 6 invites en arrière-plan (0 s au scan). */
export async function preloadAllPromptAudios(apiUrl) {
  const results = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    try {
      results[lang] = await ensurePromptCached(apiUrl, lang);
    } catch (e) {
      console.warn(`Préchargement invite ${lang} échoué:`, e?.message || e);
      results[lang] = null;
    }
  }
  return results;
}
