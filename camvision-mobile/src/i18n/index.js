import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'zh', 'ar'];

export const LANGUAGE_OPTIONS = [
  { code: 'fr', labelKey: 'languages.fr', flag: '🇫🇷' },
  { code: 'en', labelKey: 'languages.en', flag: '🇬🇧' },
  { code: 'es', labelKey: 'languages.es', flag: '🇪🇸' },
  { code: 'de', labelKey: 'languages.de', flag: '🇩🇪' },
  { code: 'zh', labelKey: 'languages.zh', flag: '🇨🇳' },
  { code: 'ar', labelKey: 'languages.ar', flag: '🇸🇦' },
];

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  zh: { translation: zh },
  ar: { translation: ar },
};

const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'fr';
const initialLanguage = SUPPORTED_LANGUAGES.includes(deviceLanguage)
  ? deviceLanguage
  : 'fr';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'fr',
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
  });
}

/** Code ISO court (fr, en, es, de, zh, ar) depuis i18n.language */
export function resolveAppLanguage(language) {
  const code = String(language || i18n.language || 'fr')
    .toLowerCase()
    .split('-')[0];
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'fr';
}

export default i18n;
