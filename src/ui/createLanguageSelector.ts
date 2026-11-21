import Phaser from 'phaser';
import { getLocale, setLocale, t, type Locale } from '../i18n';
import { createSegmentedSetting } from './createSegmentedSetting';

const locales = ['uk', 'en'] as const satisfies readonly Locale[];
const labels = {
  uk: 'languageUkrainian',
  en: 'languageEnglish',
} as const;

export function createLanguageSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  scale: number,
  onChange: (locale: Locale) => void,
): Phaser.GameObjects.Container {
  return createSegmentedSetting(scene, x, y, scale, {
    width,
    label: t('languageSetting'),
    options: locales.map((locale) => ({ value: locale, text: t(labels[locale]) })),
    get: getLocale,
    set: (locale) => {
      setLocale(locale);
      onChange(locale);
    },
  }).container;
}
