import Phaser from 'phaser';
import { palette } from './palette';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: palette.background,
  scene: [BootScene, MainMenuScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
