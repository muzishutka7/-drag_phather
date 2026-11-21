import Phaser from 'phaser';
import {
  type BackgroundName,
  getBackgroundKey,
  preloadBackground,
} from '../../assets/backgrounds';
import {
  getRaceAssetKeys,
  preloadRaceAssets,
  raceAssetNames,
  type RaceAssetKeys,
} from '../../assets/raceAssets';
import { getAssetPreloader, startSceneWhenReady } from '../../assets/AssetPreloadScene';
import { RaceAudio } from '../../audio/raceAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { palette } from '../../config/palette';
import { preloadVehicleAssets } from '../../assets/vehicleAssets';
import type { CarDefinition } from '../../gameobjects/cars/carCatalog';
import { getCarVisualParts, REFERENCE_CAR_LENGTH_MM } from '../../gameobjects/cars/carVisuals';
import { createCarModel, type CarModel } from '../../gameobjects/cars/createCarModel';
import { createRaceControls, type RaceControls } from '../../gameobjects/race/createRaceControls';
import { createRaceHud, type RaceHud } from '../../gameobjects/race/createRaceHud';
import { createSpeedLcd, type SpeedLcd } from '../../gameobjects/race/createSpeedLcd';
import { createTireEffects, type TireEffects } from '../../gameobjects/race/createTireEffects';
import {
  createTireWarmupGauge,
  type TireWarmupGauge,
} from '../../gameobjects/race/createTireWarmupGauge';
import { RaceEngine } from '../../gameobjects/race/raceEngine';
import { RaceSession } from '../../gameobjects/race/raceSession';
import {
  getGraphicsQuality,
  setGraphicsQuality,
  type GraphicsQuality,
} from '../../settings/graphicsQuality';
import { getRenderResolution, getRenderResolutionScale } from '../../settings/renderResolution';
import { createGraphicsSettings, type GraphicsSettings } from '../../ui/createGraphicsSettings';
import { getEngineHealth, setEngineHealth } from '../../state/engineHealth';
import { getSelectedCar } from '../../state/selectedCar';
import { createCheckEngineIcon, type CheckEngineIcon } from '../../ui/createCheckEngineIcon';
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
/** Lifts the car from the lane line into the middle of the upper lane (layout px). */
const CAR_LANE_VERTICAL_OFFSET = 37;
const CAR_SCALE = 1.32;
/** On-screen length of a REFERENCE_CAR_LENGTH_MM car at CAR_SCALE 1 (960×540 layout pixels). */
const CAR_LENGTH_PX = 250;
/** Visual cap so fast wheels do not strobe. */
const MAX_WHEEL_ANGULAR_VELOCITY = Math.PI * 10;
/** How many screen pixels (at 960×540 layout) one meter of track takes. */
const PIXELS_PER_METER = 28;
/** Distance from the car origin to the front bumper of the reference car, in layout pixels. */
const CAR_FRONT_OFFSET = 124;
const BACKGROUND_PARALLAX = 0.08;
/** Throttle held this close to the redline plays the rev limiter sound. */
const LIMITER_SOUND_RPM_WINDOW = 150;
/**
 * Check-engine light on the tachometer face, below the needle hub
 * (cluster-local pixels; the tachometer center is at -206, -236).
 */
const CHECK_ENGINE_POSITION = { x: -202, y: -160 };
const CHECK_ENGINE_SCALE = 1.1;
/**
 * Outline of the empty gap at the bottom between the tachometer and the
 * speedometer (cluster-local pixels, traced from the dashboard artwork and
 * widened a little so the gauge rims cover its edges).
 */
const GEAR_GAP_OUTLINE: ReadonlyArray<[number, number]> = [
  [-38, -173], [-30, -165], [-29, -157], [-25, -149], [-21, -141], [-17, -133],
  [-13, -125], [-9, -117], [-7, -109], [-1, -101], [7, -93], [11, -85], [21, -77],
  [25, -69], [34, -61], [120, 0], [-160, 0], [-152, -61], [-132, -69], [-118, -77],
  [-107, -85], [-96, -93], [-86, -101], [-79, -109], [-72, -117], [-66, -125],
  [-61, -133], [-55, -141], [-50, -149], [-46, -157], [-41, -165],
];
/** Gear number position in that gap (lower part of the screen hides about 78 px). */
const GEAR_READOUT_POSITION = { x: -44, y: -110 };
/** The empty light-grey window of the speedometer artwork (cluster-local pixels). */
const SPEED_LCD = { x: 171, y: -124, width: 126, height: 42 };
const SHIFT_LIGHT_OFF = 0x151918;
const SHIFT_LIGHT_WARNING = 0xc98a12;
const SHIFT_LIGHT_LIMITER = 0xc62f28;
/** The shift light comes on this many rpm below the redline. */
const SHIFT_LIGHT_WARNING_RPM = 400;
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
  private carModel?: CarModel;
  private tireEffects?: TireEffects;
  private car: CarDefinition = getSelectedCar();
  private engine = new RaceEngine(this.car.profile);
  private session = new RaceSession(this.engine);
  private hud?: RaceHud;
  private savedEngineHealth = 100;
  private checkEngineIcon?: CheckEngineIcon;
  private speedLcd?: SpeedLcd;
  private warmupGauge?: TireWarmupGauge;
  private trackMarks?: Phaser.GameObjects.Graphics;
  private audio?: RaceAudio;
  private throttlePressed = false;
  private soundEvents = { countdown: -1, amber: 0, green: false, phase: '', gear: 0 };
  private drivenWheelRotation = 0;
  private freeWheelRotation = 0;
  private instrumentContainer?: Phaser.GameObjects.Container;
  private raceControls?: RaceControls;
  private dashboardImage?: Phaser.GameObjects.Image;
  private speedNeedle?: Phaser.GameObjects.Image;
  private tachometerNeedle?: Phaser.GameObjects.Image;
  private gearReadout?: Phaser.GameObjects.Text;
  private gearReadoutBackground?: Phaser.GameObjects.Graphics;
  private gearReadoutColor = -1;

  constructor() {
    super('RaceScene');
  }

  /** Front bumper offset of the current car (shorter cars end sooner). */
  private get carFrontOffset(): number {
    return CAR_FRONT_OFFSET * (this.car.visual.lengthMm / REFERENCE_CAR_LENGTH_MM);
  }

  init(): void {
    this.isBackgroundLoading = false;
    const car = getSelectedCar();
    if (car.id !== this.car.id) {
      this.car = car;
      this.engine = new RaceEngine(car.profile);
      this.session = new RaceSession(this.engine);
    }
    this.session.restart();
    this.engine.engineHealth = getEngineHealth(this.engine.profile.id);
    this.savedEngineHealth = this.engine.engineHealth;
    this.carModel = undefined;
    this.drivenWheelRotation = 0;
    this.freeWheelRotation = 0;
    this.soundEvents = { countdown: -1, amber: 0, green: false, phase: '', gear: 0 };
  }

  preload(): void {
    this.activeQuality = getGraphicsQuality();
    this.backgroundKey = preloadBackground(this, BACKGROUND_NAME, this.activeQuality);
    this.raceAssetKeys = preloadRaceAssets(this, this.activeQuality);
    preloadVehicleAssets(this, getCarVisualParts(this.car.visual), this.activeQuality);
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
      this.tireEffects?.destroy();
      this.tireEffects = undefined;
      this.saveEngineHealth(true);
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
    this.throttlePressed = throttle;
    const brake = this.raceControls.isBrakePressed();
    this.session.update(delta, { throttle, brake });

    const phase = this.session.phase;
    this.hud?.update(this.session, { health: this.engine.engineHealth });
    this.speedLcd?.update(this.engine.speedKph);
    this.checkEngineIcon?.update(this.engine.engineHealth, this.engine.isOverRevving, this.time.now);
    this.saveEngineHealth(phase === 'finished');
    this.warmupGauge?.container.setVisible(phase === 'burnout' || phase === 'staging');
    this.warmupGauge?.update({
      warmup: this.engine.tireWarmup,
      gripMultiplier: this.engine.gripMultiplier,
      countdownSeconds: phase === 'burnout' ? this.session.countdownSeconds : undefined,
      locked: this.engine.lockedGripMultiplier !== undefined,
    });

    this.updateWheels(delta);
    this.updateTrack();
    this.updateTireEffects(delta);
    this.updateSound();
    this.gearReadout?.setText(this.engine.gear === 0 ? 'N' : String(this.engine.gear));
    this.updateShiftLight();
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

  /** Saves the engine condition when it changed noticeably (or when forced). */
  private saveEngineHealth(force: boolean): void {
    const health = this.engine.engineHealth;
    if (health === this.savedEngineHealth || (!force && Math.abs(health - this.savedEngineHealth) < 0.5)) {
      return;
    }

    setEngineHealth(this.engine.profile.id, health);
    this.savedEngineHealth = health;
  }

  /** Gear box turns amber close to the redline and red on the rev limiter. */
  private updateShiftLight(): void {
    const engine = this.engine;
    let color = SHIFT_LIGHT_OFF;
    if (engine.gear > 0 && engine.limiterActive) {
      color = SHIFT_LIGHT_LIMITER;
    } else if (engine.gear > 0 && engine.rpm >= engine.profile.redlineRpm - SHIFT_LIGHT_WARNING_RPM) {
      color = SHIFT_LIGHT_WARNING;
    }
    this.drawGearReadoutBackground(color);
  }

  /** Fills the gap between the gauges with the shift-light color. */
  private drawGearReadoutBackground(color: number): void {
    const background = this.gearReadoutBackground;
    if (!background || color === this.gearReadoutColor) {
      return;
    }

    this.gearReadoutColor = color;
    background.clear();
    background.fillStyle(color, 1);
    background.beginPath();
    background.moveTo(GEAR_GAP_OUTLINE[0][0], GEAR_GAP_OUTLINE[0][1]);
    GEAR_GAP_OUTLINE.slice(1).forEach(([x, y]) => background.lineTo(x, y));
    background.closePath();
    background.fillPath();
    background.lineStyle(4, 0x77817b, 0.95);
    background.strokePath();
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
      limiter: engine.limiterActive
        || (this.throttlePressed && engine.rpm >= engine.profile.redlineRpm - LIMITER_SOUND_RPM_WINDOW),
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
    (['front', 'rear'] as const).forEach((axle) => {
      const isDriven = drivetrain === 'all-wheel'
        || (drivetrain === 'front-wheel' && axle === 'front')
        || (drivetrain === 'rear-wheel' && axle === 'rear');
      this.carModel?.setWheelRotation(
        axle,
        isDriven ? this.drivenWheelRotation : this.freeWheelRotation,
      );
    });
  }

  /** Smoke and rubber marks from the driven wheels when they spin. */
  private updateTireEffects(delta: number): void {
    const car = this.carModel?.container;
    if (!this.tireEffects || !car) {
      return;
    }

    const { width, height } = this.scale;
    const layoutScale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    const pxPerMm = car.scaleX;
    const drivetrain = this.engine.profile.drivetrain;
    const axles = [
      ...(drivetrain !== 'front-wheel' ? [this.car.visual.rearAxle] : []),
      ...(drivetrain !== 'rear-wheel' ? [this.car.visual.frontAxle] : []),
    ];
    this.tireEffects.update(delta, {
      distanceMeters: this.engine.distanceMeters,
      speedMps: this.engine.velocityMps,
      wheelSlipKph: this.engine.wheelSpinSpeedKph,
      tireWarmup: this.engine.tireWarmup,
      wheels: axles.map((axle) => ({
        screenX: car.x + (axle.x - this.car.visual.lengthMm / 2) * pxPerMm,
        screenY: car.y,
      })),
      carFrontScreenX: (CAR_POSITION_X + this.carFrontOffset * CAR_SCALE) * layoutScale,
      trackPixelsPerMeter: PIXELS_PER_METER * layoutScale,
      carPixelsPerMeter: pxPerMm * 1000,
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
    const frontX = (CAR_POSITION_X + this.carFrontOffset * CAR_SCALE) * layoutScale;
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

    // Layered car (body, suspension, brakes, tires, rims); origin on the ground.
    this.carModel = createCarModel(this, this.car.visual, this.activeQuality);
    this.carContainer = this.carModel.container.setDepth(2);

    this.instrumentContainer = this.add.container(0, 0)
      .setName('instrument-cluster')
      .setDepth(4);
    this.dashboardImage = this.add.image(0, 0, this.raceAssetKeys['dashboard-gauges'])
      .setName('dashboard-gauges')
      .setOrigin(0.5, 1)
      .setDepth(0);
    // Gear number in the gap at the bottom between the two gauges. The filled
    // gap sits under the dashboard artwork, so the gauge rims frame it.
    const gearReadoutBackground = this.add.graphics().setName('gear-readout-background');
    this.gearReadoutBackground = gearReadoutBackground;
    this.gearReadoutColor = -1;
    this.drawGearReadoutBackground(SHIFT_LIGHT_OFF);
    this.gearReadout = this.add.text(GEAR_READOUT_POSITION.x, GEAR_READOUT_POSITION.y, 'N', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '56px',
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
      gearReadoutBackground,
      this.dashboardImage,
      this.speedNeedle,
      this.tachometerNeedle,
      this.gearReadout,
    ]);
    // "CHECK" engine light printed on the tachometer face, under the needles.
    this.checkEngineIcon = createCheckEngineIcon(this);
    this.checkEngineIcon.container.setPosition(CHECK_ENGINE_POSITION.x, CHECK_ENGINE_POSITION.y)
      .setScale(CHECK_ENGINE_SCALE);
    this.instrumentContainer.addAt(
      this.checkEngineIcon.container,
      this.instrumentContainer.getIndex(this.speedNeedle),
    );
    // Calculator-style digital speed in the speedometer's empty window, under the needles.
    this.speedLcd = createSpeedLcd(this, SPEED_LCD.width, SPEED_LCD.height);
    this.speedLcd.container.setPosition(SPEED_LCD.x, SPEED_LCD.y);
    this.speedLcd.update(0);
    this.instrumentContainer.addAt(
      this.speedLcd.container,
      this.instrumentContainer.getIndex(this.speedNeedle),
    );
    this.raceControls = createRaceControls(
      this,
      () => this.engine.shiftUp(),
      () => this.engine.shiftDown(),
    );
    this.instrumentContainer.add(this.raceControls.container);
    this.trackMarks = this.add.graphics().setName('track-marks').setDepth(-0.5);
    this.tireEffects = createTireEffects(this);
    this.warmupGauge = createTireWarmupGauge(this, this.engine.profile.tires);
    this.hud = createRaceHud(
      this,
      (distance) => this.session.selectDistance(distance),
      () => this.session.restart(),
      () => startSceneWhenReady(this, 'GarageScene'),
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
        wheelContactY - CAR_LANE_VERTICAL_OFFSET * layoutScale,
      )
      .setScale((CAR_LENGTH_PX * CAR_SCALE * layoutScale) / REFERENCE_CAR_LENGTH_MM);

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
      () => startSceneWhenReady(this, 'GarageScene'),
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
    void getAssetPreloader(this).loadScene('RaceScene').then(({ failed }) => {
      if (!this.sys.isActive()) {
        return;
      }
      this.isBackgroundLoading = false;
      if (failed.length === 0) {
        this.applyQuality(quality, nextBackgroundKey, nextRaceAssetKeys);
        return;
      }
      console.error(`Race graphics failed to load (${quality}): ${failed.join(', ')}`);
      setGraphicsQuality(this.activeQuality);
      this.graphicsSettings?.qualitySelector.refresh();
      this.graphicsSettings?.setEnabled(true);
    });
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
