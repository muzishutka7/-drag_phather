import Phaser from 'phaser';
import { palette } from '../../config/palette';
import { t, type MessageKey } from '../../i18n';
import {
  AMBER_LIGHT_COUNT,
  RACE_DISTANCES,
  type RaceDistance,
  type RaceSession,
} from './raceSession';

const AMBER_ON = 0xffb22e;
const LIGHT_OFF = 0x2b3134;
const GREEN_ON = 0x37e06a;

export interface EngineHudState {
  /** 0..100 % */
  health: number;
}

export interface RaceHud {
  container: Phaser.GameObjects.Container;
  update: (session: RaceSession, engine: EngineHudState) => void;
  layout: (width: number, height: number, layoutScale: number) => void;
  destroy: () => void;
}

export function createRaceHud(
  scene: Phaser.Scene,
  onSelectDistance: (distance: RaceDistance) => void,
  onRetry: () => void,
  onGarage: () => void,
): RaceHud {
  const container = scene.add.container(0, 0).setName('race-hud').setDepth(8);
  const baseStyle = {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    color: '#f3f5f7',
    stroke: '#101820',
    strokeThickness: 5,
    align: 'center',
  };

  // Status line (hints, "GET READY", "GO!").
  const statusText = scene.add.text(0, 0, '', { ...baseStyle, fontSize: '22px' }).setOrigin(0.5);
  // Live timer and distance.
  const timerText = scene.add.text(0, 0, '', { ...baseStyle, fontSize: '26px' }).setOrigin(0.5);

  // Start lights.
  const lights = scene.add.graphics();

  // Distance selection.
  const choosePanel = scene.add.container(0, 0);
  const chooseTitle = scene.add.text(0, -70, t('raceChooseDistance'), {
    ...baseStyle,
    fontSize: '28px',
  }).setOrigin(0.5);
  choosePanel.add(createPanelBackground(scene, 420, 220));
  choosePanel.add(chooseTitle);
  RACE_DISTANCES.forEach((distance, index) => {
    const key: MessageKey = distance === 402 ? 'raceDistance402' : 'raceDistance804';
    choosePanel.add(createButton(scene, 0, -8 + index * 70, 340, 54, t(key), () => {
      onSelectDistance(distance);
    }));
  });

  // Results.
  const resultPanel = scene.add.container(0, 0);
  const resultTitle = scene.add.text(0, -135, '', { ...baseStyle, fontSize: '30px' }).setOrigin(0.5);
  const resultBody = scene.add.text(0, -12, '', {
    ...baseStyle,
    fontSize: '19px',
    fontStyle: 'normal',
    lineSpacing: 4,
  }).setOrigin(0.5);
  resultPanel.add(createPanelBackground(scene, 460, 360));
  resultPanel.add([resultTitle, resultBody]);
  resultPanel.add(createButton(scene, -110, 125, 200, 50, t('raceRetry'), onRetry));
  resultPanel.add(createButton(scene, 110, 125, 200, 50, t('raceGarage'), onGarage));

  container.add([statusText, timerText, lights, choosePanel, resultPanel]);

  const keyboard = scene.input.keyboard;
  const onKeyDown = (event: KeyboardEvent): void => {
    if (choosePanel.visible && (event.key === '1' || event.key === '2')) {
      onSelectDistance(event.key === '1' ? 402 : 804);
    } else if (resultPanel.visible && (event.key === 'r' || event.key === 'R' || event.key === 'Enter')) {
      onRetry();
    }
  };
  keyboard?.on('keydown', onKeyDown);

  let lastResultKey = '';

  const drawLights = (amber: number, green: boolean, visible: boolean): void => {
    lights.clear().setVisible(visible);
    if (!visible) {
      return;
    }

    const spacing = 34;
    const startX = -spacing * (AMBER_LIGHT_COUNT) / 2;
    lights.fillStyle(0x101415, 0.9);
    lights.fillRoundedRect(startX - 24, -22, spacing * (AMBER_LIGHT_COUNT + 1) + 14, 44, 10);
    for (let index = 0; index < AMBER_LIGHT_COUNT; index += 1) {
      lights.fillStyle(index < amber ? AMBER_ON : LIGHT_OFF, 1);
      lights.fillCircle(startX + index * spacing, 0, 12);
    }
    lights.fillStyle(green ? GREEN_ON : LIGHT_OFF, 1);
    lights.fillCircle(startX + AMBER_LIGHT_COUNT * spacing, 0, 12);
  };

  return {
    container,
    update: (session, engine) => {
      const phase = session.phase;
      choosePanel.setVisible(phase === 'choose-distance');
      resultPanel.setVisible(phase === 'finished');

      if (phase === 'burnout') {
        statusText.setText(session.countdownSeconds === undefined
          ? t('raceBurnoutHint')
          : t('raceBurnoutActive'));
      } else if (phase === 'staging') {
        statusText.setText(t('raceStaging'));
      } else if (phase === 'racing' && session.sinceGreenSeconds < 1) {
        statusText.setText(t('raceStart'));
      } else {
        statusText.setText('');
      }

      drawLights(
        session.amberLights,
        session.greenLight && phase === 'racing' && session.sinceGreenSeconds < 1.5,
        phase === 'staging' || (phase === 'racing' && session.sinceGreenSeconds < 1.5),
      );

      if (phase === 'racing') {
        timerText.setText(
          `${session.elapsedSeconds.toFixed(2)} s   ${Math.ceil(session.remainingMeters)} m`,
        );
      } else {
        timerText.setText('');
      }

      const result = session.result;
      if (phase === 'finished' && result) {
        const key = `${result.distanceMeters}-${result.elapsedSeconds}-${Math.floor(engine.health)}`;
        if (key !== lastResultKey) {
          lastResultKey = key;
          resultTitle.setText(`${t('raceFinished')} · ${result.distanceMeters} m`);
          const zeroToHundred = result.zeroToHundredSeconds === undefined
            ? '—'
            : `${result.zeroToHundredSeconds.toFixed(2)} s`;
          resultBody.setText([
            `${t('raceElapsed')}: ${result.elapsedSeconds.toFixed(3)} s`,
            `${t('raceReaction')}: ${result.reactionSeconds.toFixed(3)} s`,
            `${t('raceTrapSpeed')}: ${result.trapSpeedKph.toFixed(1)} km/h`,
            `0–100 km/h: ${zeroToHundred}`,
            `${t('raceGrip')}: ×${result.gripMultiplier.toFixed(2)} (${Math.round(result.tireWarmup)}%)`,
            `${t('raceEngine')}: ${Math.floor(engine.health)}%`,
          ].join('\n'));
        }
      } else {
        lastResultKey = '';
      }
    },
    layout: (width, height, layoutScale) => {
      statusText.setPosition(width / 2, 128 * layoutScale).setScale(layoutScale);
      lights.setPosition(width / 2, 176 * layoutScale).setScale(layoutScale);
      timerText.setPosition(width / 2, 40 * layoutScale).setScale(layoutScale);
      choosePanel.setPosition(width / 2, height * 0.42).setScale(layoutScale);
      resultPanel.setPosition(width / 2, height * 0.42).setScale(layoutScale);
    },
    destroy: () => {
      keyboard?.off('keydown', onKeyDown);
    },
  };
}

function createPanelBackground(
  scene: Phaser.Scene,
  width: number,
  height: number,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.fillStyle(palette.track, 0.94);
  graphics.lineStyle(3, palette.trackBorder, 1);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
  return graphics;
}

function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const button = scene.add.container(x, y);
  const background = scene.add.rectangle(0, 0, width, height, palette.accent, 1)
    .setStrokeStyle(2, palette.buttonBorder);
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '22px',
    color: '#f3f5f7',
  }).setOrigin(0.5);
  button.add([background, text]);
  background.setInteractive({ useHandCursor: true });
  background.on(Phaser.Input.Events.POINTER_OVER, () => button.setAlpha(0.85));
  background.on(Phaser.Input.Events.POINTER_OUT, () => button.setAlpha(1).setScale(1));
  background.on(Phaser.Input.Events.POINTER_DOWN, () => button.setScale(0.96));
  background.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    if (button.parentContainer?.visible) {
      onClick();
    }
  });
  return button;
}
