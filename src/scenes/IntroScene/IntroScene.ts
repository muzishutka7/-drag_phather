import Phaser from 'phaser';
import { getBackgroundKey, getBackgroundUrl, preloadBackground } from '../../assets/backgrounds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import { getGraphicsQuality, setGraphicsQuality, type GraphicsQuality } from '../../settings/graphicsQuality';
import {
  getRenderResolution,
  getRenderResolutionScale,
} from '../../settings/renderResolution';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { createUiText } from '../../ui/createUiText';
import { createRaceButton } from './components/createRaceButton';

const BACKGROUND_NAME = 'sunset-drift';

export class IntroScene extends Phaser.Scene {
  private introContainer?: Phaser.GameObjects.Container;
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private backgroundOverlay?: Phaser.GameObjects.Graphics;
  private activeQuality: GraphicsQuality = 'medium';
  private graphicsSettings?: GraphicsSettings;
  private raceButton?: Phaser.GameObjects.Container;
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
      () => this.startRaceTransition(),
    );
    this.introContainer.add(this.raceButton);

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

  private startRaceTransition(): void {
    if (
      this.isTransitioning
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
    this.raceButton.disableInteractive();

    const quality = this.activeQuality;
    this.incomingBackgroundKey = getBackgroundKey('sunny-garage', quality);

    this.tweens.add({
      targets: this.raceButton,
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

    if (this.textures.exists(this.incomingBackgroundKey)) {
      this.garageBackgroundReady = true;
      this.tryStartBackgroundTransition();
      return;
    }

    this.load.image(
      this.incomingBackgroundKey,
      getBackgroundUrl('sunny-garage', quality),
    );

    const onComplete = (): void => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.garageBackgroundReady = true;
      this.tryStartBackgroundTransition();
    };

    const onError = (file: Phaser.Loader.File): void => {
      if (file.key !== this.incomingBackgroundKey) {
        return;
      }

      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.load.off(`filecomplete-image-${this.incomingBackgroundKey}`, onComplete);
      console.error(`Garage background failed to load: ${file.src}`);
      this.cancelRaceTransition();
    };

    this.load.once(`filecomplete-image-${this.incomingBackgroundKey}`, onComplete);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    this.load.start();
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
      .setScale(this.baseBackgroundScale * 1.18)
      .setAlpha(0);

    this.backgroundOverlay?.setDepth(-1);
    this.tweens.add({
      targets: [this.backgroundImage, this.incomingBackground],
      alpha: (target: Phaser.GameObjects.Image) => target === this.incomingBackground ? 1 : 0,
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

  private cancelRaceTransition(): void {
    this.isTransitioning = false;
    this.tweens.killTweensOf(this.raceButton);
    this.tweens.killTweensOf(this.titleText);
    this.raceButton?.setAlpha(1).setScale(1).setInteractive();
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
    const key = getBackgroundKey(BACKGROUND_NAME, quality);

    if (this.textures.exists(key)) {
      this.applyBackground(key, quality);
      return;
    }

    this.isBackgroundLoading = true;
    this.graphicsSettings?.qualitySelector.setEnabled(false);
    this.graphicsSettings?.resolutionSelector.setEnabled(false);
    this.load.image(key, getBackgroundUrl(BACKGROUND_NAME, quality));

    const onFileComplete = (): void => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.isBackgroundLoading = false;
      this.applyBackground(key, quality);
    };

    const onLoadError = (file: Phaser.Loader.File): void => {
      if (file.key !== key) {
        return;
      }

      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.load.off(`filecomplete-image-${key}`, onFileComplete);
      this.isBackgroundLoading = false;
      console.error(`Intro background failed to load (${quality}): ${file.src}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.qualitySelector.setEnabled(true);
      this.graphicsSettings?.resolutionSelector.setEnabled(true);
    };

    this.load.once(`filecomplete-image-${key}`, onFileComplete);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    this.load.start();
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
