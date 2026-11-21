import Phaser from 'phaser';
import { palette, toCssColor } from '../../../config/palette';
import { typography } from '../../../config/typography';

const BUTTON_SIZE = 44;

export interface CarSwitcherLayout {
  leftX: number;
  rightX: number;
  /** Arrows, vertically. */
  y: number;
  counterX: number;
  counterY: number;
}

export interface CarSwitcher {
  container: Phaser.GameObjects.Container;
  setIndex: (index: number) => void;
}

/** "‹" and "›" on both sides of the car plus a small "1 / 3" counter. */
export function createCarSwitcher(
  scene: Phaser.Scene,
  scale: number,
  layout: CarSwitcherLayout,
  options: { index: number; count: number; onChange: (step: -1 | 1) => void },
): CarSwitcher {
  const container = scene.add.container(0, 0).setName('car-switcher');
  container.add(createArrowButton(scene, layout.leftX, layout.y, scale, -1, () => options.onChange(-1)));
  container.add(createArrowButton(scene, layout.rightX, layout.y, scale, 1, () => options.onChange(1)));
  const counter = scene.add.text(layout.counterX, layout.counterY, '', {
    fontFamily: typography.fontFamily,
    fontSize: `${Math.max(1, Math.round(16 * scale))}px`,
    fontStyle: 'bold',
    color: toCssColor(palette.textPrimary),
  })
    .setOrigin(0.5)
    .setShadow(0, scale, '#000000', 4 * scale, false, true);
  container.add(counter);

  const setIndex = (index: number): void => {
    counter.setText(`${index + 1} / ${options.count}`);
  };
  setIndex(options.index);

  return { container, setIndex };
}

function createArrowButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  direction: -1 | 1,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const size = BUTTON_SIZE * scale;
  const button = scene.add.container(x, y);
  button.add(
    scene.add.rectangle(0, 0, size, size, palette.track, 0.92)
      .setStrokeStyle(1.5 * scale, palette.trackBorder),
  );
  const chevron = scene.add.graphics();
  chevron.lineStyle(3.5 * scale, palette.textPrimary, 1);
  chevron.beginPath();
  chevron.moveTo(-4 * direction * scale, -10 * scale);
  chevron.lineTo(6 * direction * scale, 0);
  chevron.lineTo(-4 * direction * scale, 10 * scale);
  chevron.strokePath();
  button.add(chevron);
  button.setSize(size, size);
  button.setInteractive(new Phaser.Geom.Rectangle(0, 0, size, size), Phaser.Geom.Rectangle.Contains);
  button.on(Phaser.Input.Events.POINTER_OVER, () => button.setAlpha(0.82));
  button.on(Phaser.Input.Events.POINTER_OUT, () => button.setAlpha(1).setScale(1));
  button.on(Phaser.Input.Events.POINTER_DOWN, () => button.setScale(0.96));
  button.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    onClick();
  });
  return button;
}
