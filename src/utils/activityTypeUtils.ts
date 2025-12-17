// Utility functions for activity type detection and formatting

const CYCLING_ACTIVITY_TYPES = [
  'ride',
  'cycling',
  'road_biking',
  'virtualride',
  'mountain_biking',
  'indoor_cycling',
  'virtual_ride',
  'ebikeride',
  'velomobile'
];

// Max realistic speed: 60 km/h for cycling, which is pace ~1.0 min/km
// Min realistic speed: 3 km/h (slow walk), which is pace ~20 min/km
const MIN_REALISTIC_PACE = 1.0; // min/km (60 km/h)
const MAX_REALISTIC_PACE = 20.0; // min/km (3 km/h)
const MAX_REALISTIC_SPEED_MS = 16.7; // m/s (60 km/h)

/**
 * Checks if the given activity type is a cycling activity
 */
export const isCyclingActivity = (activityType: string | null | undefined): boolean => {
  if (!activityType) return false;
  return CYCLING_ACTIVITY_TYPES.includes(activityType.toLowerCase());
};

/**
 * Validates if pace is within realistic limits
 */
export const isRealisticPace = (paceMinPerKm: number | null | undefined): boolean => {
  if (!paceMinPerKm || paceMinPerKm <= 0) return false;
  return paceMinPerKm >= MIN_REALISTIC_PACE && paceMinPerKm <= MAX_REALISTIC_PACE;
};

/**
 * Validates if speed in m/s is within realistic limits
 */
export const isRealisticSpeedMs = (speedMs: number | null | undefined): boolean => {
  if (!speedMs || speedMs <= 0) return false;
  return speedMs <= MAX_REALISTIC_SPEED_MS;
};

/**
 * Converts pace (min/km) to speed (km/h)
 */
export const paceToSpeed = (paceMinPerKm: number): number => {
  if (!paceMinPerKm || paceMinPerKm <= 0) return 0;
  return 60 / paceMinPerKm;
};

/**
 * Converts pace to speed only if pace is realistic
 */
export const paceToSpeedSafe = (paceMinPerKm: number | null | undefined): number | null => {
  if (!isRealisticPace(paceMinPerKm)) return null;
  return 60 / paceMinPerKm!;
};

/**
 * Converts speed in m/s to km/h safely
 */
export const speedMsToKmhSafe = (speedMs: number | null | undefined): number | null => {
  if (!isRealisticSpeedMs(speedMs)) return null;
  return speedMs! * 3.6;
};

/**
 * Formats speed in km/h
 */
export const formatSpeed = (paceMinPerKm: number | null | undefined): string => {
  if (!isRealisticPace(paceMinPerKm)) return '--';
  const speed = paceToSpeed(paceMinPerKm!);
  return `${speed.toFixed(1)} km/h`;
};

/**
 * Formats pace in min/km
 */
export const formatPaceMinKm = (paceMinutes: number | null | undefined): string => {
  if (!paceMinutes || paceMinutes <= 0) return '--';
  const minutes = Math.floor(paceMinutes);
  const seconds = Math.round((paceMinutes - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
};

/**
 * Formats speed or pace based on activity type
 */
export const formatSpeedOrPace = (
  paceMinPerKm: number | null | undefined,
  activityType: string | null | undefined
): string => {
  if (isCyclingActivity(activityType)) {
    return formatSpeed(paceMinPerKm);
  }
  return formatPaceMinKm(paceMinPerKm);
};

/**
 * Returns the label for speed/pace based on activity type
 */
export const getSpeedOrPaceLabel = (activityType: string | null | undefined): string => {
  return isCyclingActivity(activityType) ? 'Velocidade Média' : 'Pace Médio';
};
