import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import sw from './locales/sw';
import so from './locales/so';
import ar from './locales/ar';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili', dir: 'ltr' },
  { code: 'so', label: 'Somali', native: 'Soomaali', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sw: { translation: sw },
      so: { translation: so },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'deynpro_lang',
    },
  });

// Set <html dir> based on language
const applyDir = (lng: string) => {
  const meta = SUPPORTED_LANGUAGES.find(l => l.code === lng);
  if (typeof document !== 'undefined') {
    document.documentElement.dir = meta?.dir || 'ltr';
    document.documentElement.lang = lng;
  }
};
applyDir(i18n.language);
i18n.on('languageChanged', applyDir);

export default i18n;
