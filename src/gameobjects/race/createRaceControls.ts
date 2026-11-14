import Phaser from 'phaser';
import { palette } from '../../config/palette';

const PEDAL_WIDTH = 156;
const PEDAL_HEIGHT = 300;
const PADDLE_WIDTH = 82;
const PADDLE_HEIGHT = 220;
const SCREEN_EDGE_INSET = 82;
const PEDAL_BOTTOM_INSET = 58;
const WARMUP_BAR_TOP_OFFSET = 78;
const PADDLE_OFFSET_X = 460;
const PADDLE_OFFSET_Y = -190;
const WARMUP_TARGET_MIN = 70;
const WARMUP_TARGET_MAX = 80;
const WARMUP_EARLY_GREEN_MIN = 55;
const WARMUP_EARLY_GREEN_MAX = 65;
const WARMUP_PRE_TARGET_MIN = 65;
const WARMUP_PRE_TARGET_COLOR = 0xb59a31;
const WARMUP_TARGET_COLOR = 0x174d2b;
const WARMUP_COLOR_STOPS = [
  { value: 0, color: 0x55bde8 },
  { value: 30, color: 0x55b879 },
  { value: 60, color: 0xf0c94a },
  { value: 80, color: 0xe94b45 },
  { value: 100, color: 0xe94b45 },
] as const;

export interface RaceControls {
  container: Phaser.GameObjects.Container;
  isThrottlePressed: () => boolean;
  isBrakePressed: () => boolean;
  setTireWarmup: (value: number, throttlePressed: boolean) => void;
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
  const warmupBar = scene.add.graphics().setName('tire-warmup-bar').setVisible(false);
  container.add([brakePedal, acceleratorPedal, leftPaddle, rightPaddle, warmupBar]);
  makePaddleInteractive(leftPaddle, onShiftUp);
  makePaddleInteractive(rightPaddle, onShiftDown);

  let throttlePressed = false;
  let brakePressed = false;
  let activePointerId: number | undefined;
  let activeBrakePointerId: number | undefined;
  const throttleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  const brakeKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S);

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
    isThrottlePressed: () => throttlePressed || Boolean(throttleKey?.isDown),
    isBrakePressed: () => brakePressed || Boolean(brakeKey?.isDown),
    setTireWarmup: (value, isThrottlePressed) => {
      const visible = isThrottlePressed || value > 0;
      drawWarmupBar(warmupBar, value, visible);
    },
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
      if (throttleKey) {
        scene.input.keyboard?.removeKey(throttleKey);
      }
      if (brakeKey) {
        scene.input.keyboard?.removeKey(brakeKey);
      }
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

      const barPosition = localPosition(
        width / 2,
        WARMUP_BAR_TOP_OFFSET * layoutScale,
      );
      warmupBar
        .setPosition(barPosition.x, barPosition.y)
        .setScale(layoutScale / clusterScale);
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

function drawWarmupBar(
  graphics: Phaser.GameObjects.Graphics,
  value: number,
  visible: boolean,
): void {
  const width = 300;
  const height = 18;
  const inset = 3;
  graphics.clear().setVisible(visible);
  if (!visible) {
    return;
  }

  const innerWidth = width - inset * 2;
  const innerLeft = -width / 2 + inset;
  const barTop = -height / 2 + inset;
  const barHeight = height - inset * 2;

  graphics.fillStyle(0x252a29, 0.9);
  graphics.fillRect(innerLeft, barTop, innerWidth, barHeight);

  graphics.fillStyle(WARMUP_TARGET_COLOR, 0.95);
  graphics.fillRect(
    innerLeft + innerWidth * WARMUP_EARLY_GREEN_MIN / 100,
    barTop,
    innerWidth * (WARMUP_EARLY_GREEN_MAX - WARMUP_EARLY_GREEN_MIN) / 100,
    barHeight,
  );
  graphics.fillStyle(WARMUP_PRE_TARGET_COLOR, 0.95);
  graphics.fillRect(
    innerLeft + innerWidth * WARMUP_PRE_TARGET_MIN / 100,
    barTop,
    innerWidth * (WARMUP_TARGET_MIN - WARMUP_PRE_TARGET_MIN) / 100,
    barHeight,
  );
  graphics.fillStyle(WARMUP_TARGET_COLOR, 0.95);
  graphics.fillRect(
    innerLeft + innerWidth * WARMUP_TARGET_MIN / 100,
    barTop,
    innerWidth * (WARMUP_TARGET_MAX - WARMUP_TARGET_MIN) / 100,
    barHeight,
  );

  const clampedValue = Phaser.Math.Clamp(value, 0, 100);
  const fillWidth = innerWidth * clampedValue / 100;
  if (fillWidth > 0) {
    const fillSteps = Math.ceil(clampedValue);
    for (let step = 0; step < fillSteps; step += 1) {
      const startValue = clampedValue * step / fillSteps;
      const endValue = clampedValue * (step + 1) / fillSteps;
      const startX = innerLeft + innerWidth * startValue / 100;
      const endX = innerLeft + innerWidth * endValue / 100;
      graphics.fillStyle(getWarmupColor((startValue + endValue) / 2), 1);
      graphics.fillRect(startX, barTop, endX - startX, barHeight);
    }
  }

  graphics.lineStyle(2, palette.textPrimary, 0.9);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
}

function getWarmupColor(value: number): number {
  const upperStopIndex = WARMUP_COLOR_STOPS.findIndex((stop) => stop.value >= value);
  const nextStop = WARMUP_COLOR_STOPS[Math.max(upperStopIndex, 0)];
  const previousStop = WARMUP_COLOR_STOPS[Math.max(upperStopIndex - 1, 0)];
  const progress = nextStop.value === previousStop.value
    ? 0
    : (value - previousStop.value) / (nextStop.value - previousStop.value);
  const red = interpolateColorChannel(previousStop.color >> 16, nextStop.color >> 16, progress);
  const green = interpolateColorChannel(
    (previousStop.color >> 8) & 0xff,
    (nextStop.color >> 8) & 0xff,
    progress,
  );
  const blue = interpolateColorChannel(previousStop.color & 0xff, nextStop.color & 0xff, progress);

  return (red << 16) | (green << 8) | blue;
}

function interpolateColorChannel(from: number, to: number, progress: number): number {
  return Math.round(from + (to - from) * Phaser.Math.Clamp(progress, 0, 1));
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
