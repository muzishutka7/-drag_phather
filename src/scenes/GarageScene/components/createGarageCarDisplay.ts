import Phaser from 'phaser';
import type { CarDefinition } from '../../../gameobjects/cars/carCatalog';
import { getCarStats } from '../../../gameobjects/cars/carStats';
import { REFERENCE_CAR_LENGTH_MM } from '../../../gameobjects/cars/carVisuals';
import { createCarModel, type CarModel } from '../../../gameobjects/cars/createCarModel';
import { getGraphicsQuality } from '../../../settings/graphicsQuality';
import { carParts, getPartHealth, setPartHealth, type CarPart } from '../../../state/partHealth';
import {
  CAR_STATS_PANEL_HEIGHT,
  CAR_STATS_PANEL_WIDTH,
  createCarStatsPanel,
  type CarStatsPanel,
} from './createCarStatsPanel';
import { createCarSwitcher } from './createCarSwitcher';
import { openRepairDialog } from './createRepairDialog';

const PANEL_MARGIN = 20;
const PANEL_TOP = 70;
/** On-screen length of a REFERENCE_CAR_LENGTH_MM car at layout scale 1 (960×540 layout pixels). */
const CAR_LENGTH_PX = 600;
/** The switch arrows sit at half the height of a typical saloon, whatever car is shown. */
const ARROW_HEIGHT_MM = 725;
const ARROW_SIZE = 44;

/**
 * Entering the garage: the car fades in while shrinking from this size, right
 * away and together with the background settling into its dim + blur.
 */
const ENTRANCE_DELAY_MS = 0;
const ENTRANCE_DURATION_MS = 700;
const ENTRANCE_START_SCALE = 1.15;
/**
 * Switching cars: the old one rolls out first, the new one rolls in from the
 * other side once the old one is mostly gone, so they never overlap.
 */
const SWITCH_OUT_MS = 320;
const SWITCH_IN_DELAY_MS = 240;
const SWITCH_IN_MS = 440;
/** Rolling distance as a share of the screen width: far enough to leave the screen. */
const SWITCH_DISTANCE_SHARE = 1;

export interface GarageCarDisplay {
  container: Phaser.GameObjects.Container;
  /** Call every frame (drives the check-engine blinking). */
  update: (timeMs: number) => void;
}

export interface GarageCarDisplayOptions {
  cars: readonly CarDefinition[];
  /** Car shown first. */
  index: number;
  /** Play the "car appears" animation (on entering the garage, not on resize). */
  entrance: boolean;
  /** The player picked another car with the arrows. */
  onSelect: (car: CarDefinition) => void;
}

interface ShownCar {
  car: CarDefinition;
  model: CarModel;
  /** Resting x of the car. */
  x: number;
}

/** The player's car in the garage with the stats panel on the right. */
export function createGarageCarDisplay(
  scene: Phaser.Scene,
  width: number,
  height: number,
  scale: number,
  options: GarageCarDisplayOptions,
): GarageCarDisplay {
  const { cars } = options;
  const container = scene.add.container(0, 0).setName('garage-car-display');
  const carLayer = scene.add.container(0, 0);
  container.add(carLayer);

  // --- Stats panel on the right, scaled down if the screen is short ---
  const panelScale = Math.min(
    scale,
    (height - (PANEL_TOP + PANEL_MARGIN) * scale) / CAR_STATS_PANEL_HEIGHT,
  );
  const panelWidth = CAR_STATS_PANEL_WIDTH * panelScale;
  const panelX = width - PANEL_MARGIN * scale - panelWidth / 2;
  const panelY = PANEL_TOP * scale + (CAR_STATS_PANEL_HEIGHT * panelScale) / 2;

  // --- Cars in the free space on the left ---
  const freeWidth = width - panelWidth - PANEL_MARGIN * scale * 2;
  // The car may tuck slightly under the stats panel, so it can be big on narrow screens.
  // Every car is drawn at the same mm scale, so their sizes compare honestly.
  const pxPerMm = Math.min(CAR_LENGTH_PX * scale, freeWidth * 1.05) / REFERENCE_CAR_LENGTH_MM;
  const carGroundY = height * 0.9;
  const getCarX = (car: CarDefinition): number => {
    const carLengthPx = car.visual.lengthMm * pxPerMm;
    return Math.max(carLengthPx / 2 + PANEL_MARGIN * scale * 0.5, freeWidth / 2 + PANEL_MARGIN * scale);
  };

  let index = options.index;
  let shown: ShownCar | undefined;

  const showCar = (car: CarDefinition): ShownCar => {
    const model = createCarModel(scene, car.visual, getGraphicsQuality());
    const x = getCarX(car);
    model.container.setPosition(x, carGroundY).setScale(pxPerMm);
    carLayer.add(model.container);
    return { car, model, x };
  };

  /** Turns the wheels as if the car rolled from its resting place to where it is now. */
  const rollWheels = (target: ShownCar): void => {
    const travelledPx = target.model.container.x - target.x;
    (['rear', 'front'] as const).forEach((axle) => {
      const axleVisual = axle === 'rear' ? target.car.visual.rearAxle : target.car.visual.frontAxle;
      const tireRadiusPx = 333 * axleVisual.wheelScale * pxPerMm;
      target.model.setWheelRotation(axle, travelledPx / tireRadiusPx);
    });
  };

  shown = showCar(cars[index]);
  if (options.entrance) {
    shown.model.container
      .setAlpha(0)
      .setScale(pxPerMm * ENTRANCE_START_SCALE);
    scene.tweens.add({
      targets: shown.model.container,
      alpha: 1,
      scale: pxPerMm,
      delay: ENTRANCE_DELAY_MS,
      duration: ENTRANCE_DURATION_MS,
      ease: 'Cubic.easeOut',
    });
  }

  const switchCar = (step: -1 | 1): void => {
    const previous = shown;
    if (!previous) {
      return;
    }
    // A click during an animation: finish it at once and go on from there.
    scene.tweens.killTweensOf(previous.model.container);
    previous.model.container.setPosition(previous.x, carGroundY).setScale(pxPerMm).setAlpha(1);
    carLayer.list
      .filter((child) => child !== previous.model.container)
      .forEach((child) => {
        scene.tweens.killTweensOf(child);
        child.destroy();
      });

    index = (index + step + cars.length) % cars.length;
    const next = showCar(cars[index]);
    shown = next;
    switcher?.setIndex(index);
    buildPanel();
    options.onSelect(next.car);

    // "›" brings the next car in from the right, "‹" from the left.
    const distance = width * SWITCH_DISTANCE_SHARE;
    scene.tweens.add({
      targets: previous.model.container,
      x: previous.x - step * distance,
      alpha: 0,
      duration: SWITCH_OUT_MS,
      ease: 'Cubic.easeIn',
      onUpdate: () => rollWheels(previous),
      onComplete: () => previous.model.container.destroy(),
    });
    next.model.container.setX(next.x + step * distance).setAlpha(0);
    rollWheels(next);
    scene.tweens.add({
      targets: next.model.container,
      x: next.x,
      alpha: 1,
      delay: SWITCH_IN_DELAY_MS,
      duration: SWITCH_IN_MS,
      ease: 'Cubic.easeOut',
      onUpdate: () => rollWheels(next),
    });
  };

  // --- Arrows: left one near the screen edge, right one next to the panel ---
  const switcher = cars.length > 1
    ? createCarSwitcher(scene, scale, {
      leftX: PANEL_MARGIN * scale + (ARROW_SIZE * scale) / 2,
      rightX: panelX - panelWidth / 2 - PANEL_MARGIN * scale * 0.5 - (ARROW_SIZE * scale) / 2,
      y: carGroundY - ARROW_HEIGHT_MM * pxPerMm,
      counterX: freeWidth / 2 + PANEL_MARGIN * scale,
      counterY: (carGroundY + height) / 2,
    }, {
      index,
      count: cars.length,
      onChange: (step) => switchCar(step),
    })
    : undefined;
  if (switcher) {
    container.add(switcher.container);
  }

  let panel: CarStatsPanel | undefined;
  function buildPanel(): void {
    panel?.container.destroy(true);
    const { profile } = cars[index];
    const condition = Object.fromEntries(
      carParts.map((part) => [part, getPartHealth(profile.id, part)]),
    ) as Record<CarPart, number>;
    const engineHealth = condition.engine;
    panel = createCarStatsPanel(scene, {
      title: profile.name,
      subtitle: `${profile.engineCode} · ${profile.displacementCc} cc · ${profile.tires.name}`,
      stats: getCarStats(profile, engineHealth),
      potential: engineHealth < 99.95 ? getCarStats(profile, 100) : undefined,
      condition,
      onPartSelected: (part) => openRepairDialog(scene, {
        part,
        health: condition[part],
        onConfirm: () => {
          setPartHealth(profile.id, part, 100);
          // Rebuild after the click has been handled.
          scene.time.delayedCall(0, buildPanel);
        },
      }),
    });
    panel.container.setPosition(panelX, panelY).setScale(panelScale);
    container.add(panel.container);
  }
  buildPanel();

  return {
    container,
    update: (timeMs) => panel?.update(timeMs),
  };
}
