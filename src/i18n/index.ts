import en from '../locales/en.json';
import uk from '../locales/uk.json';

export type Locale = 'en' | 'uk';
export type MessageKey = keyof typeof en;

const translations = {
  en,
  uk,
} satisfies Record<Locale, Record<MessageKey, string>>;

const STORAGE_KEY = 'drag-racing.locale';
const browserLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
const defaultLocale: Locale = browserLanguage.startsWith('uk') ? 'uk' : 'en';
let locale = readLocale();

function isLocale(value: string | null): value is Locale {
  return value === 'uk' || value === 'en';
}

function readLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  try {
    const savedLocale = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(savedLocale) ? savedLocale : defaultLocale;
  } catch (error) {
    console.warn('Could not read the language preference.', error);
    return defaultLocale;
  }
}

export function getLocale(): Locale {
  return locale;
}

export function setLocale(nextLocale: Locale): void {
  locale = nextLocale;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  } catch (error) {
    console.warn('Could not save the language preference.', error);
  }
}

export function t(key: MessageKey): string {
  return translations[locale][key];
}
