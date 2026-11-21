import Phaser from 'phaser';
import { ASSET_PRELOAD_SCENE_KEY } from '../assets/AssetPreloadScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // The shared background loader runs alongside every other scene.
    this.scene.launch(ASSET_PRELOAD_SCENE_KEY);
    this.scene.start('IntroScene');
  }
}
