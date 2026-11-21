import {
  MOSKVICH_412_PROFILE,
  STARTER_COUPE_PROFILE,
  TAVRIA_PROFILE,
  type CarEngineProfile,
} from './carProfiles';
import {
  LANOS_VISUAL,
  MOSKVICH_412_VISUAL,
  TAVRIA_VISUAL,
  type CarVisualProfile,
} from './carVisuals';

/** A car the player can drive: physics profile plus layered artwork. */
export interface CarDefinition {
  id: string;
  profile: CarEngineProfile;
  visual: CarVisualProfile;
}

export const playableCars: readonly CarDefinition[] = [
  { id: STARTER_COUPE_PROFILE.id, profile: STARTER_COUPE_PROFILE, visual: LANOS_VISUAL },
  { id: MOSKVICH_412_PROFILE.id, profile: MOSKVICH_412_PROFILE, visual: MOSKVICH_412_VISUAL },
  { id: TAVRIA_PROFILE.id, profile: TAVRIA_PROFILE, visual: TAVRIA_VISUAL },
];

export const DEFAULT_CAR = playableCars[0];

export function getCarById(id: string | null | undefined): CarDefinition {
  return playableCars.find((car) => car.id === id) ?? DEFAULT_CAR;
}
