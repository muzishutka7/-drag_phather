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
import { createGarageBackButton } from '../GarageScene/components/createGarageBackButton';

const BACKGROUND_NAME = 'parts-garage';

export class PartsStoreScene extends Phaser.Scene {
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private backgroundOverlay?: Phaser.GameObjects.Graphics;
  private activeQuality: GraphicsQuality = 'medium';
  private graphicsSettings?: GraphicsSettings;
  private settingsOpen = false;
  private isBackgroundLoading = false;
  private isTransitioning = false;
  private baseBackgroundScale = 1;
  private uiContainer?: Phaser.GameObjects.Container;
  private backButton?: Phaser.GameObjects.Container;
  private incomingBackground?: Phaser.GameObjects.Image;
  private incomingBackgroundKey = '';
  private transitionBackgroundReady = false;
  private transitionAnimationReady = false;

  constructor() {
    super('PartsStoreScene');
  }

  init(): void {
    this.isBackgroundLoading = false;
    this.isTransitioning = false;
    this.transitionBackgroundReady = false;
    this.transitionAnimationReady = false;
    this.incomingBackground = undefined;
    this.incomingBackgroundKey = '';
  }

  preload(): void {
    this.activeQuality = getGraphicsQuality();
    this.backgroundKey = preloadBackground(this, BACKGROUND_NAME, this.activeQuality);
  }

  create(): void {
    this.applyRenderResolution();
    this.createBackground();
    graphicsQualities.forEach((quality) => {
      const garageBackgroundKey = getBackgroundKey('sunny-garage', quality);
      if (this.textures.exists(garageBackgroundKey)) {
        this.textures.remove(garageBackgroundKey);
      }
    });
    this.drawStore(this.scale.width, this.scale.height);
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

    if (!this.isTransitioning) {
      this.drawStore(gameSize.width, gameSize.height);
    }
  }

  private createBackground(): void {
    if (!this.textures.exists(this.backgroundKey)) {
      console.error(`Parts store background failed to load: ${this.backgroundKey}`);
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
      this.baseBackgroundScale = this.backgroundImage.scale;
    }

    this.backgroundOverlay?.clear();
    this.backgroundOverlay?.fillStyle(palette.background, 0.3);
    this.backgroundOverlay?.fillRect(0, 0, width, height);
  }

  private drawStore(width: number, height: number): void {
    this.uiContainer?.destroy(true);
    this.uiContainer = this.add.container(0, 0);

    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    this.backButton = createGarageBackButton(
      this,
      34 * scale,
      34 * scale,
      scale,
      () => this.startGarageTransition(),
    );
    this.uiContainer.add(this.backButton);

    this.graphicsSettings = createGraphicsSettings(
      this,
      width - 34 * scale,
      34 * scale,
      scale,
      (quality) => this.changeBackgroundQuality(quality),
      () => this.applyRenderResolution(),
      () => this.drawStore(this.scale.width, this.scale.height),
      (isOpen) => {
        this.settingsOpen = isOpen;
      },
      this.settingsOpen,
    );
    this.graphicsSettings.container.setDepth(10);
    this.backButton.setDepth(10);
    this.graphicsSettings.setEnabled(!this.isBackgroundLoading);
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

  private startGarageTransition(): void {
    if (this.isTransitioning || this.isBackgroundLoading || !this.backButton || !this.backgroundImage) {
      return;
    }

    this.isTransitioning = true;
    this.transitionBackgroundReady = false;
    this.transitionAnimationReady = false;
    this.backButton.disableInteractive();
    this.graphicsSettings?.setEnabled(false);

    const quality = this.activeQuality;
    this.incomingBackgroundKey = getBackgroundKey('sunny-garage', quality);

    this.tweens.add({
      targets: this.backButton,
      alpha: 0,
      scale: 1.3,
      duration: 180,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.time.delayedCall(150, () => {
          this.transitionAnimationReady = true;
          this.tryStartGarageBackgroundTransition();
        });
      },
    });

    if (this.textures.exists(this.incomingBackgroundKey)) {
      this.transitionBackgroundReady = true;
      this.tryStartGarageBackgroundTransition();
      return;
    }

    this.load.image(
      this.incomingBackgroundKey,
      getBackgroundUrl('sunny-garage', quality),
    );

    const onComplete = (): void => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.transitionBackgroundReady = true;
      this.tryStartGarageBackgroundTransition();
    };

    const onError = (file: Phaser.Loader.File): void => {
      if (file.key !== this.incomingBackgroundKey) {
        return;
      }

      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.load.off(`filecomplete-image-${this.incomingBackgroundKey}`, onComplete);
      console.error(`Garage background failed to load: ${file.src}`);
      this.cancelTransition();
    };

    this.load.once(`filecomplete-image-${this.incomingBackgroundKey}`, onComplete);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    this.load.start();
  }

  private tryStartGarageBackgroundTransition(): void {
    if (!this.isTransitioning || !this.transitionAnimationReady || !this.transitionBackgroundReady) {
      return;
    }

    this.incomingBackground = this.add.image(
      this.scale.width / 2,
      this.scale.height / 2,
      this.incomingBackgroundKey,
    )
      .setDepth(-2)
      .setScale(this.baseBackgroundScale * 1.18)
      .setAlpha(0);

    this.tweens.add({
      targets: [this.backgroundImage, this.incomingBackground],
      alpha: {
        getEnd: (target: Phaser.GameObjects.Image) => target === this.incomingBackground ? 1 : 0,
      },
      scale: this.baseBackgroundScale * 1.18,
      duration: 240,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        if (!this.incomingBackground) {
          return;
        }

        this.tweens.add({
          targets: this.incomingBackground,
          scale: this.baseBackgroundScale,
          duration: 190,
          ease: 'Cubic.easeOut',
          onComplete: () => this.scene.start('GarageScene'),
        });
      },
    });
  }

  private cancelTransition(): void {
    this.isTransitioning = false;
    this.tweens.killTweensOf(this.backButton);
    this.backButton?.setAlpha(1).setScale(1).setInteractive();
    this.graphicsSettings?.setEnabled(true);
  }

  private changeBackgroundQuality(quality: GraphicsQuality): void {
    const key = getBackgroundKey(BACKGROUND_NAME, quality);

    if (this.textures.exists(key)) {
      this.applyBackground(key, quality);
      return;
    }

    this.isBackgroundLoading = true;
    this.graphicsSettings?.setEnabled(false);
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
      console.error(`Parts store background failed to load (${quality}): ${file.src}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.setEnabled(true);
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
    this.graphicsSettings?.setEnabled(true);
    this.layoutBackground(this.scale.width, this.scale.height);
  }
}
