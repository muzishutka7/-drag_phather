import Phaser from 'phaser';
import { palette } from '../../../config/palette';
import { t } from '../../../i18n';
import type { CarPart } from '../../../state/partHealth';
import { createConditionIcon } from '../../../ui/createCheckEngineIcon';

const WIDTH = 400;
const HEIGHT = 250;

const QUESTION_KEY = {
  engine: 'repairEngineQuestion',
  suspension: 'repairSuspensionQuestion',
  body: 'repairBodyQuestion',
} as const satisfies Record<CarPart, string>;

const OK_KEY = {
  engine: 'repairEngineOk',
  suspension: 'repairSuspensionOk',
  body: 'repairBodyOk',
} as const satisfies Record<CarPart, string>;

export interface RepairDialogOptions {
  part: CarPart;
  health: number;
  onConfirm: () => void;
}

/**
 * Modal "repair this part?" confirmation. Blocks the garage behind it until
 * the player confirms or cancels. A part in perfect shape only gets an OK.
 */
export function openRepairDialog(scene: Phaser.Scene, options: RepairDialogOptions): void {
  const { width, height } = scene.scale;
  const scale = Math.min(width / 960, height / 540);
  const needsRepair = options.health < 99.95;

  const root = scene.add.container(0, 0).setDepth(50).setName('repair-dialog');
  const shade = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
  shade.setInteractive(); // swallow clicks on the garage behind
  root.add(shade);

  const panel = scene.add.container(width / 2, height / 2).setScale(scale);
  const background = scene.add.graphics();
  background.fillStyle(palette.background, 0.97);
  background.fillRoundedRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 16);
  background.lineStyle(2, palette.trackBorder, 1);
  background.strokeRoundedRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 16);
  panel.add(background);

  const icon = createConditionIcon(scene, options.part, '');
  icon.container.setPosition(0, -62).setScale(0.9);
  icon.update(options.health, false, 0);
  panel.add(icon.container);

  panel.add(scene.add.text(0, 0, t(needsRepair ? QUESTION_KEY[options.part] : OK_KEY[options.part]), {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '20px',
    color: '#f3f5f7',
    align: 'center',
  }).setOrigin(0.5));
  if (needsRepair) {
    panel.add(scene.add.text(0, 30, `${Math.floor(options.health)}%  →  100%`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#aab4bb',
    }).setOrigin(0.5));
  }

  root.add(panel);

  const close = (): void => {
    // Destroy after the click that closes the dialog has been handled.
    scene.time.delayedCall(0, () => root.destroy(true));
  };

  if (needsRepair) {
    panel.add(createDialogButton(scene, -95, 82, t('repairCancel'), false, close));
    panel.add(createDialogButton(scene, 95, 82, t('repairConfirm'), true, () => {
      options.onConfirm();
      close();
    }));
  } else {
    panel.add(createDialogButton(scene, 0, 82, t('repairClose'), true, close));
  }

  panel.setScale(scale * 0.9).setAlpha(0);
  scene.tweens.add({ targets: panel, scale, alpha: 1, duration: 140, ease: 'Back.easeOut' });
}

function createDialogButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  primary: boolean,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const button = scene.add.container(x, y);
  const background = scene.add.rectangle(0, 0, 170, 46, primary ? palette.accent : palette.track, 1)
    .setStrokeStyle(2, primary ? palette.buttonBorder : palette.trackBorder);
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '17px',
    color: '#f3f5f7',
  }).setOrigin(0.5);
  button.add([background, text]);
  background.setInteractive({ useHandCursor: true });
  background.on(Phaser.Input.Events.POINTER_OVER, () => button.setAlpha(0.85));
  background.on(Phaser.Input.Events.POINTER_OUT, () => button.setAlpha(1).setScale(1));
  background.on(Phaser.Input.Events.POINTER_DOWN, () => button.setScale(0.96));
  background.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    onClick();
  });
  return button;
}
