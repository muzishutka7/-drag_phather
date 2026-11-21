import { getCarById, type CarDefinition } from '../gameobjects/cars/carCatalog';

const STORAGE_KEY = 'drag-racing.selected-car';
let selectedCarId: string | undefined;

/** The car the player drives (remembered between sessions). */
export function getSelectedCar(): CarDefinition {
  if (selectedCarId === undefined && typeof window !== 'undefined') {
    try {
      selectedCarId = window.localStorage.getItem(STORAGE_KEY) ?? undefined;
    } catch (error) {
      console.warn('Could not read the selected car.', error);
    }
  }
  return getCarById(selectedCarId);
}

export function setSelectedCar(id: string): void {
  selectedCarId = getCarById(id).id;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, selectedCarId);
  } catch (error) {
    console.warn('Could not save the selected car.', error);
  }
}
