import Phaser from 'phaser';
import {
  getBackgroundKey,
  getBackgroundUrl,
  preloadBackground,
} from '../../assets/backgrounds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import {
  getGraphicsQuality,
  graphicsQualities,
  setGraphicsQuality,
  type GraphicsQuality,
} from '../../settings/graphicsQuality';
import { getRenderResolution, getRenderResolutionScale } from '../../settings/renderResolution';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { createUiText } from '../../ui/createUiText';

const BACKGROUND_NAME = 'sunny-garage';

export class GarageScene extends Phaser.Scene {
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private backgroundOverlay?: Phaser.GameObjects.Graphics;
  private activeQuality: GraphicsQuality = 'medium';
  private graphicsSettings?: GraphicsSettings;
  private settingsOpen = false;
  private isBackgroundLoading = false;
  private uiContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('GarageScene');
  }

  preload(): void {
    this.activeQuality = getGraphicsQuality();
    this.backgroundKey = preloadBackground(this, BACKGROUND_NAME, this.activeQuality);
  }

  create(): void {
    this.applyRenderResolution();
    this.createBackground();
    graphicsQualities.forEach((quality) => {
      const introBackgroundKey = getBackgroundKey('sunset-drift', quality);
      if (this.textures.exists(introBackgroundKey)) {
        this.textures.remove(introBackgroundKey);
      }
    });
    this.drawGarage(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.addEventListener('resize', this.handleViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      window.removeEventListener('resize', this.handleViewportResize);
    });
  }

  private handleViewportResize = (): void => {
    this.applyRenderResolution();
  };

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutBackground(gameSize.width, gameSize.height);
    this.drawGarage(gameSize.width, gameSize.height);
  }

  private createBackground(): void {
    if (!this.textures.exists(this.backgroundKey)) {
      console.error(`Garage background failed to load: ${this.backgroundKey}`);
      return;
    }

    this.backgroundImage = this.add.image(0, 0, this.backgroundKey).setDepth(-2);
    this.backgroundOverlay = this.add.graphics().setDepth(-1);
    this.layoutBackground(this.scale.width, this.scale.height);
  }

  private layoutBackground(width: number, height: number): void {
    if (this.backgroundImage) {
      this.backgroundImage
        .setPosition(width / 2, height / 2)
        .setScale(Math.max(
          width / this.backgroundImage.width,
          height / this.backgroundImage.height,
        ));
    }

    this.backgroundOverlay?.clear();
    this.backgroundOverlay?.fillStyle(palette.background, 0.3);
    this.backgroundOverlay?.fillRect(0, 0, width, height);
  }

  private drawGarage(width: number, height: number): void {
    this.uiContainer?.destroy(true);
    this.uiContainer = this.add.container(0, 0);

    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    this.uiContainer.add(
      createUiText(this, width / 2, height * 0.16, 'garageTitle', 'title', scale),
    );

    this.graphicsSettings = createGraphicsSettings(
      this,
      width - 34 * scale,
      34 * scale,
      scale,
      (quality) => this.changeBackgroundQuality(quality),
      () => this.applyRenderResolution(),
      () => this.drawGarage(this.scale.width, this.scale.height),
      (isOpen) => {
        this.settingsOpen = isOpen;
      },
      this.settingsOpen,
    );
    this.graphicsSettings.container.setDepth(10);
    this.graphicsSettings.qualitySelector.setEnabled(!this.isBackgroundLoading);
    this.graphicsSettings.resolutionSelector.setEnabled(!this.isBackgroundLoading);
    this.uiContainer.add(this.graphicsSettings.container);
  }

  private applyRenderResolution(): void {
    const renderScale = getRenderResolutionScale(getRenderResolution());
    const width = Math.max(1, Math.round(window.innerWidth * renderScale));
    const height = Math.max(1, Math.round(window.innerHeight * renderScale));

    if (this.scale.width !== width || this.scale.height !== height) {
      this.scale.resize(width, height);
    }

    this.game.canvas.style.width = '100%';
    this.game.canvas.style.height = '100%';
  }

  private changeBackgroundQuality(quality: GraphicsQuality): void {
    const key = getBackgroundKey(BACKGROUND_NAME, quality);

    if (this.textures.exists(key)) {
      this.applyBackground(key, quality);
      return;
    }

    this.isBackgroundLoading = true;
    this.graphicsSettings?.qualitySelector.setEnabled(false);
    this.graphicsSettings?.resolutionSelector.setEnabled(false);
    this.load.image(key, getBackgroundUrl(BACKGROUND_NAME, quality));

    const onComplete = (): void => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.isBackgroundLoading = false;
      this.applyBackground(key, quality);
    };

    const onError = (file: Phaser.Loader.File): void => {
      if (file.key !== key) {
        return;
      }

      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.load.off(`filecomplete-image-${key}`, onComplete);
      this.isBackgroundLoading = false;
      console.error(`Garage background failed to load (${quality}): ${file.src}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.qualitySelector.setEnabled(true);
      this.graphicsSettings?.resolutionSelector.setEnabled(true);
    };

    this.load.once(`filecomplete-image-${key}`, onComplete);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    this.load.start();
  }

  private applyBackground(key: string, quality: GraphicsQuality): void {
    const previousKey = this.backgroundKey;
    this.backgroundImage?.setTexture(key);
    this.backgroundKey = key;
    this.activeQuality = quality;

    if (previousKey && previousKey !== key && this.textures.exists(previousKey)) {
      this.textures.remove(previousKey);
    }

    this.graphicsSettings?.qualitySelector.refresh();
    this.graphicsSettings?.qualitySelector.setEnabled(true);
    this.graphicsSettings?.resolutionSelector.setEnabled(true);
    this.layoutBackground(this.scale.width, this.scale.height);
  }
}
