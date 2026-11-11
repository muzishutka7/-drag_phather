import Phaser from 'phaser';
import {
  type BackgroundName,
  getBackgroundKey,
  getBackgroundUrl,
  preloadBackground,
} from '../../assets/backgrounds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import {
  getGraphicsQuality,
  setGraphicsQuality,
  type GraphicsQuality,
} from '../../settings/graphicsQuality';
import { t } from '../../i18n';
import { getRenderResolution, getRenderResolutionScale } from '../../settings/renderResolution';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { createGarageBackButton } from '../GarageScene/components/createGarageBackButton';

const BACKGROUND_NAME: BackgroundName = 'race-panorama';
const BACKGROUND_ZOOM = 2;
const BACKGROUND_VERTICAL_OFFSET = 0.05;
const PAN_DURATION = 12_000;
const COUNTDOWN_INTERVAL = 1_000;

export class RaceScene extends Phaser.Scene {
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private activeQuality: GraphicsQuality = 'medium';
  private graphicsSettings?: GraphicsSettings;
  private settingsOpen = false;
  private isBackgroundLoading = false;
  private uiContainer?: Phaser.GameObjects.Container;
  private backButton?: Phaser.GameObjects.Container;
  private panProgress = { value: 0 };
  private panTween?: Phaser.Tweens.Tween;
  private countdownText?: Phaser.GameObjects.Text;
  private countdownEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('RaceScene');
  }

  init(): void {
    this.panProgress.value = 0;
    this.panTween = undefined;
    this.countdownText = undefined;
    this.countdownEvent = undefined;
    this.isBackgroundLoading = false;
  }

  preload(): void {
    this.activeQuality = getGraphicsQuality();
    this.backgroundKey = preloadBackground(this, BACKGROUND_NAME, this.activeQuality);
  }

  create(): void {
    this.applyRenderResolution();
    this.cameras.main.setBackgroundColor(palette.background);
    this.createBackground();
    this.drawRace(this.scale.width, this.scale.height);
    this.startCountdown();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.addEventListener('resize', this.handleViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.panTween?.remove();
      this.countdownEvent?.remove();
      this.countdownText?.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      window.removeEventListener('resize', this.handleViewportResize);
    });
  }

  private handleViewportResize = (): void => {
    this.applyRenderResolution();
  };

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutBackground(gameSize.width, gameSize.height);
    this.drawRace(gameSize.width, gameSize.height);
    if (this.countdownText) {
      const scale = Math.min(gameSize.width / GAME_WIDTH, gameSize.height / GAME_HEIGHT);
      this.countdownText
        .setPosition(gameSize.width / 2, gameSize.height / 2)
        .setFontSize(Math.round((this.countdownText.text === t('raceStart') ? 84 : 132) * scale));
    }
  }

  private createBackground(): void {
    if (!this.textures.exists(this.backgroundKey)) {
      console.error(`Race background failed to load: ${this.backgroundKey}`);
      return;
    }

    this.backgroundImage = this.add.image(0, this.scale.height, this.backgroundKey)
      .setOrigin(0, 1)
      .setDepth(-2);
    this.layoutBackground(this.scale.width, this.scale.height);
  }

  private layoutBackground(width: number, height: number): void {
    if (!this.backgroundImage) {
      return;
    }

    const coverScale = Math.max(
      width / this.backgroundImage.width,
      height / this.backgroundImage.height,
    );
    this.backgroundImage
      .setScale(coverScale * BACKGROUND_ZOOM)
      .setPosition(
        -this.getPanDistance(width) * this.panProgress.value,
        height + this.backgroundImage.displayHeight * BACKGROUND_VERTICAL_OFFSET,
      );
  }

  private getPanDistance(width: number): number {
    if (!this.backgroundImage) {
      return 0;
    }

    return Math.max(
      0,
      this.backgroundImage.width * this.backgroundImage.scaleX - width,
    );
  }

  private startBackgroundPan(): void {
    if (!this.backgroundImage || this.panProgress.value >= 1) {
      return;
    }

    this.panTween = this.tweens.add({
      targets: this.panProgress,
      value: 1,
      duration: PAN_DURATION * (1 - this.panProgress.value),
      ease: 'Linear',
      onUpdate: () => {
        if (this.backgroundImage) {
          this.backgroundImage.x = -this.getPanDistance(this.scale.width) * this.panProgress.value;
        }
      },
    });
  }

  private startCountdown(): void {
    const scale = Math.min(
      this.scale.width / GAME_WIDTH,
      this.scale.height / GAME_HEIGHT,
    );
    this.countdownText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      '3',
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${Math.round(132 * scale)}px`,
        fontStyle: 'bold',
        color: '#f3f5f7',
        stroke: '#101820',
        strokeThickness: 8 * scale,
      },
    )
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0)
      .setScale(0.55);

    this.animateCountdownNumber();
    this.countdownEvent = this.time.addEvent({
      delay: COUNTDOWN_INTERVAL,
      repeat: 2,
      callback: () => {
        const remaining = Number(this.countdownText?.text) - 1;
        if (remaining > 0) {
          this.countdownText?.setText(String(remaining)).setAlpha(0).setScale(0.55);
          this.animateCountdownNumber();
          return;
        }

        this.countdownEvent?.remove();
        this.countdownEvent = undefined;
        this.showRaceStart();
      },
    });
  }

  private animateCountdownNumber(): void {
    if (!this.countdownText) {
      return;
    }

    this.tweens.add({
      targets: this.countdownText,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
    });
  }

  private showRaceStart(): void {
    if (!this.countdownText) {
      this.startBackgroundPan();
      return;
    }

    const scale = Math.min(
      this.scale.width / GAME_WIDTH,
      this.scale.height / GAME_HEIGHT,
    );
    this.countdownText
      .setText(t('raceStart'))
      .setFontSize(Math.round(84 * scale))
      .setAlpha(0)
      .setScale(0.35);

    this.tweens.add({
      targets: this.countdownText,
      alpha: 1,
      scale: 1.15,
      duration: 260,
      ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(350, () => {
          if (!this.countdownText?.active) {
            return;
          }

          this.tweens.add({
            targets: this.countdownText,
            alpha: 0,
            scale: 4,
            duration: 150,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              this.countdownText?.destroy();
              this.countdownText = undefined;
              this.startBackgroundPan();
            },
          });
        });
      },
    });
  }

  private drawRace(width: number, height: number): void {
    this.uiContainer?.destroy(true);
    this.uiContainer = this.add.container(0, 0);

    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    this.backButton = createGarageBackButton(
      this,
      34 * scale,
      34 * scale,
      scale,
      () => this.scene.start('GarageScene'),
    );
    this.uiContainer.add(this.backButton);

    this.graphicsSettings = createGraphicsSettings(
      this,
      width - 34 * scale,
      34 * scale,
      scale,
      (quality) => this.changeBackgroundQuality(quality),
      () => this.applyRenderResolution(),
      () => this.drawRace(this.scale.width, this.scale.height),
      (isOpen) => {
        this.settingsOpen = isOpen;
      },
      this.settingsOpen,
    );
    this.graphicsSettings.setEnabled(!this.isBackgroundLoading);
    this.backButton.setDepth(10);
    this.graphicsSettings.container.setDepth(10);
    this.uiContainer.add(this.graphicsSettings.container);
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
      console.error(`Race background failed to load (${quality}): ${file.src}`);
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
}
