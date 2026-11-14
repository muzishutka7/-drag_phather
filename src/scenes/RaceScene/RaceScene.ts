import Phaser from 'phaser';
import {
  type BackgroundName,
  getBackgroundKey,
  getBackgroundUrl,
  preloadBackground,
} from '../../assets/backgrounds';
import {
  getRaceAssetKeys,
  getRaceAssetUrl,
  preloadRaceAssets,
  raceAssetNames,
  type RaceAssetKeys,
} from '../../assets/raceAssets';
import { RaceAudio } from '../../audio/raceAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import { drawWheel } from '../../gameobjects/cars/carDrawing';
import { createSportsCoupe } from '../../gameobjects/cars/createSportsCoupe';
import { createRaceControls, type RaceControls } from '../../gameobjects/race/createRaceControls';
import { createRaceHud, type RaceHud } from '../../gameobjects/race/createRaceHud';
import {
  createTireWarmupGauge,
  type TireWarmupGauge,
} from '../../gameobjects/race/createTireWarmupGauge';
import { RaceEngine, type DrivenAxle } from '../../gameobjects/race/raceEngine';
import { RaceSession } from '../../gameobjects/race/raceSession';
import {
  getGraphicsQuality,
  setGraphicsQuality,
  type GraphicsQuality,
} from '../../settings/graphicsQuality';
import { getRenderResolution, getRenderResolutionScale } from '../../settings/renderResolution';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { createGarageBackButton } from '../GarageScene/components/createGarageBackButton';

const BACKGROUND_NAME: BackgroundName = 'race-panorama';
const BACKGROUND_ZOOM = 2;
const BACKGROUND_VERTICAL_OFFSET = 0.00;
const ROAD_TEXTURE_KEY = 'race-road-surface';
const ROAD_TEXTURE_WIDTH = 480;
const ROAD_TEXTURE_HEIGHT = 192;
const ROAD_HEIGHT_RATIO = 0.5;
const ROAD_LANE_DIVIDER = 109;
const ROAD_LOWER_EDGE = 188;
const ROAD_LANE = 'upper';
const CAR_POSITION_X = 276;
const CAR_WHEEL_BOTTOM = 39;
const CAR_LANE_VERTICAL_OFFSET = 34;
const CAR_SCALE = 1.1;
const CAR_WHEELS = [
  { axle: 'rear', x: -70, y: 19 },
  { axle: 'front', x: 72, y: 19 },
] as const satisfies ReadonlyArray<{ axle: DrivenAxle; x: number; y: number }>;
const WHEEL_RADIUS = 20;
/** Visual cap so fast wheels do not strobe. */
const MAX_WHEEL_ANGULAR_VELOCITY = Math.PI * 10;
/** How many screen pixels (at 960×540 layout) one meter of track takes. */
const PIXELS_PER_METER = 28;
/** Distance from the car origin to its front bumper, in car-local pixels. */
const CAR_FRONT_OFFSET = 124;
const BACKGROUND_PARALLAX = 0.08;
const TACHOMETER_MAX_RPM = 9_000;
const INSTRUMENT_POSITION = { x: 719.5, y: 568 };
const INSTRUMENT_SCALE = 0.35826;
const NEEDLE_SIZE_DIVISOR = 2.5;
const NEEDLE_START_ANGLE = 2.78;
const SPEEDOMETER_MAX_KPH = 260;
const SPEEDOMETER_ZERO_ANGLE = 2.7574;
const SPEEDOMETER_SWEEP_RADIANS = Math.PI * 1.45 - (SPEEDOMETER_ZERO_ANGLE - 2.45);
const SPEEDOMETER_REFERENCE_SPEED_KPH = 172;
const SPEEDOMETER_REFERENCE_ADVANCE_RADIANS = Phaser.Math.DegToRad(18);

export class RaceScene extends Phaser.Scene {
  private backgroundKey = '';
  private backgroundImage?: Phaser.GameObjects.Image;
  private roadImage?: Phaser.GameObjects.TileSprite;
  private activeQuality: GraphicsQuality = 'medium';
  private raceAssetKeys: RaceAssetKeys = getRaceAssetKeys('medium');
  private graphicsSettings?: GraphicsSettings;
  private settingsOpen = false;
  private isBackgroundLoading = false;
  private uiContainer?: Phaser.GameObjects.Container;
  private backButton?: Phaser.GameObjects.Container;
  private carContainer?: Phaser.GameObjects.Container;
  private wheels: Array<{ axle: DrivenAxle; image: Phaser.GameObjects.Graphics }> = [];
  private engine = new RaceEngine();
  private session = new RaceSession(this.engine);
  private hud?: RaceHud;
  private warmupGauge?: TireWarmupGauge;
  private trackMarks?: Phaser.GameObjects.Graphics;
  private audio?: RaceAudio;
  private soundEvents = { countdown: -1, amber: 0, green: false, phase: '', gear: 0 };
  private drivenWheelRotation = 0;
  private freeWheelRotation = 0;
  private instrumentContainer?: Phaser.GameObjects.Container;
  private raceControls?: RaceControls;
  private dashboardImage?: Phaser.GameObjects.Image;
  private speedNeedle?: Phaser.GameObjects.Image;
  private tachometerNeedle?: Phaser.GameObjects.Image;
  private gearReadout?: Phaser.GameObjects.Text;

  constructor() {
    super('RaceScene');
  }

  init(): void {
    this.isBackgroundLoading = false;
    this.session.restart();
    this.wheels = [];
    this.drivenWheelRotation = 0;
    this.freeWheelRotation = 0;
    this.soundEvents = { countdown: -1, amber: 0, green: false, phase: '', gear: 0 };
  }

  preload(): void {
    this.activeQuality = getGraphicsQuality();
    this.backgroundKey = preloadBackground(this, BACKGROUND_NAME, this.activeQuality);
    this.raceAssetKeys = preloadRaceAssets(this, this.activeQuality);
  }

  create(): void {
    this.applyRenderResolution();
    this.cameras.main.setBackgroundColor(palette.background);
    this.createBackground();
    this.createRoad();
    this.createRaceArtwork();
    this.audio = new RaceAudio(this);
    this.drawRace(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.addEventListener('resize', this.handleViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.raceControls?.destroy();
      this.hud?.destroy();
      this.audio?.destroy();
      this.audio = undefined;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      window.removeEventListener('resize', this.handleViewportResize);
    });
  }

  update(_time: number, delta: number): void {
    if (!this.raceControls) {
      return;
    }

    const throttle = this.raceControls.isThrottlePressed();
    const brake = this.raceControls.isBrakePressed();
    this.session.update(delta, { throttle, brake });

    const phase = this.session.phase;
    this.hud?.update(this.session);
    this.warmupGauge?.container.setVisible(phase === 'burnout' || phase === 'staging');
    this.warmupGauge?.update({
      warmup: this.engine.tireWarmup,
      gripMultiplier: this.engine.gripMultiplier,
      countdownSeconds: phase === 'burnout' ? this.session.countdownSeconds : undefined,
      locked: this.engine.lockedGripMultiplier !== undefined,
    });

    this.updateWheels(delta);
    this.updateTrack();
    this.updateSound();
    this.gearReadout?.setText(this.engine.gear === 0 ? 'N' : String(this.engine.gear));
    const calibratedSpeedProgress = this.getSpeedometerProgress();
    this.speedNeedle?.setRotation(
      SPEEDOMETER_ZERO_ANGLE + SPEEDOMETER_SWEEP_RADIANS * calibratedSpeedProgress,
    );

    const rpmProgress = Phaser.Math.Clamp(
      (this.engine.rpm - this.engine.profile.idleRpm)
        / (TACHOMETER_MAX_RPM - this.engine.profile.idleRpm),
      0,
      1,
    );
    this.tachometerNeedle?.setRotation(NEEDLE_START_ANGLE + Math.PI * rpmProgress);
  }

  private updateSound(): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }

    const engine = this.engine;
    const session = this.session;
    audio.update({
      rpm: engine.rpm,
      idleRpm: engine.profile.idleRpm,
      redlineRpm: engine.profile.redlineRpm,
      firing: engine.firing,
      wheelSpinKph: engine.wheelSpinSpeedKph,
      speedKph: engine.speedKph,
    });

    const events = this.soundEvents;
    const countdown = session.phase === 'burnout' && session.countdownSeconds !== undefined
      ? Math.ceil(session.countdownSeconds)
      : -1;
    if (countdown > 0 && countdown !== events.countdown) {
      audio.playCountdownTick(countdown);
    }
    events.countdown = countdown;

    if (session.phase !== events.phase) {
      if (session.phase === 'staging') {
        audio.playGripLocked();
      } else if (session.phase === 'finished') {
        audio.playFinish();
      }
      events.phase = session.phase;
    }

    if (session.amberLights > events.amber) {
      audio.playAmberLight();
    }
    events.amber = session.amberLights;

    if (session.greenLight && !events.green) {
      audio.playGreenLight();
    }
    events.green = session.greenLight;

    if (engine.gear !== events.gear) {
      audio.playGearShift();
      events.gear = engine.gear;
    }
  }

  private updateWheels(delta: number): void {
    const deltaSeconds = Math.min(delta / 1000, 0.1);
    const radius = this.engine.profile.wheelRadiusMeters;
    const advance = (rotation: number, surfaceSpeed: number): number => Phaser.Math.Wrap(
      rotation + Math.min(surfaceSpeed / radius, MAX_WHEEL_ANGULAR_VELOCITY) * deltaSeconds,
      0,
      Math.PI * 2,
    );
    this.drivenWheelRotation = advance(this.drivenWheelRotation, this.engine.wheelSurfaceSpeedMps);
    this.freeWheelRotation = advance(this.freeWheelRotation, this.engine.velocityMps);

    const drivetrain = this.engine.profile.drivetrain;
    this.wheels.forEach(({ axle, image }) => {
      const isDriven = drivetrain === 'all-wheel'
        || (drivetrain === 'front-wheel' && axle === 'front')
        || (drivetrain === 'rear-wheel' && axle === 'rear');
      image.rotation = isDriven ? this.drivenWheelRotation : this.freeWheelRotation;
    });
  }

  /** Scrolls the road and draws the start and finish lines. */
  private updateTrack(): void {
    const { width, height } = this.scale;
    const layoutScale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    const pixelsPerMeter = PIXELS_PER_METER * layoutScale;
    const distance = this.engine.distanceMeters;
    const roadHeight = height * ROAD_HEIGHT_RATIO;
    const roadScale = roadHeight / ROAD_TEXTURE_HEIGHT;

    if (this.roadImage) {
      this.roadImage.tilePositionX = (distance * pixelsPerMeter) / roadScale;
    }

    if (this.backgroundImage) {
      const maxShift = Math.max(0, this.backgroundImage.displayWidth - width);
      this.backgroundImage.x = -Math.min(maxShift, distance * pixelsPerMeter * BACKGROUND_PARALLAX);
    }

    if (!this.trackMarks) {
      return;
    }

    this.trackMarks.clear();
    const frontX = (CAR_POSITION_X + CAR_FRONT_OFFSET * CAR_SCALE) * layoutScale;
    const top = height - roadHeight + 31 * roadScale;
    const bottom = height - 4 * roadScale;
    const drawLine = (meters: number, checkered: boolean): void => {
      const x = frontX + (meters - distance) * pixelsPerMeter;
      if (x < -40 || x > width + 40) {
        return;
      }

      const lineWidth = 14 * layoutScale;
      if (!checkered) {
        this.trackMarks?.fillStyle(0xf3f5f7, 0.9);
        this.trackMarks?.fillRect(x - lineWidth / 2, top, lineWidth / 2, bottom - top);
        return;
      }

      const cell = lineWidth / 2;
      for (let y = top, row = 0; y < bottom; y += cell, row += 1) {
        for (let column = 0; column < 2; column += 1) {
          this.trackMarks?.fillStyle((row + column) % 2 === 0 ? 0xf3f5f7 : 0x151718, 1);
          this.trackMarks?.fillRect(x - lineWidth / 2 + column * cell, y, cell, Math.min(cell, bottom - y));
        }
      }
    };
    drawLine(0, false);
    drawLine(this.session.distanceMeters, true);
  }

  private handleViewportResize = (): void => {
    this.applyRenderResolution();
  };

  private getSpeedometerProgress(): number {
    // The dial artwork is calibrated against this reference speed.
    const topSpeed = SPEEDOMETER_REFERENCE_SPEED_KPH;
    if (topSpeed >= SPEEDOMETER_MAX_KPH) {
      return Phaser.Math.Clamp(this.engine.speedKph / SPEEDOMETER_MAX_KPH, 0, 1);
    }

    const calibrationAdvance = SPEEDOMETER_REFERENCE_ADVANCE_RADIANS
      * topSpeed / SPEEDOMETER_REFERENCE_SPEED_KPH;
    const topSpeedProgress = topSpeed / SPEEDOMETER_MAX_KPH
      + calibrationAdvance / SPEEDOMETER_SWEEP_RADIANS;
    const speed = Phaser.Math.Clamp(this.engine.speedKph, 0, SPEEDOMETER_MAX_KPH);
    const progress = speed <= topSpeed
      ? (speed / topSpeed) * topSpeedProgress
      : topSpeedProgress + ((speed - topSpeed) / (SPEEDOMETER_MAX_KPH - topSpeed))
        * (1 - topSpeedProgress);

    return Phaser.Math.Clamp(progress, 0, 1);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutBackground(gameSize.width, gameSize.height);
    this.layoutRoad(gameSize.width, gameSize.height);
    this.layoutRaceArtwork(gameSize.width, gameSize.height);
    this.drawRace(gameSize.width, gameSize.height);
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
        0,
        height + this.backgroundImage.displayHeight * BACKGROUND_VERTICAL_OFFSET,
      );
  }

  private createRoad(): void {
    if (!this.textures.exists(ROAD_TEXTURE_KEY)) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      this.drawRoadTexture(graphics);
      graphics.generateTexture(ROAD_TEXTURE_KEY, ROAD_TEXTURE_WIDTH, ROAD_TEXTURE_HEIGHT);
      graphics.destroy();
    }

    this.roadImage = this.add.tileSprite(
      0,
      this.scale.height,
      this.scale.width,
      this.scale.height * ROAD_HEIGHT_RATIO,
      ROAD_TEXTURE_KEY,
    )
      .setOrigin(0, 1)
      .setDepth(-1);
    this.layoutRoad(this.scale.width, this.scale.height);
  }

  private drawRoadTexture(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x68744c);
    graphics.fillRect(0, 0, ROAD_TEXTURE_WIDTH, ROAD_TEXTURE_HEIGHT);
    graphics.fillStyle(0x83945c);
    graphics.fillRect(0, 0, ROAD_TEXTURE_WIDTH, 16);
    graphics.fillStyle(0x343b32);
    graphics.fillRect(0, 16, ROAD_TEXTURE_WIDTH, 3);

    graphics.fillStyle(0xeeeeea);
    graphics.fillRect(0, 19, ROAD_TEXTURE_WIDTH, 12);
    graphics.fillStyle(0xb83b39);
    for (let x = 0; x < ROAD_TEXTURE_WIDTH; x += 96) {
      graphics.fillRect(x, 19, 48, 12);
    }

    graphics.fillStyle(0x414342);
    graphics.fillRect(0, 31, ROAD_TEXTURE_WIDTH, ROAD_TEXTURE_HEIGHT - 31);
    graphics.fillStyle(0x4a4b49, 0.65);
    for (let x = 12; x < ROAD_TEXTURE_WIDTH; x += 37) {
      graphics.fillRect(x, 42 + (x % 5), 18, 2);
      graphics.fillRect(x + 9, 176 - (x % 7), 24, 2);
    }

    graphics.fillStyle(0xd8d8d0, 0.9);
    graphics.fillRect(0, 109, ROAD_TEXTURE_WIDTH, 2);
    for (let x = 0; x < ROAD_TEXTURE_WIDTH; x += 96) {
      graphics.fillRoundedRect(x + 4, 101, 48, 5, 2);
    }
    graphics.fillStyle(0x272b2a);
    graphics.fillRect(0, ROAD_TEXTURE_HEIGHT - 4, ROAD_TEXTURE_WIDTH, 4);
  }

  private layoutRoad(width: number, height: number): void {
    const roadHeight = height * ROAD_HEIGHT_RATIO;
    const roadScale = roadHeight / ROAD_TEXTURE_HEIGHT;
    this.roadImage
      ?.setPosition(0, height)
      .setSize(width, roadHeight)
      .setTileScale(roadScale);
  }

  private createRaceArtwork(): void {
    const missingAssets = raceAssetNames.filter((name) => !this.textures.exists(this.raceAssetKeys[name]));
    if (missingAssets.length > 0) {
      console.error(`Race artwork failed to load: ${missingAssets.join(', ')}`);
      return;
    }

    this.carContainer = this.add.container(0, 0).setDepth(2);
    CAR_WHEELS.forEach(({ axle, x, y }) => {
      const wheel = this.add.graphics().setName(`${axle}-wheel`);
      drawWheel(wheel, 0, 0, WHEEL_RADIUS);
      wheel.setPosition(x, y);
      this.carContainer?.add(wheel);
      this.wheels.push({ axle, image: wheel });
    });
    this.carContainer.add(createSportsCoupe({
      scene: this,
      x: 0,
      y: 0,
      color: palette.sportsCoupe,
      scale: 1,
      drawWheels: false,
    }).setName('car-body'));

    this.instrumentContainer = this.add.container(0, 0)
      .setName('instrument-cluster')
      .setDepth(4);
    this.dashboardImage = this.add.image(0, 0, this.raceAssetKeys['dashboard-gauges'])
      .setName('dashboard-gauges')
      .setOrigin(0.5, 1)
      .setDepth(0);
    const gearReadoutBackground = this.add.rectangle(-16, -418, 72, 76, 0x151918, 0.95)
      .setName('gear-readout-background')
      .setStrokeStyle(3, 0x77817b, 0.95);
    this.gearReadout = this.add.text(-16, -418, 'N', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#f4f4ef',
      stroke: '#171a19',
      strokeThickness: 8,
    })
      .setName('gear-readout')
      .setOrigin(0.5);
    this.speedNeedle = this.createNeedle('speedometer-needle');
    this.tachometerNeedle = this.createNeedle('tachometer-needle');
    this.instrumentContainer.add([
      this.dashboardImage,
      gearReadoutBackground,
      this.speedNeedle,
      this.tachometerNeedle,
      this.gearReadout,
    ]);
    this.raceControls = createRaceControls(
      this,
      () => this.engine.shiftUp(),
      () => this.engine.shiftDown(),
    );
    this.instrumentContainer.add(this.raceControls.container);
    this.trackMarks = this.add.graphics().setName('track-marks').setDepth(-0.5);
    this.warmupGauge = createTireWarmupGauge(this, this.engine.profile.tires);
    this.hud = createRaceHud(
      this,
      (distance) => this.session.selectDistance(distance),
      () => this.session.restart(),
      () => this.scene.start('GarageScene'),
    );
    this.layoutRaceArtwork(this.scale.width, this.scale.height);
  }

  private createNeedle(name: string): Phaser.GameObjects.Image {
    return this.add.image(0, 0, this.raceAssetKeys['gauge-needle'])
      .setName(name)
      .setOrigin(64 / 400, 147 / 201)
      .setRotation(NEEDLE_START_ANGLE)
      .setDepth(5);
  }

  private layoutRaceArtwork(width: number, height: number): void {
    const layoutScale = Math.min(
      width / GAME_WIDTH,
      height / GAME_HEIGHT,
    );
    const roadHeight = height * ROAD_HEIGHT_RATIO;
    const roadScale = roadHeight / ROAD_TEXTURE_HEIGHT;
    const laneGroundY = ROAD_LANE === 'upper' ? ROAD_LANE_DIVIDER : ROAD_LOWER_EDGE;
    const wheelContactY = height - roadHeight + laneGroundY * roadScale;
    this.carContainer
      ?.setPosition(
        CAR_POSITION_X * layoutScale,
        wheelContactY
          - (CAR_WHEEL_BOTTOM + CAR_LANE_VERTICAL_OFFSET) * CAR_SCALE * layoutScale,
      )
      .setScale(CAR_SCALE * layoutScale);

    const clusterX = INSTRUMENT_POSITION.x * layoutScale;
    const clusterY = INSTRUMENT_POSITION.y * layoutScale;
    const clusterScale = INSTRUMENT_SCALE * layoutScale;
    this.instrumentContainer
      ?.setPosition(clusterX, clusterY)
      .setScale(clusterScale);
    this.dashboardImage?.setPosition(0, 0).setDisplaySize(800, 461);

    this.positionNeedle(this.speedNeedle, 575, 232);
    this.positionNeedle(this.tachometerNeedle, 194, 225);
    this.raceControls?.layout(
      width,
      height,
      layoutScale,
      clusterX,
      clusterY,
      clusterScale,
    );
    this.warmupGauge?.layout(width, layoutScale);
    this.hud?.layout(width, height, layoutScale);
  }

  private positionNeedle(
    needle: Phaser.GameObjects.Image | undefined,
    anchorX: number,
    anchorY: number,
  ): void {
    if (!needle) {
      return;
    }

    needle
      .setDisplaySize(
        400 / NEEDLE_SIZE_DIVISOR,
        201 / NEEDLE_SIZE_DIVISOR,
      )
      .setPosition(
        anchorX - 400,
        anchorY - 461,
      );
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
    if (quality === this.activeQuality) {
      return;
    }

    this.isBackgroundLoading = true;
    this.graphicsSettings?.setEnabled(false);
    const nextBackgroundKey = getBackgroundKey(BACKGROUND_NAME, quality);
    const nextRaceAssetKeys = getRaceAssetKeys(quality);
    const pendingFiles = new Map<string, string>();

    if (!this.textures.exists(nextBackgroundKey)) {
      pendingFiles.set(nextBackgroundKey, getBackgroundUrl(BACKGROUND_NAME, quality));
    }
    raceAssetNames.forEach((name) => {
      const key = nextRaceAssetKeys[name];
      if (!this.textures.exists(key)) {
        pendingFiles.set(key, getRaceAssetUrl(name, quality));
      }
    });

    const onError = (file: Phaser.Loader.File): void => {
      if (!pendingFiles.has(file.key)) {
        return;
      }

      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      pendingFiles.forEach((_, key) => {
        this.load.off(`filecomplete-image-${key}`);
      });
      this.isBackgroundLoading = false;
      console.error(`Race graphics failed to load (${quality}): ${file.src}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.setEnabled(true);
    };
    const finishLoading = (): void => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.isBackgroundLoading = false;
      this.applyQuality(quality, nextBackgroundKey, nextRaceAssetKeys);
    };
    const completeFile = (key: string): void => {
      pendingFiles.delete(key);
      if (pendingFiles.size === 0) {
        finishLoading();
      }
    };

    if (pendingFiles.size === 0) {
      finishLoading();
      return;
    }

    pendingFiles.forEach((url, key) => {
      const fileType = key === nextBackgroundKey ? 'image' : 'image';
      this.load.image(key, url);
      this.load.once(`filecomplete-${fileType}-${key}`, () => completeFile(key));
    });

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    this.load.start();
  }

  private applyQuality(
    quality: GraphicsQuality,
    backgroundKey: string,
    raceAssetKeys: RaceAssetKeys,
  ): void {
    const previousBackgroundKey = this.backgroundKey;
    const previousRaceAssetKeys = this.raceAssetKeys;
    this.backgroundImage?.setTexture(backgroundKey);
    this.raceAssetKeys = raceAssetKeys;
    this.dashboardImage?.setTexture(raceAssetKeys['dashboard-gauges']);
    this.speedNeedle?.setTexture(raceAssetKeys['gauge-needle']);
    this.tachometerNeedle?.setTexture(raceAssetKeys['gauge-needle']);
    this.backgroundKey = backgroundKey;
    this.activeQuality = quality;

    if (previousBackgroundKey !== backgroundKey && this.textures.exists(previousBackgroundKey)) {
      this.textures.remove(previousBackgroundKey);
    }
    raceAssetNames.forEach((name) => {
      const previousKey = previousRaceAssetKeys[name];
      if (previousKey !== raceAssetKeys[name] && this.textures.exists(previousKey)) {
        this.textures.remove(previousKey);
      }
    });

    this.graphicsSettings?.qualitySelector.refresh();
    this.graphicsSettings?.setEnabled(true);
    this.layoutBackground(this.scale.width, this.scale.height);
    this.layoutRaceArtwork(this.scale.width, this.scale.height);
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
