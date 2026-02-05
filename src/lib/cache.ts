/**
 * Centralized cache utility for local storage caching
 * with user-scoped data and expiration handling
 */

export const CACHE_KEYS = {
  PROFILE: 'biopeak_profile_cache_v1',
  PROFILE_STATS: 'biopeak_profile_stats_cache_v1',
  ACTIVITIES: 'biopeak_activities_cache_v1',
  COACH_ADVICE: 'biopeak_coach_advice_cache_v1',
  COACH_INSIGHTS: 'biopeak_coach_insights_cache_v1',
  TRAINING_PLANS: 'training_plans_cache_v1',
  NUTRITIONAL_PROFILE: 'biopeak_nutritional_profile_cache_v1',
  NUTRITION_WEEKLY_PLAN: 'biopeak_nutrition_weekly_plan_cache_v1',
  EVOLUTION_STATS: 'biopeak_evolution_stats_cache_v1',
  AVERAGE_PACE: 'biopeak_average_pace_cache_v1',
  LAST_TRAINING_ANALYSIS: 'biopeak_last_training_analysis_v1',
} as const;

export const CACHE_DURATIONS = {
  SHORT: 2 * 60 * 1000,       // 2 minutes
  MEDIUM: 5 * 60 * 1000,      // 5 minutes
  LONG: 10 * 60 * 1000,       // 10 minutes
  PROFILE: 30 * 60 * 1000,    // 30 minutes
  LAST_TRAINING: 60 * 60 * 1000, // 1 hour
  COACH: 4 * 60 * 60 * 1000,  // 4 hours
  DAILY: 24 * 60 * 60 * 1000, // 24 hours
} as const;

interface CachedData<T> {
  data: T;
  timestamp: number;
  userId: string;
}

/**
 * Get cached data if valid (not expired and same user)
 */
export function getCache<T>(
  key: string,
  userId: string | undefined,
  duration: number
): T | null {
  if (!userId) return null;
  
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    
    const cached: CachedData<T> = JSON.parse(raw);
    
    // Validate user match
    if (cached.userId !== userId) {
      localStorage.removeItem(key);
      return null;
    }
    
    // Validate expiration
    if (Date.now() - cached.timestamp > duration) {
      return null; // Expired but don't remove - will be updated
    }
    
    return cached.data;
  } catch (error) {
    console.warn(`[Cache] Error reading ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Set cached data with timestamp and user ID
 */
export function setCache<T>(
  key: string,
  data: T,
  userId: string
): void {
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.warn(`[Cache] Error writing ${key}:`, error);
  }
}

/**
 * Clear specific cache
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[Cache] Error clearing ${key}:`, error);
  }
}

/**
 * Clear all BioPeak caches
 */
export function clearAllCaches(): void {
  Object.values(CACHE_KEYS).forEach(key => clearCache(key));
}

/**
 * Check if cache is still valid (not expired)
 */
export function isCacheValid(
  key: string,
  userId: string | undefined,
  duration: number
): boolean {
  return getCache(key, userId, duration) !== null;
}
