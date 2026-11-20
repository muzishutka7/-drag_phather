import Phaser from 'phaser';

/**
 * Tire smoke and rubber marks for spinning driven wheels.
 *
 * Everything lives in track metres and is drawn relative to the car, so the
 * smoke stays where it was made while the car drives away and the marks
 * scroll with the asphalt.
 *
 * How much smoke:
 *  - nothing below a few km/h of wheel slip;
 *  - "rubber heat" builds up the longer the wheel keeps spinning and cools
 *    down when it grips again, so a burnout starts thin and gets thick;
 *  - hotter tires (warmup bar) smoke more, overheated ones the most;
 *  - more slip = more and faster puffs.
 */

export interface TireEffectsWheel {
  /** Wheel contact point on screen (px). */
  screenX: number;
  screenY: number;
}

export interface TireEffectsState {
  /** Car position on the track (m) and speed (m/s). */
  distanceMeters: number;
  speedMps: number;
  /** Driven wheel surface speed minus car speed (km/h). */
  wheelSlipKph: number;
  /** Tire warmup 0..100. */
  tireWarmup: number;
  /** Driven wheels' contact points. */
  wheels: readonly TireEffectsWheel[];
  /** Screen x of the car's front bumper (px) — reference for track metres. */
  carFrontScreenX: number;
  /** Track scale (px per metre) used for scrolling. */
  trackPixelsPerMeter: number;
  /** Visual scale of the car sprite (px per metre) used for smoke sizes. */
  carPixelsPerMeter: number;
}

export interface TireEffects {
  update: (deltaMs: number, state: TireEffectsState) => void;
  reset: () => void;
  destroy: () => void;
}

const PUFF_TEXTURE = 'tire-smoke-puff';
const POOL_SIZE = 220;
/** Fraction of puffs drawn in front of the car (lighter), the rest behind it. */
const FRONT_SHARE = 0.35;
const MIN_SLIP_KPH = 3;
const FULL_SLIP_KPH = 32;
/** Rubber heat: seconds of hard spin to reach full smoke, and cool-down time. */
const HEAT_UP_SECONDS = 2.2;
const COOL_DOWN_SECONDS = 1.4;
const MAX_PUFFS_PER_SECOND = 90;
const MARK_MAX_ALPHA = 0.62;
const MARK_KEEP_METERS = 160;
const MARK_SEGMENT_METERS = 0.4;

interface Puff {
  image: Phaser.GameObjects.Image;
  active: boolean;
  /** Track position (m) and height above the ground (m). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  startSize: number;
  endSize: number;
  maxAlpha: number;
  spin: number;
}

interface Mark {
  /** Track metres, start <= end. */
  start: number;
  end: number;
  alpha: number;
  wheel: number;
}

export function createTireEffects(scene: Phaser.Scene): TireEffects {
  ensurePuffTexture(scene);

  const behind = scene.add.layer().setDepth(1.9).setName('tire-smoke-behind');
  const inFront = scene.add.layer().setDepth(2.2).setName('tire-smoke-front');
  const marks = scene.add.graphics().setDepth(-0.4).setName('tire-marks');

  const puffs: Puff[] = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    const front = index < POOL_SIZE * FRONT_SHARE;
    const image = scene.add.image(0, 0, PUFF_TEXTURE).setVisible(false);
    (front ? inFront : behind).add(image);
    puffs.push({
      image, active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1,
      startSize: 1, endSize: 1, maxAlpha: 0, spin: 0,
    });
  }

  let rubberHeat = 0;
  let spawnCarry = 0;
  let lastDistance = 0;
  const markList: Mark[] = [];
  const openMarks = new Map<number, Mark>();

  const freePuff = (preferFront: boolean): Puff | undefined => {
    const frontCount = Math.floor(POOL_SIZE * FRONT_SHARE);
    const [from, to] = preferFront ? [0, frontCount] : [frontCount, POOL_SIZE];
    for (let index = from; index < to; index += 1) {
      if (!puffs[index].active) {
        return puffs[index];
      }
    }
    return undefined;
  };

  const reset = (): void => {
    puffs.forEach((puff) => {
      puff.active = false;
      puff.image.setVisible(false);
    });
    markList.length = 0;
    openMarks.clear();
    marks.clear();
    rubberHeat = 0;
    spawnCarry = 0;
  };

  return {
    reset,
    destroy: () => {
      behind.destroy(true);
      inFront.destroy(true);
      marks.destroy();
    },
    update: (deltaMs, state) => {
      const dt = Math.min(deltaMs / 1000, 0.1);
      if (state.distanceMeters + 0.5 < lastDistance) {
        reset(); // a new run started
      }
      lastDistance = state.distanceMeters;

      const ppm = state.trackPixelsPerMeter;
      const toScreenX = (meters: number): number => (
        state.carFrontScreenX + (meters - state.distanceMeters) * ppm
      );
      const toTrack = (screenX: number): number => (
        state.distanceMeters + (screenX - state.carFrontScreenX) / ppm
      );

      // ---- how hard is it smoking
      const slip = Phaser.Math.Clamp(
        (state.wheelSlipKph - MIN_SLIP_KPH) / (FULL_SLIP_KPH - MIN_SLIP_KPH),
        0,
        1,
      );
      rubberHeat = slip > 0
        ? Math.min(1, rubberHeat + (dt / HEAT_UP_SECONDS) * (0.35 + 0.65 * slip))
        : Math.max(0, rubberHeat - dt / COOL_DOWN_SECONDS);
      const tireHeat = Phaser.Math.Clamp(state.tireWarmup / 100, 0, 1);
      // Thin at first, thick after a long spin on hot tires.
      const heat = Math.max(rubberHeat, 0.5 * tireHeat + 0.5 * rubberHeat * tireHeat);
      const intensity = slip * (0.12 + 0.88 * heat);

      // ---- spawn puffs at every driven wheel
      const carPxPerM = state.carPixelsPerMeter;
      // The car is drawn bigger than the track scrolls; move smoke at the car's scale.
      const visualToTrack = carPxPerM / ppm;
      if (intensity > 0.01) {
        spawnCarry += MAX_PUFFS_PER_SECOND * intensity * dt * state.wheels.length;
        while (spawnCarry >= 1) {
          spawnCarry -= 1;
          const wheel = state.wheels[Math.floor(Math.random() * state.wheels.length)];
          const front = Math.random() < FRONT_SHARE;
          const puff = freePuff(front) ?? freePuff(!front);
          if (!puff) {
            break;
          }
          const slipMps = state.wheelSlipKph / 3.6;
          puff.active = true;
          puff.x = toTrack(wheel.screenX) + Phaser.Math.FloatBetween(-0.15, 0.25);
          puff.y = Phaser.Math.FloatBetween(-0.05, 0.1);
          // Rubber is thrown backwards off the spinning tread, then the cloud
          // slows down in the air and rises.
          // (velocities are in car-sized metres; converted to track metres below)
          puff.vx = (-Math.min(slipMps * 0.4, 9) * Phaser.Math.FloatBetween(0.5, 1.15)
            + Phaser.Math.FloatBetween(-0.5, 0.5)) * visualToTrack;
          puff.vy = Phaser.Math.FloatBetween(0.08, 0.45) * (0.6 + 0.6 * heat);
          puff.age = 0;
          puff.life = Phaser.Math.FloatBetween(1.2, 2.2) * (0.7 + 0.9 * heat);
          puff.startSize = Phaser.Math.FloatBetween(0.25, 0.45);
          puff.endSize = Phaser.Math.FloatBetween(1.1, 2.1) * (0.75 + 0.6 * heat);
          const isFront = puffs.indexOf(puff) < POOL_SIZE * FRONT_SHARE;
          // Puffs in front of the car stay low (they come off the tire and
          // roll along the ground); the big cloud builds up behind the car.
          if (isFront) {
            puff.endSize *= 0.7;
            puff.vy *= 0.5;
          }
          puff.maxAlpha = (0.12 + 0.4 * intensity) * (isFront ? 0.75 : 1);
          puff.spin = Phaser.Math.FloatBetween(-0.6, 0.6);
          const shade = Math.round(Phaser.Math.Linear(188, 228, heat) + Phaser.Math.Between(-14, 14));
          puff.image
            .setVisible(true)
            .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
            .setTint(Phaser.Display.Color.GetColor(shade, shade, Math.min(255, shade + 4)));
        }
      }

      // ---- move / grow / fade puffs
      const groundY = state.wheels.length > 0 ? state.wheels[0].screenY : 0;
      puffs.forEach((puff) => {
        if (!puff.active) {
          return;
        }
        puff.age += dt;
        if (puff.age >= puff.life) {
          puff.active = false;
          puff.image.setVisible(false);
          return;
        }
        const drag = Math.exp(-1.6 * dt);
        puff.vx *= drag;
        puff.vy = puff.vy * Math.exp(-0.8 * dt) + 0.08 * dt; // warm air keeps rising a little
        puff.x += puff.vx * dt;
        puff.y += puff.vy * dt;

        const t = puff.age / puff.life;
        // fast ease-out growth, quick fade-in, long soft fade-out
        const size = Phaser.Math.Linear(puff.startSize, puff.endSize, 1 - (1 - t) ** 2.2);
        const alpha = puff.maxAlpha * Math.min(1, t / 0.08) * (1 - t) ** 1.6;
        const texturePx = puff.image.width;
        puff.image
          .setPosition(toScreenX(puff.x), groundY - (puff.y + size * 0.28) * carPxPerM)
          .setScale((size * carPxPerM) / texturePx)
          .setAlpha(alpha)
          .setRotation(puff.image.rotation + puff.spin * dt);
      });

      // ---- rubber marks on the asphalt
      state.wheels.forEach((wheel, index) => {
        const contact = toTrack(wheel.screenX);
        if (slip <= 0) {
          openMarks.delete(index);
          return;
        }
        let mark = openMarks.get(index);
        // Rolling: split the mark into short pieces so it fades out as the
        // tire stops spinning, instead of one evenly dark stripe.
        if (mark && mark.end - mark.start > MARK_SEGMENT_METERS) {
          openMarks.delete(index);
          mark = { start: mark.end, end: mark.end, alpha: 0, wheel: index };
          markList.push(mark);
          openMarks.set(index, mark);
        }
        if (!mark) {
          mark = { start: contact, end: contact, alpha: 0, wheel: index };
          markList.push(mark);
          openMarks.set(index, mark);
        }
        mark.start = Math.min(mark.start, contact);
        mark.end = Math.max(mark.end, contact);
        // Standing still the rubber piles up in one spot and gets darker;
        // rolling, each piece of asphalt only gets a short touch.
        const dwell = state.speedMps < 1 ? 1 : Phaser.Math.Clamp(1.5 / state.speedMps, 0.05, 1);
        mark.alpha = Math.min(MARK_MAX_ALPHA, mark.alpha + dt * (0.25 + 0.9 * heat) * slip * dwell * 2.2);
        mark.alpha = Math.max(mark.alpha, MARK_MAX_ALPHA * slip * (0.25 + 0.6 * heat));
      });

      while (markList.length > 0 && markList[0].end < state.distanceMeters - MARK_KEEP_METERS) {
        markList.shift();
      }

      marks.clear();
      const markHeight = Math.max(1.5, carPxPerM * 0.055);
      const tireLength = carPxPerM * 0.45;
      markList.forEach((mark) => {
        const x0 = toScreenX(mark.start) - tireLength / 2;
        const x1 = toScreenX(mark.end) + tireLength / 2;
        if (x1 < -20 || x0 > scene.scale.width + 20) {
          return;
        }
        const y = groundY - markHeight * 0.6;
        marks.fillStyle(0x0b0b0c, mark.alpha * 0.55);
        marks.fillRect(x0, y - markHeight * 0.25, x1 - x0, markHeight * 1.5);
        marks.fillStyle(0x060606, mark.alpha);
        marks.fillRect(x0, y, x1 - x0, markHeight);
      });
    },
  };
}

/** Soft, slightly lumpy smoke puff (white, tinted per particle). */
function ensurePuffTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PUFF_TEXTURE)) {
    return;
  }

  const size = 128;
  const texture = scene.textures.createCanvas(PUFF_TEXTURE, size, size);
  if (!texture) {
    return;
  }
  const context = texture.getContext();
  const blob = (x: number, y: number, radius: number, alpha: number): void => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.45})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  };
  blob(64, 64, 60, 0.5);
  // A few offset lumps make the edge irregular, like real smoke.
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = 0; index < 14; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 14 + random() * 22;
    blob(64 + Math.cos(angle) * distance, 64 + Math.sin(angle) * distance, 16 + random() * 20, 0.55);
  }
  texture.refresh();
}
