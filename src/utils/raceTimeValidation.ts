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

// Minimum realistic times for amateur runners (safety floor)
// These prevent absurdly fast times that no amateur could achieve
const AMATEUR_MINIMUM_TIMES: WorldRecordLimits = {
  '5000': 15,    // 15 minutes for 5km (3:00/km pace)
  '10000': 30,   // 30 minutes for 10km (3:00/km pace)
  '21097': 65,   // 1h05min for half marathon (3:05/km pace)
  '42195': 135,  // 2h15min for marathon (3:12/km pace)
};

// Tempos MÍNIMOS recomendados para iniciantes absolutos (sem histórico)
// Baseados em pace de 7:00-8:30/km dependendo da distância
const BEGINNER_RECOMMENDED_TIMES: WorldRecordLimits = {
  '5000': 32,    // 32 minutos (6:24/km) - conservador mas alcançável
  '10000': 65,   // 1h05min (6:30/km)
  '21097': 155,  // 2h35min (7:20/km)
  '42195': 330,  // 5h30min (7:48/km)
};

/**
 * Validates a target time against historical performance and world records
 * @param targetMinutes - Target time in minutes
 * @param distanceMeters - Race distance in meters
 * @param historicalMinutes - Historical/best time for this distance (optional)
 * @param isAbsoluteBeginner - Whether user is absolute beginner without pace knowledge (optional)
 * @returns Validation result with level, message, and whether user can proceed
 */
export function validateRaceTime(
  targetMinutes: number,
  distanceMeters: number,
  historicalMinutes?: number,
  isAbsoluteBeginner?: boolean
): TimeValidation {
  console.log('🔍 VALIDATION START:', {
    targetMinutes,
    distanceMeters,
    historicalMinutes,
    targetType: typeof targetMinutes,
    distanceType: typeof distanceMeters
  });

  // LAYER 1: Sanity check - Block absurdly fast times (faster than 3:00/km pace)
  const amateurMinimum = AMATEUR_MINIMUM_TIMES[distanceMeters.toString()];
  console.log('🔍 LAYER 1 - Amateur minimum check:', {
    amateurMinimum,
    targetMinutes,
    willBlock: amateurMinimum && targetMinutes < amateurMinimum
  });
  
  if (amateurMinimum && targetMinutes < amateurMinimum) {
    const pacePerKm = targetMinutes / (distanceMeters / 1000);
    const result = {
      level: 'impossible' as ValidationLevel,
      message: `⛔ Este tempo (${formatMinutes(targetMinutes)}) é fisicamente impossível para atletas amadores! Ritmo médio seria de ${pacePerKm.toFixed(2)} min/km. Para referência, o mínimo realista é ${formatMinutes(amateurMinimum)}.`,
      improvement: 0,
      canProceed: false,
    };
    console.log('🚫 BLOCKED by amateur minimum:', result);
    return result;
  }

  // LAYER 2: Check against world records even without historical data
  const worldRecordLimit = WORLD_RECORD_LIMITS[distanceMeters.toString()];
  console.log('🔍 LAYER 2 - World record check:', {
    worldRecordLimit,
    targetMinutes,
    willBlock: worldRecordLimit && targetMinutes < worldRecordLimit
  });
  
  if (worldRecordLimit && targetMinutes < worldRecordLimit) {
    const result = {
      level: 'impossible' as ValidationLevel,
      message: `⛔ Este tempo está próximo ao recorde mundial! Para um atleta amador, é fisicamente impossível. Reconsidere sua meta.`,
      improvement: 0,
      canProceed: false,
    };
    console.log('🚫 BLOCKED by world record:', result);
    return result;
  }

  // LAYER 3: Se não há histórico, validar contra tempos recomendados para iniciantes
  if (!historicalMinutes || historicalMinutes <= 0) {
    // Se o usuário é iniciante absoluto, aplicar validação especial
    if (isAbsoluteBeginner) {
      const beginnerMinimum = BEGINNER_RECOMMENDED_TIMES[distanceMeters.toString()];
      
      if (beginnerMinimum) {
        const percentBelowRecommended = ((beginnerMinimum - targetMinutes) / beginnerMinimum) * 100;
        
        console.log('🔍 LAYER 3 - Beginner validation:', {
          targetMinutes,
          beginnerMinimum,
          percentBelowRecommended
        });
        
        // Se o tempo é MUITO mais rápido que o recomendado (>20% mais rápido)
        if (percentBelowRecommended > 20) {
          return {
            level: 'very_ambitious',
            message: `⚠️ Meta muito ambiciosa para iniciante! Você está tentando completar em ${formatMinutes(targetMinutes)}, mas para quem está começando, recomendamos pelo menos ${formatMinutes(beginnerMinimum)}. Isso dá um ritmo médio de ${(targetMinutes / (distanceMeters / 1000)).toFixed(2)} min/km, que pode ser muito desafiador sem base de treino.`,
            improvement: percentBelowRecommended,
            canProceed: true,
          };
        }
        
        // Se o tempo é um pouco mais rápido (10-20% mais rápido)
        if (percentBelowRecommended > 10) {
          return {
            level: 'ambitious',
            message: `💪 Meta ambiciosa mas possível! Para iniciante, recomendamos ${formatMinutes(beginnerMinimum)}, mas sua meta de ${formatMinutes(targetMinutes)} é alcançável com dedicação total. Ritmo médio: ${(targetMinutes / (distanceMeters / 1000)).toFixed(2)} min/km.`,
            improvement: percentBelowRecommended,
            canProceed: true,
          };
        }
        
        // Se está dentro ou mais lento que o recomendado
        return {
          level: 'realistic',
          message: `✅ Meta realista para iniciante! Tempo de ${formatMinutes(targetMinutes)} é um objetivo adequado para construir base com segurança.`,
          improvement: 0,
          canProceed: true,
        };
      }
    }
    
    // Se não é iniciante ou não temos benchmark
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
