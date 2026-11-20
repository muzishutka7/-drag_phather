import Phaser from 'phaser';
import type { CarEngineProfile } from '../../../gameobjects/cars/carProfiles';
import { getCarStats } from '../../../gameobjects/cars/carStats';
import { LANOS_VISUAL } from '../../../gameobjects/cars/carVisuals';
import { createCarModel } from '../../../gameobjects/cars/createCarModel';
import { getGraphicsQuality } from '../../../settings/graphicsQuality';
import { getEngineHealth, setEngineHealth } from '../../../state/engineHealth';
import {
  CAR_STATS_PANEL_HEIGHT,
  CAR_STATS_PANEL_WIDTH,
  createCarStatsPanel,
  type CarStatsPanel,
} from './createCarStatsPanel';

const PANEL_MARGIN = 20;
const PANEL_TOP = 70;
/** On-screen car length at layout scale 1 (960×540 layout pixels). */
const CAR_LENGTH_PX = 600;

export interface GarageCarDisplay {
  container: Phaser.GameObjects.Container;
  /** Call every frame (drives the check-engine blinking). */
  update: (timeMs: number) => void;
}

/** The player's car in the garage with the stats panel on the right. */
export function createGarageCarDisplay(
  scene: Phaser.Scene,
  width: number,
  height: number,
  scale: number,
  profile: CarEngineProfile,
): GarageCarDisplay {
  const container = scene.add.container(0, 0).setName('garage-car-display');

  // --- Stats panel on the right, scaled down if the screen is short ---
  const panelScale = Math.min(
    scale,
    (height - (PANEL_TOP + PANEL_MARGIN) * scale) / CAR_STATS_PANEL_HEIGHT,
  );
  const panelWidth = CAR_STATS_PANEL_WIDTH * panelScale;
  const panelX = width - PANEL_MARGIN * scale - panelWidth / 2;
  const panelY = PANEL_TOP * scale + (CAR_STATS_PANEL_HEIGHT * panelScale) / 2;

  // --- Car in the free space on the left ---
  const freeWidth = width - panelWidth - PANEL_MARGIN * scale * 2;
  // The car may tuck slightly under the stats panel, so it can be big on narrow screens.
  const carLengthPx = Math.min(CAR_LENGTH_PX * scale, freeWidth * 1.05);
  const carX = Math.max(carLengthPx / 2 + PANEL_MARGIN * scale * 0.5, freeWidth / 2 + PANEL_MARGIN * scale);
  const carGroundY = height * 0.9;
  const car = createCarModel(scene, LANOS_VISUAL, getGraphicsQuality());
  car.container
    .setPosition(carX, carGroundY)
    .setScale(carLengthPx / LANOS_VISUAL.lengthMm);
  container.add(car.container);

  let panel: CarStatsPanel | undefined;
  const buildPanel = (): void => {
    panel?.container.destroy(true);
    const engineHealth = getEngineHealth(profile.id);
    panel = createCarStatsPanel(scene, {
      title: profile.name,
      subtitle: `${profile.engineCode} · ${profile.displacementCc} cc · ${profile.tires.name}`,
      stats: getCarStats(profile, engineHealth),
      engineHealth,
      onRepair: () => {
        setEngineHealth(profile.id, 100);
        // Rebuild after the click has been handled (the button is destroyed by the rebuild).
        scene.time.delayedCall(0, buildPanel);
      },
    });
    panel.container.setPosition(panelX, panelY).setScale(panelScale);
    container.add(panel.container);
  };
  buildPanel();

  return {
    container,
    update: (timeMs) => panel?.update(timeMs),
  };
}
