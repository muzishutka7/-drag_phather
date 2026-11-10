import en from '../locales/en.json';
import uk from '../locales/uk.json';

type Locale = 'en' | 'uk';
export type MessageKey = keyof typeof en;

const translations = {
  en,
  uk,
} satisfies Record<Locale, Record<MessageKey, string>>;

const browserLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
const locale: Locale = browserLanguage.startsWith('uk') ? 'uk' : 'en';

export function t(key: MessageKey): string {
  return translations[locale][key];
}
