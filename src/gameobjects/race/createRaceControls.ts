import Phaser from 'phaser';
import { palette } from '../../config/palette';

const PEDAL_WIDTH = 156;
const PEDAL_HEIGHT = 300;
const PADDLE_WIDTH = 82;
const PADDLE_HEIGHT = 220;
const SCREEN_EDGE_INSET = 82;
const PEDAL_BOTTOM_INSET = 58;
const PADDLE_OFFSET_X = 460;
const PADDLE_OFFSET_Y = -190;

export interface RaceControls {
  container: Phaser.GameObjects.Container;
  isThrottlePressed: () => boolean;
  isBrakePressed: () => boolean;
  destroy: () => void;
  layout: (
    width: number,
    height: number,
    layoutScale: number,
    clusterX: number,
    clusterY: number,
    clusterScale: number,
  ) => void;
}

export function createRaceControls(
  scene: Phaser.Scene,
  onShiftUp: () => void,
  onShiftDown: () => void,
): RaceControls {
  const container = scene.add.container(0, 0).setName('race-controls');
  const brakePedal = drawPedal(scene, 'brake-pedal', 0xb83b39);
  const acceleratorPedal = drawPedal(scene, 'accelerator-pedal', palette.accent);
  const leftPaddle = drawPaddle(scene, 'upshift-paddle', true);
  const rightPaddle = drawPaddle(scene, 'downshift-paddle', false);
  container.add([brakePedal, acceleratorPedal, leftPaddle, rightPaddle]);
  makePaddleInteractive(leftPaddle, onShiftUp);
  makePaddleInteractive(rightPaddle, onShiftDown);

  let throttlePressed = false;
  let brakePressed = false;
  let activePointerId: number | undefined;
  let activeBrakePointerId: number | undefined;
  const keyboard = scene.input.keyboard;
  const throttleKeys = [
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
  ];
  const brakeKeys = [
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
  ];
  const shiftUpKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  const shiftDownKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
  shiftUpKey?.on('down', onShiftUp);
  shiftDownKey?.on('down', onShiftDown);
  const anyDown = (keys: Array<Phaser.Input.Keyboard.Key | undefined>): boolean => (
    keys.some((key) => Boolean(key?.isDown))
  );

  const releaseThrottle = (pointer: Phaser.Input.Pointer): void => {
    if (!throttlePressed || (pointer && pointer.id !== activePointerId)) {
      return;
    }

    throttlePressed = false;
    activePointerId = undefined;
    acceleratorPedal.setScale(1).setAlpha(1);
  };

  acceleratorPedal.setInteractive(
    new Phaser.Geom.Rectangle(
      -PEDAL_WIDTH / 2,
      -PEDAL_HEIGHT / 2,
      PEDAL_WIDTH,
      PEDAL_HEIGHT,
    ),
    Phaser.Geom.Rectangle.Contains,
  );
  acceleratorPedal.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
    if (throttlePressed) {
      return;
    }

    throttlePressed = true;
    activePointerId = pointer.id;
    acceleratorPedal.setScale(0.96).setAlpha(0.82);
  });
  acceleratorPedal.on(Phaser.Input.Events.POINTER_UP, releaseThrottle);
  acceleratorPedal.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, releaseThrottle);
  scene.input.on(Phaser.Input.Events.POINTER_UP, releaseThrottle);

  const releaseBrake = (pointer: Phaser.Input.Pointer): void => {
    if (!brakePressed || (pointer && pointer.id !== activeBrakePointerId)) {
      return;
    }

    brakePressed = false;
    activeBrakePointerId = undefined;
    brakePedal.setScale(1).setAlpha(1);
  };
  brakePedal.setInteractive(
    new Phaser.Geom.Rectangle(
      -PEDAL_WIDTH / 2,
      -PEDAL_HEIGHT / 2,
      PEDAL_WIDTH,
      PEDAL_HEIGHT,
    ),
    Phaser.Geom.Rectangle.Contains,
  );
  brakePedal.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
    if (brakePressed) {
      return;
    }

    brakePressed = true;
    activeBrakePointerId = pointer.id;
    brakePedal.setScale(0.96).setAlpha(0.82);
  });
  brakePedal.on(Phaser.Input.Events.POINTER_UP, releaseBrake);
  brakePedal.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, releaseBrake);
  scene.input.on(Phaser.Input.Events.POINTER_UP, releaseBrake);

  return {
    container,
    isThrottlePressed: () => throttlePressed || anyDown(throttleKeys),
    isBrakePressed: () => brakePressed || anyDown(brakeKeys),
    destroy: () => {
      if (throttlePressed) {
        throttlePressed = false;
        acceleratorPedal.setScale(1).setAlpha(1);
      }
      if (brakePressed) {
        brakePressed = false;
        brakePedal.setScale(1).setAlpha(1);
      }
      activePointerId = undefined;
      activeBrakePointerId = undefined;
      scene.input.off(Phaser.Input.Events.POINTER_UP, releaseThrottle);
      scene.input.off(Phaser.Input.Events.POINTER_UP, releaseBrake);
      [...throttleKeys, ...brakeKeys, shiftUpKey, shiftDownKey].forEach((key) => {
        if (key) {
          key.removeAllListeners();
          keyboard?.removeKey(key);
        }
      });
    },
    layout: (width, height, layoutScale, clusterX, clusterY, clusterScale) => {
      const localPosition = (screenX: number, screenY: number) => ({
        x: (screenX - clusterX) / clusterScale,
        y: (screenY - clusterY) / clusterScale,
      });

      const pedalY = height - PEDAL_BOTTOM_INSET * layoutScale;
      const brakePosition = localPosition(
        SCREEN_EDGE_INSET * layoutScale,
        pedalY,
      );
      const acceleratorPosition = localPosition(
        width - SCREEN_EDGE_INSET * layoutScale,
        pedalY,
      );
      brakePedal.setPosition(brakePosition.x, brakePosition.y);
      acceleratorPedal.setPosition(acceleratorPosition.x, acceleratorPosition.y);
      leftPaddle.setPosition(-PADDLE_OFFSET_X, PADDLE_OFFSET_Y);
      rightPaddle.setPosition(PADDLE_OFFSET_X, PADDLE_OFFSET_Y);
    },
  };
}

function makePaddleInteractive(
  paddle: Phaser.GameObjects.Graphics,
  onShift: () => void,
): void {
  paddle.setInteractive(
    new Phaser.Geom.Rectangle(
      -PADDLE_WIDTH / 2,
      -PADDLE_HEIGHT / 2,
      PADDLE_WIDTH,
      PADDLE_HEIGHT,
    ),
    Phaser.Geom.Rectangle.Contains,
  );
  paddle.on(Phaser.Input.Events.POINTER_DOWN, () => paddle.setScale(0.94));
  paddle.on(Phaser.Input.Events.POINTER_UP, () => {
    paddle.setScale(1);
    onShift();
  });
  paddle.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => paddle.setScale(1));
  paddle.on(Phaser.Input.Events.POINTER_OUT, () => paddle.setScale(1));
}

function drawPedal(
  scene: Phaser.Scene,
  name: string,
  accentColor: number,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setName(name);
  const halfWidth = PEDAL_WIDTH / 2;
  const halfHeight = PEDAL_HEIGHT / 2;

  graphics.fillStyle(palette.track, 0.96);
  graphics.lineStyle(7, accentColor, 1);
  graphics.fillRoundedRect(-halfWidth, -halfHeight, PEDAL_WIDTH, PEDAL_HEIGHT, 18);
  graphics.strokeRoundedRect(-halfWidth, -halfHeight, PEDAL_WIDTH, PEDAL_HEIGHT, 18);

  graphics.lineStyle(9, palette.textSecondary, 0.9);
  for (let y = -82; y <= 82; y += 41) {
    graphics.beginPath();
    graphics.moveTo(-46, y);
    graphics.lineTo(46, y);
    graphics.strokePath();
  }

  graphics.fillStyle(accentColor, 0.95);
  graphics.fillCircle(0, -halfHeight + 40, 9);

  return graphics;
}

function drawPaddle(
  scene: Phaser.Scene,
  name: string,
  isPlus: boolean,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setName(name);
  const halfWidth = PADDLE_WIDTH / 2;
  const halfHeight = PADDLE_HEIGHT / 2;
  const accentColor = isPlus ? palette.accent : palette.textSecondary;

  graphics.fillStyle(palette.track, 0.96);
  graphics.lineStyle(5, accentColor, 1);
  graphics.beginPath();
  graphics.moveTo(-halfWidth + 8, -halfHeight);
  graphics.lineTo(halfWidth - 8, -halfHeight);
  graphics.lineTo(halfWidth, halfHeight - 22);
  graphics.lineTo(0, halfHeight);
  graphics.lineTo(-halfWidth, halfHeight - 22);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  graphics.lineStyle(7, accentColor, 1);
  graphics.beginPath();
  graphics.moveTo(-20, -8);
  graphics.lineTo(20, -8);
  if (isPlus) {
    graphics.moveTo(0, -28);
    graphics.lineTo(0, 12);
  }
  graphics.strokePath();

  return graphics;
}
