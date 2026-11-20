import Phaser from 'phaser';
import { palette } from '../../config/palette';

const PEDAL_WIDTH = 156;
const PEDAL_HEIGHT = 300;
const SHIFT_BUTTON_WIDTH = 132;
const SHIFT_BUTTON_HEIGHT = 168;
/** Gap between the two shift buttons (cluster-local pixels). */
const SHIFT_BUTTON_GAP = 26;
/** Larger gap between the brake and the shift buttons, so the brake is not hit by accident. */
const BRAKE_TO_SHIFT_GAP = 110;
const SCREEN_EDGE_INSET = 82;
const PEDAL_BOTTOM_INSET = 58;
/** Extra lift of the pedals as a share of the screen height (easier to reach on phones). */
const PEDAL_LIFT_SCREEN_RATIO = 0.05;

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
  const upshiftButton = drawShiftButton(scene, 'upshift-button', 'up');
  const downshiftButton = drawShiftButton(scene, 'downshift-button', 'down');
  container.add([brakePedal, acceleratorPedal, upshiftButton, downshiftButton]);
  makeShiftButtonInteractive(upshiftButton, onShiftUp);
  makeShiftButtonInteractive(downshiftButton, onShiftDown);

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

      const pedalY = height - PEDAL_BOTTOM_INSET * layoutScale - height * PEDAL_LIFT_SCREEN_RATIO;
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
      // Shift buttons in a row right of the brake: upshift first, then downshift.
      const upshiftX = brakePosition.x + PEDAL_WIDTH / 2 + BRAKE_TO_SHIFT_GAP + SHIFT_BUTTON_WIDTH / 2;
      const shiftY = brakePosition.y + (PEDAL_HEIGHT - SHIFT_BUTTON_HEIGHT) / 2;
      upshiftButton.setPosition(upshiftX, shiftY);
      downshiftButton.setPosition(upshiftX + SHIFT_BUTTON_WIDTH + SHIFT_BUTTON_GAP, shiftY);
    },
  };
}

function makeShiftButtonInteractive(
  button: Phaser.GameObjects.Graphics,
  onShift: () => void,
): void {
  button.setInteractive(
    new Phaser.Geom.Rectangle(
      -SHIFT_BUTTON_WIDTH / 2,
      -SHIFT_BUTTON_HEIGHT / 2,
      SHIFT_BUTTON_WIDTH,
      SHIFT_BUTTON_HEIGHT,
    ),
    Phaser.Geom.Rectangle.Contains,
  );
  // Shift on press (like a real paddle) so timing does not depend on releasing the finger.
  button.on(Phaser.Input.Events.POINTER_DOWN, () => {
    button.setScale(0.92).setAlpha(0.85);
    onShift();
  });
  const release = (): void => {
    button.setScale(1).setAlpha(1);
  };
  button.on(Phaser.Input.Events.POINTER_UP, release);
  button.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
  button.on(Phaser.Input.Events.POINTER_OUT, release);
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

function drawShiftButton(
  scene: Phaser.Scene,
  name: string,
  direction: 'up' | 'down',
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setName(name);
  const halfWidth = SHIFT_BUTTON_WIDTH / 2;
  const halfHeight = SHIFT_BUTTON_HEIGHT / 2;
  const isUp = direction === 'up';
  const accentColor = isUp ? palette.accent : palette.textSecondary;

  // Rounded key, same style family as the pedals.
  graphics.fillStyle(palette.track, 0.96);
  graphics.lineStyle(7, accentColor, 1);
  graphics.fillRoundedRect(-halfWidth, -halfHeight, SHIFT_BUTTON_WIDTH, SHIFT_BUTTON_HEIGHT, 22);
  graphics.strokeRoundedRect(-halfWidth, -halfHeight, SHIFT_BUTTON_WIDTH, SHIFT_BUTTON_HEIGHT, 22);

  // Double chevron pointing up or down.
  // Up: tips at the top, arms going down. Down: tips at the bottom, arms going up.
  const armRise = isUp ? 24 : -24;
  const tips = isUp ? [-52, -18] : [-14, 20];
  graphics.lineStyle(12, accentColor, 1);
  tips.forEach((tipY) => {
    graphics.beginPath();
    graphics.moveTo(-32, tipY + armRise);
    graphics.lineTo(0, tipY);
    graphics.lineTo(32, tipY + armRise);
    graphics.strokePath();
  });

  // "+" / "−" marker at the bottom of the key.
  graphics.lineStyle(7, palette.textPrimary, 0.9);
  graphics.lineBetween(-12, halfHeight - 28, 12, halfHeight - 28);
  if (isUp) {
    graphics.lineBetween(0, halfHeight - 40, 0, halfHeight - 16);
  }

  return graphics;
}
