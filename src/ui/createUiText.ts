import Phaser from 'phaser';
import { toCssColor } from '../config/palette';
import { typography, type TypographyStyle } from '../config/typography';
import { t, type MessageKey } from '../i18n';

export function createUiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  messageKey: MessageKey,
  styleName: TypographyStyle,
  scale: number,
): Phaser.GameObjects.Text {
  const style = typography.styles[styleName];
  const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: typography.fontFamily,
    fontSize: `${Math.max(1, Math.round(style.fontSize * scale))}px`,
    color: toCssColor(style.color),
  };

  if ('fontStyle' in style) {
    textStyle.fontStyle = style.fontStyle;
  }

  if ('letterSpacing' in style) {
    textStyle.letterSpacing = style.letterSpacing * scale;
  }

  return scene.add.text(x, y, t(messageKey), textStyle).setOrigin(0.5);
}
