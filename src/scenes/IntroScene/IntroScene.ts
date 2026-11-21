import Phaser from 'phaser';
import { getAllAssets, getBackgroundAsset } from '../../assets/assetBundles';
import { getAssetPreloader } from '../../assets/AssetPreloadScene';
import { getBackgroundKey, preloadBackground } from '../../assets/backgrounds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import { getGraphicsQuality, setGraphicsQuality, type GraphicsQuality } from '../../settings/graphicsQuality';
import {
  getRenderResolution,
  getRenderResolutionScale,
} from '../../settings/renderResolution';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { createUiText } from '../../ui/createUiText';
import { createRaceButton, type RaceButton } from './components/createRaceButton';

const BACKGROUND_NAME = 'sunset-drift';

export class IntroScene extends Phaser.Scene {
  private introContainer?: Phaser.GameObjects.Container;
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private backgroundOverlay?: Phaser.GameObjects.Graphics;
  private activeQuality: GraphicsQuality = 'medium';
  private graphicsSettings?: GraphicsSettings;
  private raceButton?: RaceButton;
  /** Progress of loading every scene's assets (the race button shows it). */
  private assetProgress = 0;
  private assetsReady = false;
  /** Bumped on every new warm-up, so a stale one cannot mark the game ready. */
  private warmUpId = 0;
  private titleText?: Phaser.GameObjects.Text;
  private incomingBackground?: Phaser.GameObjects.Image;
  private incomingBackgroundKey = '';
  private baseBackgroundScale = 1;
  private settingsOpen = false;
  private isBackgroundLoading = false;
  private isTransitioning = false;
  private titleFadeComplete = false;
  private garageBackgroundReady = false;

  constructor() {
    super('IntroScene');
  }

  preload(): void {
    this.activeQuality = getGraphicsQuality();
    this.backgroundKey = preloadBackground(this, BACKGROUND_NAME, this.activeQuality);
  }

  create(): void {
    this.applyRenderResolution();
    this.createBackground();
    this.drawIntro(this.scale.width, this.scale.height);
    this.warmUpAssets();
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

    if (this.isTransitioning) {
      return;
    }

    this.drawIntro(gameSize.width, gameSize.height);
  }

  private createBackground(): void {
    if (!this.textures.exists(this.backgroundKey)) {
      console.error(`Intro background failed to load: ${this.backgroundKey}`);
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
    this.backgroundOverlay?.fillStyle(palette.background, 0.38);
    this.backgroundOverlay?.fillRect(0, 0, width, height);
  }

  private drawIntro(width: number, height: number): void {
    this.introContainer?.destroy(true);
    this.introContainer = this.add.container(0, 0);

    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    const centerX = width / 2;

    this.titleText = createUiText(this, centerX, height * 0.22, 'gameTitle', 'title', scale);
    this.introContainer.add(this.titleText);

    const buttonWidth = Math.min(width * 0.78, 440 * scale);
    const buttonHeight = Math.min(height * 0.14, 84 * scale);
    this.raceButton = createRaceButton(
      this,
      centerX,
      height * 0.7 + buttonHeight,
      buttonWidth,
      buttonHeight,
      scale,
      { progress: this.assetProgress, ready: this.assetsReady },
      () => this.startRaceTransition(),
    );
    this.introContainer.add(this.raceButton.container);

    this.graphicsSettings = createGraphicsSettings(
      this,
      width - 34 * scale,
      34 * scale,
      scale,
      (quality) => this.changeBackgroundQuality(quality),
      (resolution) => {
        this.applyRenderResolution(resolution);
      },
      () => this.drawIntro(this.scale.width, this.scale.height),
      (isOpen) => {
        this.settingsOpen = isOpen;
      },
      this.settingsOpen,
    );
    this.graphicsSettings.container.setDepth(10);
    this.graphicsSettings.qualitySelector.setEnabled(!this.isBackgroundLoading);
    this.graphicsSettings.resolutionSelector.setEnabled(!this.isBackgroundLoading);
    this.introContainer.add(this.graphicsSettings.container);
  }

  /**
   * Loads every scene's assets for the current quality (the game is small, so
   * all at once) while the intro is shown. The race button turns into a
   * progress bar until everything is in, so later scenes never open dark.
   */
  private warmUpAssets(quality: GraphicsQuality = this.activeQuality): void {
    const id = ++this.warmUpId;
    this.assetsReady = false;
    this.assetProgress = 0;
    this.raceButton?.setProgress(0);

    void getAssetPreloader(this).loadAssets(getAllAssets(quality), (progress) => {
      if (id !== this.warmUpId) {
        return;
      }
      this.assetProgress = progress;
      this.raceButton?.setProgress(progress);
    }).then(() => {
      if (id !== this.warmUpId || !this.sys.isActive()) {
        return;
      }
      this.assetsReady = true;
      this.raceButton?.setReady(true);
    });
  }

  private startRaceTransition(): void {
    if (
      this.isTransitioning
      || !this.assetsReady
      || this.isBackgroundLoading
      || !this.raceButton
      || !this.titleText
      || !this.backgroundImage
    ) {
      return;
    }

    this.isTransitioning = true;
    this.titleFadeComplete = false;
    this.garageBackgroundReady = false;
    this.graphicsSettings?.setEnabled(false);
    this.raceButton.container.disableInteractive();

    const quality = this.activeQuality;
    this.incomingBackgroundKey = getBackgroundKey('sunny-garage', quality);

    this.tweens.add({
      targets: this.raceButton.container,
      alpha: 0,
      scale: 1.3,
      duration: 180,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.time.delayedCall(150, () => {
          if (!this.isTransitioning || !this.titleText) {
            return;
          }

          this.tweens.add({
            targets: this.titleText,
            alpha: 0,
            scale: 1.12,
            duration: 180,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              this.titleFadeComplete = true;
              this.tryStartBackgroundTransition();
            },
          });
        });
      },
    });

    // Normally already loaded by warmUpAssets; this only waits if it is not.
    void getAssetPreloader(this).loadScene('GarageScene').then(() => {
      if (!this.isTransitioning) {
        return;
      }
      if (!this.textures.exists(this.incomingBackgroundKey)) {
        console.error(`Garage background failed to load: ${this.incomingBackgroundKey}`);
        this.cancelRaceTransition();
        return;
      }
      this.garageBackgroundReady = true;
      this.tryStartBackgroundTransition();
    });
  }

  private tryStartBackgroundTransition(): void {
    if (!this.isTransitioning || !this.titleFadeComplete || !this.garageBackgroundReady) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    this.incomingBackground = this.add.image(
      width / 2,
      height / 2,
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

    this.backgroundOverlay?.setDepth(-1);
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

  private cancelRaceTransition(): void {
    this.isTransitioning = false;
    if (this.raceButton) {
      this.tweens.killTweensOf(this.raceButton.container);
    }
    if (this.titleText) {
      this.tweens.killTweensOf(this.titleText);
    }
    this.raceButton?.container.setAlpha(1).setScale(1).setInteractive();
    this.titleText?.setAlpha(1).setScale(1);
    this.graphicsSettings?.setEnabled(true);
  }

  private applyRenderResolution(resolution = getRenderResolution()): void {
    const renderScale = getRenderResolutionScale(resolution);
    const width = Math.max(1, Math.round(window.innerWidth * renderScale));
    const height = Math.max(1, Math.round(window.innerHeight * renderScale));

    if (this.scale.width !== width || this.scale.height !== height) {
      this.scale.resize(width, height);
    }

    this.game.canvas.style.width = '100%';
    this.game.canvas.style.height = '100%';
  }

  private changeBackgroundQuality(quality: GraphicsQuality): void {
    // Everything of the new quality reloads behind the race button.
    this.warmUpAssets(quality);

    const key = getBackgroundKey(BACKGROUND_NAME, quality);

    if (this.textures.exists(key)) {
      this.applyBackground(key, quality);
      return;
    }

    this.isBackgroundLoading = true;
    this.graphicsSettings?.qualitySelector.setEnabled(false);
    this.graphicsSettings?.resolutionSelector.setEnabled(false);

    void getAssetPreloader(this).loadAssets([getBackgroundAsset(BACKGROUND_NAME, quality)]).then(({ failed }) => {
      if (!this.sys.isActive()) {
        return;
      }
      this.isBackgroundLoading = false;
      if (failed.length === 0) {
        this.applyBackground(key, quality);
        return;
      }
      console.error(`Intro background failed to load (${quality}): ${key}`);
      setGraphicsQuality(this.activeQuality);
      this.warmUpAssets();
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.qualitySelector.setEnabled(true);
      this.graphicsSettings?.resolutionSelector.setEnabled(true);
    });
  }

  private applyBackground(key: string, quality: GraphicsQuality): void {
    const previousKey = this.backgroundKey;

    if (this.backgroundImage) {
      this.backgroundImage.setTexture(key);
    } else {
      this.backgroundImage = this.add.image(0, 0, key).setDepth(-2);
      this.backgroundOverlay = this.add.graphics().setDepth(-1);
    }

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
