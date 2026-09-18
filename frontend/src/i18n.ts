import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptTranslation from './locales/pt.json';
import esTranslation from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: ptTranslation,
      es: esTranslation,
    },
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'es'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Keep html lang attribute in sync with active language
const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng.startsWith('es') ? 'es' : 'pt-BR';
  }
};

i18n.on('languageChanged', (lng) => {
  syncHtmlLang(lng);
});

syncHtmlLang(i18n.language || 'pt');

export default i18n;
