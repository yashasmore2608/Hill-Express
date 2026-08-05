import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { en } from './en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    // hi: { translation: hi },  ← the entire cost of adding Hindi later
  },
  lng: getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
