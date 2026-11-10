import Phaser from 'phaser';
import { palette, toCssColor } from '../config/palette';
import { getLocale, type Locale, setLocale } from '../i18n';
import { createUiText } from './createUiText';

const locales = ['uk', 'en'] as const satisfies readonly Locale[];
const labels = {
  uk: 'languageUkrainian',
  en: 'languageEnglish',
} as const;

export function createLanguageSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  onChange: (locale: Locale) => void,
): Phaser.GameObjects.Container {
  const selector = scene.add.container(x, y);
  const labelWidth = 104 * scale;
  const optionWidth = 62 * scale;
  const optionHeight = 28 * scale;
  const gap = 5 * scale;
  const left = -(labelWidth + gap + optionWidth * locales.length + gap) / 2;
  const label = createUiText(
    scene,
    left + labelWidth / 2,
    0,
    'languageSetting',
    'qualityLabel',
    scale,
  );
  selector.add(label);

  const backgrounds = new Map<Locale, Phaser.GameObjects.Rectangle>();
  const texts = new Map<Locale, Phaser.GameObjects.Text>();

  locales.forEach((locale, index) => {
    const optionX = left + labelWidth + gap + optionWidth / 2
      + index * (optionWidth + gap);
    const background = scene.add.rectangle(
      optionX,
      0,
      optionWidth,
      optionHeight,
      palette.track,
    );
    background.setStrokeStyle(scale, palette.trackBorder);
    background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, optionWidth, optionHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    background.on(Phaser.Input.Events.POINTER_UP, () => {
      if (locale === getLocale()) {
        return;
      }

      setLocale(locale);
      updateSelection();
      onChange(locale);
    });

    const optionText = createUiText(scene, optionX, 0, labels[locale], 'qualityOption', scale);
    backgrounds.set(locale, background);
    texts.set(locale, optionText);
    selector.add([background, optionText]);
  });

  function updateSelection(): void {
    const currentLocale = getLocale();
    locales.forEach((locale) => {
      const selected = locale === currentLocale;
      backgrounds.get(locale)?.setFillStyle(selected ? palette.accent : palette.track);
      texts.get(locale)?.setColor(toCssColor(
        selected ? palette.textPrimary : palette.textSecondary,
      ));
    });
  }

  updateSelection();

  return selector;
}
