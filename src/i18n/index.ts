/**
 * Translations. English is the source language; every screen text lives in en.json.
 * French, German and Arabic are added as fr.json, de.json and ar.json (milestone 6).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';

export const LANGUAGES = ['en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The phone's language if we have it, otherwise English. */
function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode;
    if (code && (LANGUAGES as readonly string[]).includes(code)) return code as Language;
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
  returnObjects: false,
});

export default i18n;
