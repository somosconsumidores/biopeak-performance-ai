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

/**
 * Checks if the given activity type is a cycling activity
 */
export const isCyclingActivity = (activityType: string | null | undefined): boolean => {
  if (!activityType) return false;
  return CYCLING_ACTIVITY_TYPES.includes(activityType.toLowerCase());
};

/**
 * Converts pace (min/km) to speed (km/h)
 */
export const paceToSpeed = (paceMinPerKm: number): number => {
  if (!paceMinPerKm || paceMinPerKm <= 0) return 0;
  return 60 / paceMinPerKm;
};

/**
 * Formats speed in km/h
 */
export const formatSpeed = (paceMinPerKm: number | null | undefined): string => {
  if (!paceMinPerKm || paceMinPerKm <= 0) return '--';
  const speed = paceToSpeed(paceMinPerKm);
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
