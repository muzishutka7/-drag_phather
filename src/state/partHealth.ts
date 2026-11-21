/** Car parts that wear and can be repaired in the garage. */
export const carParts = ['engine', 'suspension', 'body'] as const;
export type CarPart = (typeof carParts)[number];

const STORAGE_KEY_PREFIX = 'drag-racing.';
const inMemoryHealth = new Map<string, number>();

function storageKey(carId: string, part: CarPart): string {
  return `${STORAGE_KEY_PREFIX}${part}-health.${carId}`;
}

/** Saved condition of a part, 0..100 %. */
export function getPartHealth(carId: string, part: CarPart): number {
  const key = storageKey(carId, part);
  const cached = inMemoryHealth.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let health = 100;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(key);
      const value = Number(saved);
      if (saved !== null && Number.isFinite(value)) {
        health = Math.max(0, Math.min(100, value));
      }
    } catch (error) {
      console.warn(`Could not read the ${part} health.`, error);
    }
  }

  inMemoryHealth.set(key, health);
  return health;
}

export function setPartHealth(carId: string, part: CarPart, health: number): void {
  const key = storageKey(carId, part);
  const value = Math.max(0, Math.min(100, health));
  inMemoryHealth.set(key, value);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value.toFixed(2));
  } catch (error) {
    console.warn(`Could not save the ${part} health.`, error);
  }
}
