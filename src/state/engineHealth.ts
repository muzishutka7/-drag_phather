import { getPartHealth, setPartHealth } from './partHealth';

/** Saved engine condition of a car, 0..100 %. */
export function getEngineHealth(carId: string): number {
  return getPartHealth(carId, 'engine');
}

export function setEngineHealth(carId: string, health: number): void {
  setPartHealth(carId, 'engine', health);
}
