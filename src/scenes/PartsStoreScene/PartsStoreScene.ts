import Phaser from 'phaser';
import {
  getBackgroundKey,
  preloadBackground,
} from '../../assets/backgrounds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import { getBackgroundAsset } from '../../assets/assetBundles';
import { getAssetPreloader } from '../../assets/AssetPreloadScene';
import {
  getGraphicsQuality,
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

    // Normally already loaded (see AssetPreloadScene); this only waits if it is not.
    void getAssetPreloader(this).loadScene('GarageScene').then(() => {
      if (!this.isTransitioning) {
        return;
      }
      if (!this.textures.exists(this.incomingBackgroundKey)) {
        console.error(`Garage background failed to load: ${this.incomingBackgroundKey}`);
        this.cancelTransition();
        return;
      }
      this.transitionBackgroundReady = true;
      this.tryStartGarageBackgroundTransition();
    });
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
      // at its normal size: the garage then slowly zooms in from here
      .setScale(this.baseBackgroundScale)
      .setAlpha(0);
    // The garage background arrives sharp and undimmed; the garage then fades
    // its own dim + blur in, so this scene's dim fades out with the crossfade.
    if (this.backgroundOverlay) {
      this.tweens.add({ targets: this.backgroundOverlay, alpha: 0, duration: 240, ease: 'Cubic.easeInOut' });
    }

    // The old background zooms away while the garage fades in at normal size.
    this.tweens.add({
      targets: this.backgroundImage,
      alpha: 0,
      scale: this.baseBackgroundScale * 1.18,
      duration: 240,
      ease: 'Cubic.easeInOut',
    });
    this.tweens.add({
      targets: this.incomingBackground,
      alpha: 1,
      duration: 240,
      ease: 'Cubic.easeInOut',
      // The garage takes over and slowly zooms in, together with its dim + blur.
      onComplete: () => this.scene.start('GarageScene', { backgroundZoom: 1 }),
    });
  }

  private cancelTransition(): void {
    this.isTransitioning = false;
    if (this.backButton) {
      this.tweens.killTweensOf(this.backButton);
    }
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
    void getAssetPreloader(this).loadAssets([getBackgroundAsset(BACKGROUND_NAME, quality)]).then(({ failed }) => {
      if (!this.sys.isActive()) {
        return;
      }
      if (failed.length === 0) {
        this.isBackgroundLoading = false;
        this.applyBackground(key, quality);
        return;
      }
      this.isBackgroundLoading = false;
      console.error(`Parts store background failed to load (${quality}): ${key}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.setEnabled(true);
    });
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
