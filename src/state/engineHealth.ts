const STORAGE_KEY_PREFIX = 'drag-racing.engine-health.';
const inMemoryHealth = new Map<string, number>();

/** Saved engine condition of a car, 0..100 %. */
export function getEngineHealth(carId: string): number {
  const cached = inMemoryHealth.get(carId);
  if (cached !== undefined) {
    return cached;
  }

  let health = 100;
  if (typeof window !== 'undefined') {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY_PREFIX + carId));
      if (window.localStorage.getItem(STORAGE_KEY_PREFIX + carId) !== null && Number.isFinite(saved)) {
        health = Math.max(0, Math.min(100, saved));
      }
    } catch (error) {
      console.warn('Could not read the engine health.', error);
    }
  }

  inMemoryHealth.set(carId, health);
  return health;
}

export function setEngineHealth(carId: string, health: number): void {
  const value = Math.max(0, Math.min(100, health));
  inMemoryHealth.set(carId, value);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY_PREFIX + carId, value.toFixed(2));
  } catch (error) {
    console.warn('Could not save the engine health.', error);
  }
}
