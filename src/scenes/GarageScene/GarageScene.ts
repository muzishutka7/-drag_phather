import Phaser from 'phaser';
import {
  getBackgroundKey,
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
import {
  applyBackdropBlur,
  GARAGE_BACKDROP_DIM,
  GARAGE_BACKDROP_FADE_MS,
  setBackdropBlurAmount,
} from '../../ui/backdrop';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { preloadVehicleAssets } from '../../assets/vehicleAssets';
import { getBackgroundAsset } from '../../assets/assetBundles';
import { getAssetPreloader, startSceneWhenReady } from '../../assets/AssetPreloadScene';
import { playEngineStartStop, stopEngineStartStop } from '../../audio/garageEngineSound';
import { startMusic } from '../../audio/musicPlayer';
import { playableCars } from '../../gameobjects/cars/carCatalog';
import { getCarVisualParts } from '../../gameobjects/cars/carVisuals';
import { getSelectedCar, setSelectedCar } from '../../state/selectedCar';
import { createGarageCarDisplay, type GarageCarDisplay } from './components/createGarageCarDisplay';
import { createPartsStoreButton } from './components/createPartsStoreButton';
import { createRaceFlagButton } from './components/createRaceFlagButton';

const BACKGROUND_NAME = 'sunny-garage';
/** The garage background ends slightly zoomed in (after a slow push-in on entry). */
const BACKGROUND_SETTLED_ZOOM = 1.06;

export class GarageScene extends Phaser.Scene {
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private backgroundOverlay?: Phaser.GameObjects.Graphics;
  private activeQuality: GraphicsQuality = 'medium';
  private graphicsSettings?: GraphicsSettings;
  private settingsOpen = false;
  private isBackgroundLoading = false;
  private isTransitioning = false;
  private transitionBackgroundReady = false;
  private transitionAnimationReady = false;
  private incomingBackground?: Phaser.GameObjects.Image;
  private incomingBackgroundKey = '';
  private baseBackgroundScale = 1;
  /** 0..1: how far the dim + blur of the background have faded in. */
  private backdropAmount = 1;
  private backdropBlur?: Phaser.FX.Blur;
  /** Background zoom over its cover size: starts at 1 and slowly pushes in. */
  private backgroundZoom = BACKGROUND_SETTLED_ZOOM;
  private uiContainer?: Phaser.GameObjects.Container;
  private storeButton?: Phaser.GameObjects.Container;
  private raceButton?: Phaser.GameObjects.Container;
  private carDisplay?: GarageCarDisplay;

  constructor() {
    super('GarageScene');
  }

  init(data?: { backgroundZoom?: number }): void {
    this.backgroundZoom = data?.backgroundZoom ?? 1;
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
    // All playable cars, so flipping through them in the garage is instant.
    const parts = new Set(playableCars.flatMap((car) => getCarVisualParts(car.visual)));
    preloadVehicleAssets(this, [...parts], this.activeQuality);
  }

  create(): void {
    this.applyRenderResolution();
    // Background music starts after the intro and keeps playing in every scene.
    startMusic();
    // The background arrives sharp and bright, then settles into the dimmed,
    // blurred garage backdrop in front of the player.
    this.backdropAmount = 0;
    this.createBackground();
    // Slow push-in, as long as the dim + blur fade in.
    this.tweens.add({
      targets: this,
      backgroundZoom: BACKGROUND_SETTLED_ZOOM,
      duration: GARAGE_BACKDROP_FADE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.backgroundImage?.setScale(this.baseBackgroundScale * this.backgroundZoom),
    });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: GARAGE_BACKDROP_FADE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => this.setBackdropAmount(tween.getValue() ?? 1),
    });
    graphicsQualities.forEach((quality) => {
      const introBackgroundKey = getBackgroundKey('sunset-drift', quality);
      if (this.textures.exists(introBackgroundKey)) {
        this.textures.remove(introBackgroundKey);
      }
    });
    this.drawGarage(this.scale.width, this.scale.height, true);
    // The car rolls in with its engine starting up, as when switching cars.
    playEngineStartStop(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.addEventListener('resize', this.handleViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopEngineStartStop();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      window.removeEventListener('resize', this.handleViewportResize);
    });
  }

  update(time: number): void {
    this.carDisplay?.update(time);
  }

  private handleViewportResize = (): void => {
    this.applyRenderResolution();
  };

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutBackground(gameSize.width, gameSize.height);

    if (this.isTransitioning) {
      return;
    }

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
      this.baseBackgroundScale = this.backgroundImage.scale;
      this.backgroundImage.setScale(this.baseBackgroundScale * this.backgroundZoom);
      this.backdropBlur = applyBackdropBlur(this.backgroundImage, this.backdropAmount);
    }

    this.backgroundOverlay?.clear();
    this.backgroundOverlay?.fillStyle(palette.background, GARAGE_BACKDROP_DIM);
    this.backgroundOverlay?.fillRect(0, 0, width, height);
    this.backgroundOverlay?.setAlpha(this.backdropAmount);
  }

  private setBackdropAmount(amount: number): void {
    this.backdropAmount = amount;
    this.backgroundOverlay?.setAlpha(amount);
    if (this.backgroundImage) {
      setBackdropBlurAmount(this.backgroundImage, this.backdropBlur, amount);
    }
  }

  private drawGarage(width: number, height: number, entrance = false): void {
    this.uiContainer?.destroy(true);
    this.uiContainer = this.add.container(0, 0);

    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    this.storeButton = createPartsStoreButton(
      this,
      34 * scale,
      34 * scale,
      scale,
      () => this.startStoreTransition(),
    );
    this.uiContainer.add(this.storeButton);
    this.raceButton = createRaceFlagButton(
      this,
      34 * scale + 56 * scale,
      34 * scale,
      scale,
      () => startSceneWhenReady(this, 'RaceScene'),
    );
    this.uiContainer.add(this.raceButton);

    this.carDisplay = createGarageCarDisplay(this, width, height, scale, {
      cars: playableCars,
      index: playableCars.indexOf(getSelectedCar()),
      entrance,
      onSelect: (car) => {
        setSelectedCar(car.id);
        // The newly picked car starts up, idles and switches off.
        playEngineStartStop(this);
      },
    });
    this.uiContainer.add(this.carDisplay.container);

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
    this.storeButton.setDepth(10);
    this.raceButton.setDepth(10);
    this.graphicsSettings.setEnabled(!this.isBackgroundLoading);
    this.uiContainer.add(this.graphicsSettings.container);
  }

  private startStoreTransition(): void {
    if (
      this.isTransitioning
      || this.isBackgroundLoading
      || !this.storeButton
      || !this.backgroundImage
    ) {
      return;
    }

    this.isTransitioning = true;
    this.transitionBackgroundReady = false;
    this.transitionAnimationReady = false;
    this.storeButton.disableInteractive();
    this.graphicsSettings?.setEnabled(false);

    const quality = this.activeQuality;
    this.incomingBackgroundKey = getBackgroundKey('parts-garage', quality);

    this.tweens.add({
      targets: this.storeButton,
      alpha: 0,
      scale: 1.3,
      duration: 180,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.time.delayedCall(150, () => {
          this.transitionAnimationReady = true;
          this.tryStartStoreBackgroundTransition();
        });
      },
    });

    // Normally already loaded (see AssetPreloadScene); this only waits if it is not.
    void getAssetPreloader(this).loadScene('PartsStoreScene').then(() => {
      if (!this.isTransitioning) {
        return;
      }
      if (!this.textures.exists(this.incomingBackgroundKey)) {
        console.error(`Parts store background failed to load: ${this.incomingBackgroundKey}`);
        this.cancelStoreTransition();
        return;
      }
      this.transitionBackgroundReady = true;
      this.tryStartStoreBackgroundTransition();
    });
  }

  private tryStartStoreBackgroundTransition(): void {
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
          onComplete: () => this.scene.start('PartsStoreScene'),
        });
      },
    });
  }

  private cancelStoreTransition(): void {
    this.isTransitioning = false;
    if (this.storeButton) {
      this.tweens.killTweensOf(this.storeButton);
    }
    this.storeButton?.setAlpha(1).setScale(1).setInteractive();
    this.graphicsSettings?.setEnabled(true);
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
      console.error(`Garage background failed to load (${quality}): ${key}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.qualitySelector.setEnabled(true);
      this.graphicsSettings?.resolutionSelector.setEnabled(true);
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
    this.graphicsSettings?.qualitySelector.setEnabled(true);
    this.graphicsSettings?.resolutionSelector.setEnabled(true);
    this.layoutBackground(this.scale.width, this.scale.height);
  }
}
