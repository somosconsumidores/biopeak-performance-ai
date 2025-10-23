/**
 * Utility functions for validating race target times against historical performance
 * and world record benchmarks
 */

export type ValidationLevel = 'realistic' | 'ambitious' | 'very_ambitious' | 'impossible';

export interface TimeValidation {
  level: ValidationLevel;
  message: string;
  improvement: number;
  canProceed: boolean; // New field to block impossible goals
}

interface WorldRecordLimits {
  [key: string]: number; // in minutes
}

// World record benchmarks with safety margin
const WORLD_RECORD_LIMITS: WorldRecordLimits = {
  '5000': 13,    // ~12:35 WR + margin
  '10000': 27,   // ~26:11 WR + margin
  '21097': 58,   // ~57:30 WR + margin
  '42195': 122,  // ~2:00:35 WR + margin
};

/**
 * Validates a target time against historical performance and world records
 * @param targetMinutes - Target time in minutes
 * @param distanceMeters - Race distance in meters
 * @param historicalMinutes - Historical/best time for this distance (optional)
 * @returns Validation result with level, message, and whether user can proceed
 */
export function validateRaceTime(
  targetMinutes: number,
  distanceMeters: number,
  historicalMinutes?: number
): TimeValidation {
  // Get world record limit for this distance
  const worldRecordLimit = WORLD_RECORD_LIMITS[distanceMeters.toString()];

  // Check against world records even without historical data
  if (worldRecordLimit && targetMinutes < worldRecordLimit) {
    return {
      level: 'impossible',
      message: `⛔ Este tempo está próximo ao recorde mundial! Para um atleta amador, é fisicamente impossível. Reconsidere sua meta.`,
      improvement: 0,
      canProceed: false,
    };
  }

  // If no historical data, we can't validate further
  if (!historicalMinutes || historicalMinutes <= 0) {
    return {
      level: 'realistic',
      message: '✅ Meta definida. Não temos dados históricos para validação adicional.',
      improvement: 0,
      canProceed: true,
    };
  }

  // Calculate improvement percentage
  const improvementPercent = ((historicalMinutes - targetMinutes) / historicalMinutes) * 100;

  // If target is slower than historical (negative improvement)
  if (improvementPercent < 0) {
    return {
      level: 'realistic',
      message: `✅ Meta conservadora. Seu histórico indica que você pode ser mais ambicioso se desejar.`,
      improvement: improvementPercent,
      canProceed: true,
    };
  }

  // Validate based on improvement percentage
  if (improvementPercent > 35) {
    return {
      level: 'impossible',
      message: `⛔ Meta extremamente agressiva! Você está tentando melhorar ${improvementPercent.toFixed(0)}% em relação ao seu histórico (${formatMinutes(historicalMinutes)}). Melhorias acima de 30-35% são praticamente impossíveis em um ciclo de treino.`,
      improvement: improvementPercent,
      canProceed: false,
    };
  } else if (improvementPercent > 20) {
    return {
      level: 'very_ambitious',
      message: `⚠️ Meta muito ambiciosa! Você está buscando ${improvementPercent.toFixed(0)}% de melhoria. Isso requer treino perfeito, condições ideais e pode ser arriscado. Considere uma meta mais conservadora.`,
      improvement: improvementPercent,
      canProceed: false,
    };
  } else if (improvementPercent > 12) {
    return {
      level: 'ambitious',
      message: `💪 Meta ambiciosa mas alcançável! ${improvementPercent.toFixed(0)}% de melhoria requer dedicação total e consistência. Certifique-se de seguir o plano rigorosamente.`,
      improvement: improvementPercent,
      canProceed: true,
    };
  } else {
    return {
      level: 'realistic',
      message: `✅ Meta realista! Melhoria de ${improvementPercent.toFixed(1)}% é perfeitamente alcançável com treino consistente.`,
      improvement: improvementPercent,
      canProceed: true,
    };
  }
}

/**
 * Formats minutes into a human-readable time string
 */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}min`;
  } else {
    return `${minutes}min`;
  }
}

/**
 * Gets the distance key for validation based on common race distances
 */
export function normalizeDistanceForValidation(distanceMeters: number): number {
  // Map to closest standard distance
  if (distanceMeters <= 5500) return 5000;
  if (distanceMeters <= 11000) return 10000;
  if (distanceMeters <= 25000) return 21097;
  return 42195;
}
