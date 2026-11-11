import Phaser from 'phaser';
import { palette } from './palette';
import { getRenderResolutionScale } from '../settings/renderResolution';
import { getFrameRate } from '../settings/frameRate';
import { BootScene } from '../scenes/BootScene';
import { GarageScene } from '../scenes/GarageScene/GarageScene';
import { IntroScene } from '../scenes/IntroScene/IntroScene';
import { PartsStoreScene } from '../scenes/PartsStoreScene/PartsStoreScene';
import { RaceScene } from '../scenes/RaceScene/RaceScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: Math.round(GAME_WIDTH * getRenderResolutionScale()),
  height: Math.round(GAME_HEIGHT * getRenderResolutionScale()),
  parent: 'app',
  backgroundColor: palette.background,
  fps: {
    target: 60,
    limit: getFrameRate(),
  },
  scene: [BootScene, IntroScene, GarageScene, PartsStoreScene, RaceScene],
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
