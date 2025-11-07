import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- Utilities ----------------
const dayToIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function getDateForWeekday(startDate: Date, weekNumber: number, weekdayIdx: number) {
  const base = addDays(startDate, (weekNumber - 1) * 7);
  const baseIdx = base.getUTCDay();
  const diff = weekdayIdx - baseIdx;
  // Ensure we land within the same training week window
  return addDays(base, diff >= 0 ? diff : 7 + diff);
}

function toDayIndex(val: unknown, fallback = 6): number {
  if (typeof val === 'number' && isFinite(val)) {
    const n = Math.round(val);
    return Math.min(6, Math.max(0, n));
  }
  if (typeof val === 'string' && val.trim()) {
    const key = val.trim().toLowerCase();
    if (key in dayToIndex) return dayToIndex[key];
    const num = Number(key);
    if (isFinite(num)) return toDayIndex(num, fallback);
  }
  return fallback;
}

function uniqueSorted(nums: number[]) {
  return Array.from(new Set(nums.filter((n) => n >= 0 && n <= 6))).sort((a, b) => a - b);
}

// ---------------- ATHLETE CAPACITY ANALYZER ----------------
class AthleteCapacityAnalyzer {
  runs: any[];
  bestSegments: any[];
  profile: any;
  
  bestPerformances: {
    pace_5k: number | null;
    pace_10k: number | null;
    pace_21k: number | null;
    pace_42k: number | null;
  };
  
  bestSegmentPace: number | null;
  trainingVolume: {
    avgWeeklyKm: number;
    longestRunLast8W: number;
  };
  
  vo2maxBest: number | null;
  
  constructor(runs: any[], bestSegments: any[], profile: any) {
    this.runs = runs || [];
    this.bestSegments = bestSegments || [];
    this.profile = profile;
    
    this.bestPerformances = {
      pace_5k: null,
      pace_10k: null,
      pace_21k: null,
      pace_42k: null
    };
    
    this.bestSegmentPace = null;
    this.trainingVolume = {
      avgWeeklyKm: 0,
      longestRunLast8W: 0
    };
    
    this.vo2maxBest = null;
    
    this.analyze();
  }
  
  analyze() {
    this.analyzeBestPerformances();
    this.analyzeBestSegments();
    this.analyzeTrainingVolume();
    this.analyzeVO2Max();
  }
  
  analyzeBestPerformances() {
    const validRuns = this.getValidRunData();
    
    // Calculate median pace for reference
    const allPaces = validRuns.map((r: any) => Number(r.pace_min_per_km)).sort((a, b) => a - b);
    const medianPace = allPaces[Math.floor(allPaces.length / 2)] || 6.0;
    
    // Calculate average VO2max if available
    const vo2Values = validRuns
      .map((r: any) => Number(r.vo2_max_daniels))
      .filter((v: number) => v > 0);
    const avgVO2 = vo2Values.length > 0 
      ? vo2Values.reduce((sum, v) => sum + v, 0) / vo2Values.length 
      : null;
    
    const distanceRanges = [
      { key: 'pace_5k', min: 4500, max: 5500 },
      { key: 'pace_10k', min: 9000, max: 11000 },
      { key: 'pace_21k', min: 20000, max: 22000 },
      { key: 'pace_42k', min: 41000, max: 43000 }
    ];
    
    for (const range of distanceRanges) {
      const runsInRange = validRuns.filter((r: any) => {
        const dist = Number(r.total_distance_meters || 0);
        const pace = Number(r.pace_min_per_km);
        const hr = Number(r.average_heart_rate || 0);
        const maxHr = Number(r.max_heart_rate || 0);
        const vo2 = Number(r.vo2_max_daniels || 0);
        
        // Filter 1: Correct distance
        if (dist < range.min || dist > range.max) return false;
        
        // 🚀 WAVE 2.3: Tolerant competitive run filters (HR OR pace, not AND)
        // Check if it's likely a race effort by HR
        const isLikelyRaceByHR = (hr > 0 && maxHr > 0) ? (hr / maxHr >= 0.84) : false;
        
        // Check if it's likely a race effort by pace (with tolerance)
        const paceThreshold = Math.max(medianPace * 0.92, medianPace - 0.25);
        const isLikelyRaceByPace = pace <= paceThreshold;
        
        // Check if it's likely a race effort by VO2max
        const isLikelyRaceByVO2 = avgVO2 && vo2 > 0 ? vo2 >= avgVO2 * 0.95 : false;
        
        // Accept if ANY indicator suggests competitive effort
        if (!(isLikelyRaceByHR || isLikelyRaceByPace || isLikelyRaceByVO2)) return false;
        
        return true;
      });
      
      if (runsInRange.length > 0) {
        const bestPace = Math.min(...runsInRange.map((r: any) => Number(r.pace_min_per_km)));
        this.bestPerformances[range.key as keyof typeof this.bestPerformances] = bestPace;
        console.log(`[AthleteCapacityAnalyzer] Best ${range.key} from ${runsInRange.length} competitive efforts:`, bestPace.toFixed(2));
      }
    }
  }
  
  analyzeBestSegments() {
    if (this.bestSegments.length === 0) return;
    
    // Get reference from best 5K or 10K for validation
    const referencePace = this.bestPerformances.pace_5k || this.bestPerformances.pace_10k || 6.0;
    const maxAcceptablePace = referencePace * 0.8; // 20% faster than best 5K
    
    // 🚀 WAVE 2.4: Z-score outlier detection for best segments
    const validSegments = this.bestSegments
      .map((s: any) => Number(s.best_1km_pace_min_km))
      .filter((p: number) => p > 3 && p < 10);
    
    if (validSegments.length === 0) return;
    
    // Calculate mean and standard deviation
    const mean = validSegments.reduce((sum, p) => sum + p, 0) / validSegments.length;
    const variance = validSegments.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / validSegments.length;
    const sd = Math.sqrt(variance) || 0.001;
    
    // Filter using both reference pace AND z-score (remove outliers > 2.5 SD from mean)
    const topSegments = validSegments
      .filter((p: number) => p >= maxAcceptablePace && p >= mean - 2.5 * sd)
      .sort((a: number, b: number) => a - b)
      .slice(0, 3);
    
    if (topSegments.length > 0) {
      this.bestSegmentPace = topSegments.reduce((sum: number, p: number) => sum + p, 0) / topSegments.length;
      console.log(`[AthleteCapacityAnalyzer] Best segment pace (validated top 3 with z-score): ${this.bestSegmentPace.toFixed(2)} min/km`);
    }
    
    // 🚀 WAVE 2.5: Estimate VO2max from HR data if not available
    if (!this.vo2maxBest && this.validRuns && Array.isArray(this.validRuns)) {
      const runsWithHR = this.validRuns.filter((r: any) => {
        const avgHR = Number(r.average_heart_rate || 0);
        const maxHR = Number(r.max_heart_rate || 0);
        return avgHR > 0 && maxHR > 0;
      });
      
      if (runsWithHR.length > 0) {
        const avgHRs = runsWithHR.map((r: any) => Number(r.average_heart_rate));
        const maxHRs = runsWithHR.map((r: any) => Number(r.max_heart_rate));
        const meanAvgHR = avgHRs.reduce((a, b) => a + b, 0) / avgHRs.length;
        const meanMaxHR = maxHRs.reduce((a, b) => a + b, 0) / maxHRs.length;
        
        this.vo2maxBest = 15.3 * (meanMaxHR / meanAvgHR);
        console.log(`[AthleteCapacityAnalyzer] Estimated VO2max from HR data: ${this.vo2maxBest.toFixed(1)} ml/kg/min (from ${runsWithHR.length} runs)`);
      }
    }
  }
  
  analyzeTrainingVolume() {
    const valid = this.getValidRunData();
    
    if (valid.length === 0) {
      this.trainingVolume = { avgWeeklyKm: 25, longestRunLast8W: 12 };
      return;
    }
    
    const totalKm = valid.reduce((sum: number, r: any) => 
      sum + (Number(r.total_distance_meters || 0) / 1000), 0
    );
    
    // 🚀 WAVE 3.7: Dynamic weeksInData based on actual activity span
    const dates = valid.map((r: any) => new Date(r.activity_date).getTime()).sort((a, b) => a - b);
    const firstActivity = dates[0];
    const lastActivity = dates[dates.length - 1];
    const spanDays = Math.max(7, (lastActivity - firstActivity) / (1000 * 3600 * 24));
    const weeksInData = Math.max(4, Math.round(spanDays / 7));
    
    this.trainingVolume.avgWeeklyKm = Math.max(20, totalKm / weeksInData);
    
    const now = new Date();
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 3600 * 1000);
    const recentRuns = valid.filter((r: any) => new Date(r.activity_date) >= eightWeeksAgo);
    const distances = recentRuns.map((r: any) => Number(r.total_distance_meters || 0) / 1000);
    this.trainingVolume.longestRunLast8W = distances.length > 0 ? Math.max(...distances, 10) : 10;
    
    console.log('[AthleteCapacityAnalyzer] Training volume:', this.trainingVolume);
  }
  
  analyzeVO2Max() {
    const validRuns = this.getValidRunData();
    const vo2maxValues = validRuns
      .map((r: any) => Number(r.vo2_max_daniels))
      .filter((v: number) => v > 0);
    
    if (vo2maxValues.length > 0) {
      this.vo2maxBest = Math.max(...vo2maxValues);
    }
    
    console.log('[AthleteCapacityAnalyzer] Best VO2max:', this.vo2maxBest);
  }
  
  getValidRunData() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
    return this.runs.filter((r: any) => {
      const pace = Number(r.pace_min_per_km);
      const dist = Number(r.total_distance_meters || 0) / 1000;
      const dur = Number(r.total_time_minutes || 0);
      const date = new Date(r.activity_date);
      return (
        Number.isFinite(pace) && pace > 3 && pace < 12 &&
        Number.isFinite(dist) && dist >= 2 &&
        Number.isFinite(dur) && dur >= 10 &&
        date >= cutoffDate
      );
    });
  }
  
  getSafeTargetPaces(goalType?: string) {
    const goal = normalizeGoal(goalType || '');
    
    let currentCapacityPace: number;
    
    if (goal === '5k' && this.bestPerformances.pace_5k) {
      currentCapacityPace = this.bestPerformances.pace_5k;
      console.log('[AthleteCapacityAnalyzer] Using best 5k pace:', currentCapacityPace);
    } else if (goal === '10k' && this.bestPerformances.pace_10k) {
      currentCapacityPace = this.bestPerformances.pace_10k;
      console.log('[AthleteCapacityAnalyzer] Using best 10k pace:', currentCapacityPace);
    } else if (goal === '21k' && this.bestPerformances.pace_21k) {
      currentCapacityPace = this.bestPerformances.pace_21k;
      console.log('[AthleteCapacityAnalyzer] Using best 21k pace:', currentCapacityPace);
    } else if (goal === '42k' && this.bestPerformances.pace_42k) {
      currentCapacityPace = this.bestPerformances.pace_42k;
      console.log('[AthleteCapacityAnalyzer] Using best 42k pace:', currentCapacityPace);
    } else if (this.bestSegmentPace) {
      const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06);
      const segmentTimeMin = this.bestSegmentPace * 1;
      
      if (goal === '5k') {
        currentCapacityPace = riegel(segmentTimeMin, 1, 5) / 5;
      } else if (goal === '10k') {
        currentCapacityPace = riegel(segmentTimeMin, 1, 10) / 10;
      } else if (goal === '21k') {
        currentCapacityPace = riegel(segmentTimeMin, 1, 21.097) / 21.097;
      } else if (goal === '42k') {
        currentCapacityPace = riegel(segmentTimeMin, 1, 42.195) / 42.195;
      } else {
        currentCapacityPace = riegel(segmentTimeMin, 1, 10) / 10;
      }
      
      console.log('[AthleteCapacityAnalyzer] Estimated from best segment:', currentCapacityPace);
    } else {
      currentCapacityPace = this.getDefaultPace(goalType);
      console.log('[AthleteCapacityAnalyzer] Using default pace:', currentCapacityPace);
    }
    
    // 🚀 WAVE 3.5: Calibrate paces with VO2max if available
    if (this.vo2maxBest && currentCapacityPace) {
      const vo2Ref = Math.min(65, Math.max(30, this.vo2maxBest)); // Clamp to realistic range
      const vo2Adjustment = vo2Ref / 50; // 50 = median recreational runner
      currentCapacityPace = currentCapacityPace / vo2Adjustment;
      console.log(`[AthleteCapacityAnalyzer] VO2max adjustment applied: ${this.vo2maxBest} -> pace adjusted by ${vo2Adjustment.toFixed(2)}x`);
    }
    
    return {
      pace_5k: this.bestPerformances.pace_5k || currentCapacityPace * 0.95,
      pace_10k: this.bestPerformances.pace_10k || currentCapacityPace,
      pace_half: this.bestPerformances.pace_21k || currentCapacityPace * 1.08,
      pace_marathon: this.bestPerformances.pace_42k || currentCapacityPace * 1.15,
      
      pace_easy: currentCapacityPace + 1.0,
      pace_long: currentCapacityPace + 0.7,
      pace_tempo: currentCapacityPace + 0.2,
      pace_interval_1km: this.bestSegmentPace || (currentCapacityPace - 0.3),
      pace_interval_800m: (this.bestSegmentPace || currentCapacityPace) - 0.4,
      pace_interval_400m: (this.bestSegmentPace || currentCapacityPace) - 0.6,
      
      pace_best: this.bestSegmentPace || currentCapacityPace - 0.3,
      pace_median: currentCapacityPace,
      pace_p75: currentCapacityPace + 0.5,
    };
  }
  
  getDefaultPace(goalRaw?: string) {
    const age = this.profile?.birth_date
      ? Math.floor((Date.now() - new Date(this.profile.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 35;
    
    const base = goalRaw === 'melhorar_tempos' ? 5.0 :
                 age < 25 ? 5.5 : age < 35 ? 6.0 : age < 45 ? 6.5 : 7.0;
    return base;
  }
  
  getMaxWeeklyKm(): number {
    return Math.min(70, this.trainingVolume.avgWeeklyKm * 1.15);
  }
  
  getMaxLongRunKm(): number {
    return Math.min(32, Math.max(20, this.trainingVolume.longestRunLast8W * 1.2));
  }
}

// ---------------- PLAN GENERATOR ----------------

type GoalType =
  | '5k' | '10k' | '21k' | '42k'
  | 'condicionamento' | 'perda_de_peso' | 'manutencao' | 'retorno' | 'melhorar_tempos';

type Paces = ReturnType<AthleteCapacityAnalyzer['getSafeTargetPaces']> & { 
  target_pace?: number; 
  improvement_percent?: number;
};

// Deriva zonas de treino a partir dos paces declarados pelo atleta
function deriveTrainingZonesFromDeclaredPaces(
  declaredPaces: {
    pace_5k?: number;
    pace_10k?: number;
    pace_half?: number;
    pace_marathon?: number;
  },
  goalType?: string
) {
  // Usa o melhor pace disponível como referência
  const ref5k = declaredPaces.pace_5k ?? 5.0;
  const ref10k = declaredPaces.pace_10k ?? ref5k * 1.08;
  const refHalf = declaredPaces.pace_half ?? ref10k * 1.12;
  const refMarathon = declaredPaces.pace_marathon ?? refHalf * 1.1;

  // Determinar pace de referência baseado na meta
  const goal = normalizeGoal(goalType || '');
  let baseReferencePace: number;
  
  switch (goal) {
    case '5k':
      baseReferencePace = ref5k;
      break;
    case '10k':
      baseReferencePace = ref10k;
      break;
    case '21k':
      baseReferencePace = refHalf;
      break;
    case '42k':
      baseReferencePace = refMarathon;
      break;
    default:
      // Para metas fitness, usar pace de 10k como referência moderada
      baseReferencePace = ref10k;
  }

  return {
    pace_5k: ref5k,
    pace_10k: ref10k,
    pace_half: refHalf,
    pace_marathon: refMarathon,
    
    // Zonas de treino derivadas da meta específica
    pace_easy: baseReferencePace + 1.0,         // Z2 - confortável, ~1 min/km mais lento
    pace_long: baseReferencePace + 0.8,         // Long run - aeróbico sustentado
    pace_tempo: baseReferencePace + 0.3,        // Z3/Limiar - esforço controlado
    pace_interval_1km: baseReferencePace - 0.2, // Z4 - próximo ao ritmo-alvo
    pace_interval_800m: baseReferencePace - 0.3,// Z4-Z5 - mais rápido
    pace_interval_400m: baseReferencePace - 0.5,// Z5 - significativamente mais rápido
    
    pace_best: ref5k,
    pace_median: ref10k,
    pace_p75: refHalf,
  };
}

// Normalize goal to internal canonical set
function normalizeGoal(goalRaw: string): GoalType {
  const g = (goalRaw || '').toLowerCase().trim();
  const map: Record<string, GoalType> = {
    // English -> Portuguese/internal
    'weight_loss': 'perda_de_peso',
    'general_fitness': 'condicionamento',
    'return_to_run': 'retorno',
    'maintenance': 'manutencao',
    'improve_times': 'melhorar_tempos',
    'half_marathon': '21k',
    'marathon': '42k',
    '5km': '5k',
    '10km': '10k',
    // already canonical values map to themselves
    'perda_de_peso': 'perda_de_peso',
    'condicionamento': 'condicionamento',
    'retorno': 'retorno',
    'manutencao': 'manutencao',
    'melhorar_tempos': 'melhorar_tempos',
    '21k': '21k',
    '42k': '42k',
    '5k': '5k',
    '10k': '10k',
  };
  return (map[g] ?? (g as GoalType)) as GoalType;
}

/**
 * Calculate optimal plan duration based on improvement needed
 * Rule: 2% improvement per week is realistic
 */
function calculateOptimalWeeks(
  goal: GoalType,
  improvementPercent: number,
  requestedWeeks?: number
): number {
  if (requestedWeeks && requestedWeeks > 0) {
    return requestedWeeks; // User preference takes priority
  }
  
  // Base weeks by goal
  const minWeeks = {
    '5k': 8,
    '10k': 8,
    '21k': 12,
    '42k': 16,
    'condicionamento': 8,
    'perda_de_peso': 8,
    'manutencao': 8,
    'retorno': 8,
    'melhorar_tempos': 8
  };
  
  const maxWeeks = {
    '5k': 12,
    '10k': 12,
    '21k': 16,
    '42k': 20,
    'condicionamento': 12,
    'perda_de_peso': 12,
    'manutencao': 12,
    'retorno': 12,
    'melhorar_tempos': 12
  };
  
  // Calculate weeks needed for improvement (2% per week rule)
  const weeksNeeded = Math.ceil(improvementPercent / 2);
  
  // Constrain to min/max
  const min = minWeeks[goal] || 8;
  const max = maxWeeks[goal] || 12;
  
  const optimalWeeks = Math.max(min, Math.min(max, weeksNeeded));
  
  console.log(`[calculateOptimalWeeks] Goal: ${goal}, Improvement: ${improvementPercent.toFixed(1)}%, Optimal: ${optimalWeeks} weeks`);
  
  return optimalWeeks;
}

/**
 * Calculate progression factor using sigmoidal curve
 * This reflects realistic physiological adaptation
 */
function calculateProgressionFactor(week: number, totalWeeks: number, phase: string): number {
  // Sigmoidal curve: slow start, rapid middle, stabilize at end
  const midpoint = totalWeeks / 2;
  const steepness = 0.4;
  
  // Base sigmoidal factor
  const sigmoidFactor = 1 / (1 + Math.exp(-steepness * (week - midpoint)));
  
  // Phase adjustments
  const phaseMultipliers = {
    'base': 0.3,      // Very conservative in base phase
    'build': 1.0,     // Full progression in build phase
    'peak': 1.2,      // Aggressive in peak phase
    'taper': 0.95     // Maintain in taper
  };
  
  const multiplier = phaseMultipliers[phase as keyof typeof phaseMultipliers] || 1.0;
  
  return Math.min(1.0, sigmoidFactor * multiplier);
}

function getPhase(week: number, totalWeeks: number): 'base' | 'build' | 'peak' | 'taper' {
  // Base: 50%, Build: 30%, Peak: 15%, Taper: 5%
  if (week <= Math.max(1, Math.floor(totalWeeks * 0.5))) return 'base';
  if (week <= Math.max(2, Math.floor(totalWeeks * 0.8))) return 'build';
  if (week < Math.max(totalWeeks - 1, Math.floor(totalWeeks * 0.95))) return 'peak';
  return 'taper';
}

function defaultDaysFromPrefs(prefs: any, longDayIdx: number): number[] {
  const daysPerWeek: number = Math.min(7, Math.max(2, prefs?.days_per_week ?? 4));
  const rawDays = Array.isArray(prefs?.days_of_week) ? prefs.days_of_week : null;
  let indices: number[] = [];
  if (rawDays) {
    indices = rawDays.map((d: any) => toDayIndex(d));
  } else {
    // sensible defaults: Tue(2), Thu(4), Sat(6), Sun(0)
    indices = [2, 4, 6, 0];
  }
  // Ensure long run day is included
  if (!indices.includes(longDayIdx)) indices.push(longDayIdx);
  indices = uniqueSorted(indices).slice(0, daysPerWeek);
  // Always keep long run if we trimmed
  if (!indices.includes(longDayIdx)) {
    indices.pop();
    indices.push(longDayIdx);
    indices = uniqueSorted(indices);
  }
  return indices;
}

function generatePlan(
  goalRaw: string, 
  requestedWeeks: number, 
  targetPaces: Paces, 
  prefs: any, 
  calibrator: AthleteCapacityAnalyzer
) {
  const goal = normalizeGoal(goalRaw);
  
  // 🚀 Calculate optimal weeks based on improvement needed
  const improvementPercent = (targetPaces as any).improvement_percent || 0;
  const weeks = calculateOptimalWeeks(goal, improvementPercent, requestedWeeks);
  
  if (weeks !== requestedWeeks) {
    console.log(`[generatePlan] Adjusted duration from ${requestedWeeks} to ${weeks} weeks for ${improvementPercent.toFixed(1)}% improvement`);
  }
  
  const longDayIdx = toDayIndex(prefs?.long_run_weekday, 6);
  const dayIndices = defaultDaysFromPrefs(prefs, longDayIdx);

  const workouts: any[] = [];
  const loadCyclePattern = [1.0, 1.05, 1.1, 0.75]; // 4:1 cycle
  let longRunCount30Plus = 0;
  let lastLongRun30PlusWeek = 0;
  let previousPhase: string | null = null;

  for (let w = 1; w <= weeks; w++) {
    const phase = getPhase(w, weeks);
    console.log(`[v4.3 DEBUG] Week ${w}: phase=${phase}, totalWeeks=${weeks}`);
    const cycleIndex = (w - 1) % 4;
    const isCutbackWeek = cycleIndex === 3 && phase !== 'taper';
    
    // 🚀 WAVE 3.6: Log phase transitions
    if (w > 1 && phase !== previousPhase) {
      console.info(`📍 [generate-training-plan] Phase transition: ${previousPhase} → ${phase} at week ${w}`);
    }
    previousPhase = phase;
    
    // Apply load cycle multiplier
    let volumeMultiplier = loadCyclePattern[cycleIndex];
    
    // Taper: reduce volume progressively
    if (phase === 'taper') {
      const weeksFromEnd = weeks - w + 1;
      volumeMultiplier = weeksFromEnd === 1 ? 0.5 : 0.7;
    }

    // Track weekly quality sessions (max 2 per week)
    let weeklyQualityCount = 0;
    
    // 🚀 WAVE 1.2: Track weekly distance to apply cap
    let weeklyDistanceKm = 0;
    const maxWeeklyKm = calibrator.getMaxWeeklyKm();

    for (const dow of dayIndices) {
      const weekday = Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || 'saturday';
      const isLong = dow === longDayIdx;
      
      const session = isLong
        ? generateLongRun(
            goal, w, phase, volumeMultiplier, targetPaces, calibrator,
            { count30Plus: longRunCount30Plus, lastWeek30Plus: lastLongRun30PlusWeek }
          )
        : generateSession(goal, w, dow, phase, volumeMultiplier, targetPaces, isCutbackWeek, dayIndices.length, weeklyQualityCount, calibrator, weeks);

      // Calculate estimated distance for this session
      const sessionKm = session.distance_km ?? (session.duration_min ? session.duration_min / (targetPaces.pace_median || 6.0) : 0);
      
      // 🚀 WAVE 1.2: Apply weekly volume cap (preserve long runs and quality workouts)
      if (weeklyDistanceKm + sessionKm > maxWeeklyKm) {
        const remaining = Math.max(0, maxWeeklyKm - weeklyDistanceKm);
        
        // Only reduce easy runs to stay within cap
        if (session.type === 'easy' && session.distance_km && remaining < sessionKm) {
          const reducedDistance = Math.max(3, Math.floor(remaining));
          console.log(`[generatePlan] Week ${w}: Reducing easy run from ${session.distance_km}km to ${reducedDistance}km (weekly cap: ${maxWeeklyKm}km)`);
          session.distance_km = reducedDistance;
        }
      }
      
      weeklyDistanceKm += (session.distance_km || sessionKm);

      // Track 30+ km long runs
      if (isLong && session.distance_km && session.distance_km >= 30) {
        longRunCount30Plus++;
        lastLongRun30PlusWeek = w;
      }

      // Count quality sessions this week
      if (session.intensity === 'high' || (session.intensity === 'moderate' && session.type !== 'easy')) {
        weeklyQualityCount++;
      }

      workouts.push({ 
        ...session, 
        week: w, 
        weekday,
        is_cutback_week: isCutbackWeek,
        week_load_factor: volumeMultiplier 
      });
    }
  }

  return workouts;
}

function generateLongRun(
  goal: GoalType, 
  week: number, 
  phase: string, 
  vol: number, 
  p: Paces,
  calibrator: AthleteCapacityAnalyzer,
  longRunTracker: { count30Plus: number; lastWeek30Plus: number }
) {
  const maxLongRun = calibrator.getMaxLongRunKm();
  
  // Start at 14-16km and progress gradually
  let dist = 0;
  switch (goal) {
    case '5k': 
      dist = Math.min(12, 8 + week * 0.3); 
      break;
    case '10k': 
      // 🚀 v4.1: Increased long run progression to 15km
      if (phase === 'build') {
        const baseWeeks = 5; // Assuming base phase is ~5 weeks
        const buildWeek = Math.max(0, week - baseWeeks);
        dist = Math.min(15, 12 + buildWeek * 1.5); // 12→13.5→15km progression
      } else {
        dist = Math.min(15, 10 + week * 0.5); // Slightly more aggressive base progression
      }
      break;
    case '21k': 
      dist = Math.min(Math.min(22, maxLongRun), 14 + week * 0.8); 
      break;
    case '42k': 
      // Progress from 14-16km to max 32km
      dist = Math.min(maxLongRun, 14 + week * 1.2); 
      // Limit to 3 runs ≥30km, with 2-week spacing
      if (dist >= 30) {
        if (longRunTracker.count30Plus >= 3 || (week - longRunTracker.lastWeek30Plus < 2)) {
          dist = Math.min(28, dist);
        }
      }
      break;
    case 'condicionamento': 
      dist = Math.min(14, 10 + week * 0.3); 
      break;
    case 'perda_de_peso': 
      dist = Math.min(12, 8 + week * 0.3); 
      break;
    case 'manutencao': 
      dist = Math.min(16, 10 + week * 0.3); 
      break;
    case 'retorno': 
      dist = Math.min(12, 6 + week * 0.5); 
      break;
    case 'melhorar_tempos': 
      dist = Math.min(18, 12 + week * 0.6); 
      break;
  }

  // Apply volume multiplier
  dist = Math.round(dist * vol);
  
  // Taper: cap long runs at 20km
  if (phase === 'taper') {
    dist = Math.min(16, dist);
  }

  // Vary long run type
  const hasBlocks = (phase === 'build' || phase === 'peak') && week % 2 === 0 && goal === '42k';
  const baseDesc = hasBlocks
    ? `${dist}km com blocos em ritmo maratona (MP) nos últimos 8-12km`
    : `${dist}km contínuos em Z2`;

  const pace = (goal === '42k' || goal === '21k') ? p.pace_long : p.pace_long + 0.2;
  
  // 🚀 WAVE 1.1: Add deterministic variability to long runs
  const deterministicSeed = (week * 7 + 6) % 100 / 100; // dow=6 for long run day
  const variation = (deterministicSeed - 0.5) * 0.4; // ±0.2 min/km
  const finalPace = Math.max(3.2, Math.min(12.0, pace + variation));
  
  console.log(`[generateLongRun] Week ${week}: Applied variation ${variation.toFixed(2)} → ${finalPace.toFixed(2)} min/km`);

  return {
    type: 'long_run',
    title: `Longão ${dist}km`,
    description: baseDesc,
    distance_km: dist,
    duration_min: null,
    target_hr_zone: 2,
    target_pace_min_per_km: Number(finalPace.toFixed(2)),
    intensity: 'moderate',
  };
}

function generateSession(
  goal: GoalType, 
  week: number,
  dow: number,
  phase: string, 
  vol: number, 
  p: Paces,
  isCutbackWeek: boolean,
  totalSessions: number,
  weeklyQualityCount: number,
  calibrator: AthleteCapacityAnalyzer,
  totalWeeks: number
) {
  // 🚀 Calculate progression using sigmoidal curve
  const progressionFactor = calculateProgressionFactor(week, totalWeeks, phase);
  
  // 🚀 Aplicar progressão aos paces
  let paces = { ...p };
  
  if ((p as any).target_pace && (p as any).improvement_percent) {
    // Existe uma meta definida - progredir do pace atual até o pace alvo
    const currentPace = p.pace_median;
    const targetPace = (p as any).target_pace;
    const paceImprovement = currentPace - targetPace;
    
    // Progressão linear: semana 1 = 0%, semana final = 100%
    const progressedBasePace = currentPace - (paceImprovement * progressionFactor);
    
    paces = {
      ...p,
      pace_easy: progressedBasePace + 1.0,
      pace_long: progressedBasePace + 0.7,
      pace_tempo: progressedBasePace + 0.2,
      pace_interval_1km: (p as any).pace_best || (progressedBasePace - 0.3),
      pace_interval_800m: (p as any).pace_best ? ((p as any).pace_best - 0.1) : (progressedBasePace - 0.4),
      pace_interval_400m: (p as any).pace_best ? ((p as any).pace_best - 0.2) : (progressedBasePace - 0.6),
    };
    
    console.log(`[generateSession] Week ${week}/${totalWeeks} - Progression ${(progressionFactor*100).toFixed(0)}%`, {
      currentBasePace: currentPace.toFixed(2),
      progressedBasePace: progressedBasePace.toFixed(2),
      targetPace: targetPace.toFixed(2),
      easy: paces.pace_easy.toFixed(2),
      tempo: paces.pace_tempo.toFixed(2),
      interval: paces.pace_interval_1km.toFixed(2)
    });
  }
  
  // Defaults: easy session
  let type = 'easy';
  let title = 'Corrida leve';
  let description = 'Corrida confortável em Z2';
  // Controle de volume: limite de 12km para easy runs, progressão gradual
  let distance_km = Math.min(12, Math.round((5 + week * 0.4) * vol));
  let duration_min: number | null = null;
  let pace = p.pace_easy;
  let zone = 2;
  let intensity = 'low';

  // During cutback weeks, keep it simple - all easy
  if (isCutbackWeek) {
    distance_km = Math.round(distance_km * 0.8);
    return {
      type,
      title,
      description,
      distance_km,
      duration_min: null,
      target_hr_zone: zone,
      target_pace_min_per_km: Number(pace.toFixed(2)),
      intensity,
    };
  }

  // Distribuição de qualidade baseada em dias fixos (terça=2, quinta=4)
  // Max 2 treinos intensos por semana
  const isQualityDay = (dow === 2 || dow === 4) && weeklyQualityCount < 2;
  const shouldAddQuality = phase !== 'base' && phase !== 'taper' && isQualityDay;

  if (shouldAddQuality) {
    // Rotate through different quality sessions
    const qualityType = week % 5;
    
    if (goal === '42k' || goal === '21k') {
      switch (qualityType) {
        case 0: // Tempo
          type = 'tempo';
          title = goal === '42k' ? 'Tempo 30min' : 'Tempo 25min';
          description = `Aquecimento + ${goal === '42k' ? '30' : '25'}min em ritmo limiar`;
          duration_min = goal === '42k' ? 30 : 25;
          distance_km = null as any;
          pace = p.pace_tempo;
          zone = 3;
          intensity = 'moderate';
          break;
        case 1: // Marathon Pace blocks
          if (goal === '42k') {
            type = 'mp_block';
            title = 'Blocos MP';
            description = 'Aquecimento + 3x4km em ritmo maratona, rec 2min';
            duration_min = 55;
            distance_km = null as any;
            pace = p.pace_marathon;
            zone = 3;
            intensity = 'moderate';
          } else {
            type = 'progressivo';
            title = 'Progressivo 35min';
            description = 'Inicie Z2 leve, termine próximo ao ritmo de meia';
            duration_min = 35;
            distance_km = null as any;
            pace = (p.pace_easy + p.pace_half) / 2;
            zone = 3;
            intensity = 'moderate';
          }
          break;
        case 2: // Intervals
          type = 'interval';
          title = '5x1km';
          description = 'Aquecimento + 5x1km ritmo 10k, rec 2min';
          duration_min = 40;
          distance_km = null as any;
          pace = p.pace_interval_1km;
          zone = 4;
          intensity = 'high';
          break;
        case 3: // Progressivo
          type = 'progressivo';
          title = 'Progressivo 40min';
          description = 'Inicie Z2 leve, termine em ritmo de prova';
          duration_min = 40;
          distance_km = null as any;
          pace = (p.pace_easy + p.pace_marathon) / 2;
          zone = 3;
          intensity = 'moderate';
          break;
        case 4: // Fartlek
          type = 'fartlek';
          title = 'Fartlek 35min';
          description = 'Aquecimento + 10x(2min moderado/1min leve)';
          duration_min = 35;
          distance_km = null as any;
          pace = (p.pace_easy + p.pace_tempo) / 2;
          zone = 3;
          intensity = 'moderate';
          break;
      }
    } else if (goal === '5k') {
      // Rotação de treinos de qualidade para 5k (mais frequente)
      const mod = week % 3;
      
      if (mod === 0) {
        // Intervals 400m - Velocidade pura
        type = 'interval';
        title = '8x400m';
        description = 'Aquecimento + 8x400m ritmo 5k, 90s rec';
        duration_min = 30;
        distance_km = null as any;
        pace = paces.pace_interval_400m;
        zone = 5;
        intensity = 'high';
      } else if (mod === 1) {
        // Tempo - Limiar
        type = 'tempo';
        title = 'Tempo 20min';
        description = 'Aquecimento + 20min em ritmo de limiar';
        duration_min = 20;
        distance_km = null as any;
        pace = paces.pace_tempo;
        zone = 4;
        intensity = 'high';
      } else {
        // Intervals 1km - Resistência anaeróbica
        type = 'interval';
        title = '5x1km';
        description = 'Aquecimento + 5x1km ritmo 5k, 2min rec';
        duration_min = 35;
        distance_km = null as any;
        pace = paces.pace_interval_1km;
        zone = 4;
        intensity = 'high';
      }
    } else if (goal === '10k') {
      // 🚀 v4.3: Track if workout was explicitly forced (prevents overwriting)
      let forcedWorkout = false;
      
      // 🚀 v4.3 PRIORITY 1: Race pace simulation FIRST (week 10, totalWeeks - 2)
      if (week === totalWeeks - 2 && dow === 2) {
        type = 'race_pace';
        title = 'Simulado 6K @RP';
        const targetPace = (paces as any).target_pace || paces.pace_10k;
        description = `Aquecimento + 6km no pace de prova (${targetPace.toFixed(2)} min/km) + desaquecimento`;
        duration_min = null as any;
        distance_km = 6;
        pace = targetPace;
        zone = 4;
        intensity = 'high';
        forcedWorkout = true;
        console.log(`[v4.3] Race pace simulation at week ${week}`);
      }
      // 🚀 v4.3 PRIORITY 2: Force tempo runs from week 6 onwards (Tuesdays, not taper)
      else if (week >= 6 && week < totalWeeks - 2 && phase !== 'taper' && dow === 2 && week % 4 !== 0) {
        type = 'tempo';
        title = 'Tempo 30min';
        description = 'Aquecimento + 30min em ritmo de limiar/10k';
        duration_min = 30;
        distance_km = null as any;
        pace = paces.pace_tempo;
        zone = 3;
        intensity = 'moderate';
        forcedWorkout = true;
        console.log(`[v4.3] Forced tempo run at week ${week}, dow ${dow}`);
      }
      // 🚀 v4.3 PRIORITY 3: Fartlek in base phase (weeks 3-4, Tuesdays)
      else if (phase === 'base' && week >= 3 && week <= 4 && dow === 2) {
        type = 'fartlek';
        title = 'Fartlek 30min leve';
        description = 'Aquecimento 10min + 8x(1min moderado/1min leve) + desaquecimento 10min';
        duration_min = 30;
        distance_km = null as any;
        pace = paces.pace_easy - 0.3;
        zone = 2;
        intensity = 'moderate';
        forcedWorkout = true;
        console.log(`[v4.3] Fartlek inserted at week ${week}, dow ${dow}`);
      }
      // 🚀 v4.3 PRIORITY 4: Steady runs (weeks 7-9, THURSDAYS) - HIGH PRIORITY, BEFORE QUALITY ROTATION
      else if ([7, 8, 9].includes(week) && dow === 4 && week % 4 !== 0) {
        type = 'steady';
        title = 'Corrida moderada 6K';
        description = 'Ritmo controlado Z2.5-Z3, ponte entre easy e tempo';
        duration_min = null as any;
        distance_km = 6;
        pace = (paces.pace_easy + paces.pace_tempo) / 2;
        zone = 2.5;
        intensity = 'moderate';
        forcedWorkout = true;
        console.log(`[v4.3] ✅ Forced steady run at week ${week}, dow ${dow} (Thursday)`);
      }
      
      // Validation logs for steady runs
      if ([7, 8, 9].includes(week) && dow === 4) {
        console.log(`[v4.3 STEADY CHECK] Week ${week}, dow ${dow}: cutback=${week % 4 === 0}, phase=${phase}, forcedWorkout=${forcedWorkout}`);
      }
      
      // Regular quality rotation ONLY if not forced
      if (!forcedWorkout) {
        // Regular quality rotation for 10k (Thursdays or other quality slots)
        const mod = week % 3;
        
        if (mod === 0) {
          // Tempo Run - Ritmo de prova
          type = 'tempo';
          title = 'Tempo 30min';
          description = 'Aquecimento + 30min em ritmo de limiar/10k';
          duration_min = 30;
          distance_km = null as any;
          pace = paces.pace_tempo;
          zone = 3;
          intensity = 'moderate';
        } else if (mod === 1) {
          // Intervals 1km - Velocidade
          type = 'interval';
          title = '6x1km';
          description = 'Aquecimento + 6x1km ritmo 5-10k, 2min rec';
          duration_min = 40;
          distance_km = null as any;
          pace = paces.pace_interval_1km;
          zone = 4;
          intensity = 'high';
        } else {
          // Fartlek - Variação de ritmo
          type = 'fartlek';
          title = 'Fartlek 35min';
          description = 'Aquecimento + 10x(2min forte/1min leve)';
          duration_min = 35;
          distance_km = null as any;
          pace = (paces.pace_easy + paces.pace_tempo) / 2;
          zone = 3;
          intensity = 'moderate';
        }
      }
    } else if (goal === 'condicionamento') {
      if (week % 3 === 0) {
        type = 'fartlek';
        title = 'Fartlek 30min';
        description = 'Aquecimento + variações 1-2min moderado/leve';
        duration_min = 30;
        distance_km = null as any;
        pace = p.pace_tempo;
        zone = 3;
        intensity = 'moderate';
      }
    } else if (goal === 'perda_de_peso') {
      if (week % 2 === 1) {
        type = 'moderate';
        title = 'Z2-Z3 contínuo';
        description = '35-40min em Z2 com breves progressões';
        duration_min = 38;
        distance_km = null as any;
        pace = (p.pace_easy + p.pace_tempo) / 2;
        zone = 2;
        intensity = 'moderate';
      }
    } else if (goal === 'manutencao') {
      if (week % 3 === 2) {
        type = 'progressivo';
        title = 'Progressivo 30min';
        description = 'Comece em Z2 e termine próximo ao limiar';
        duration_min = 30;
        distance_km = null as any;
        pace = (p.pace_easy + p.pace_tempo) / 2;
        zone = 3;
        intensity = 'moderate';
      }
    } else if (goal === 'retorno') {
      distance_km = Math.max(3, Math.round((3 + week * 0.4) * vol));
      pace = p.pace_easy + 0.3;
      zone = 2;
      intensity = 'low';
    } else if (goal === 'melhorar_tempos') {
      // Rotação de treinos de qualidade para melhorar tempos (ciclo de 4 semanas)
      // Semana % 4: 1=Tempo, 2=Intervalado, 3=Progressivo, 0=Fartlek
      const mod = week % 4;
      
      // Dia da semana define o tipo de estímulo (terça=moderado, quinta=intenso)
      const isIntenseDay = dow === 4; // quinta-feira
      
      switch (mod) {
        case 1: // Tempo Run - ritmo limiar
          type = 'tempo';
          title = isIntenseDay && phase === 'peak' ? 'Tempo 20min forte' : 'Tempo 25min';
          description = isIntenseDay && phase === 'peak' 
            ? 'Aquecimento + 20min próximo ao ritmo 10k (Z4)'
            : 'Aquecimento + 25min em ritmo limiar (Z3)';
          duration_min = isIntenseDay && phase === 'peak' ? 20 : 25;
          distance_km = null as any;
          pace = isIntenseDay && phase === 'peak' ? p.pace_10k - 0.1 : p.pace_tempo;
          zone = isIntenseDay && phase === 'peak' ? 4 : 3;
          intensity = isIntenseDay && phase === 'peak' ? 'high' : 'moderate';
          break;
          
        case 2: // Intervalado - treino de velocidade
          type = 'interval';
          title = '6x800m';
          description = 'Aquecimento + 6x800m ritmo 5-10k, rec 2min';
          duration_min = 35;
          distance_km = null as any;
          pace = p.pace_interval_800m;
          zone = 4;
          intensity = 'high';
          break;
          
        case 3: // Progressivo - aumenta gradualmente
          type = 'progressivo';
          title = isIntenseDay && phase === 'peak' ? 'Progressivo 35min forte' : 'Progressivo 40min';
          description = isIntenseDay && phase === 'peak'
            ? 'Inicie leve e termine em ritmo 10k (Z4)'
            : 'Inicie leve e termine próximo ao ritmo 10k';
          duration_min = isIntenseDay && phase === 'peak' ? 35 : 40;
          distance_km = null as any;
          pace = (p.pace_easy + p.pace_10k) / 2;
          zone = isIntenseDay && phase === 'peak' ? 4 : 3;
          intensity = isIntenseDay && phase === 'peak' ? 'high' : 'moderate';
          break;
          
        default: // case 0: Fartlek - variações de ritmo
          type = 'fartlek';
          title = 'Fartlek 35min';
          description = '10x(2min moderado/1min leve)';
          duration_min = 35;
          distance_km = null as any;
          pace = (p.pace_easy + p.pace_tempo) / 2;
          zone = 3;
          intensity = 'moderate';
          break;
      }
      
      // Aplicar progressão de intensidade real para o objetivo "melhorar_tempos"
      // Intensificar ritmos conforme a fase
      if (phase === 'build') {
        pace *= 0.97; // 3% mais rápido na fase de construção
      } else if (phase === 'peak') {
        pace *= 0.94; // 6% mais rápido na fase de pico
        zone = mod === 2 ? 5 : zone; // Intervalados viram Z5 no pico
        intensity = 'high';
      } else if (phase === 'taper') {
        // Na fase taper, reduzir volume mantendo intensidade
        if (duration_min) {
          duration_min = Math.round(duration_min * 0.7);
        }
      }
    }
  }

  // Taper phase: keep only short maintenance sessions
  if (phase === 'taper' && shouldAddQuality) {
    type = 'tempo';
    title = 'Manutenção MP';
    description = 'Aquecimento + 2x10min em ritmo de prova, rec 3min';
    duration_min = 30;
    distance_km = null as any;
    pace = goal === '42k' ? p.pace_marathon : p.pace_half;
    zone = 3;
    intensity = 'moderate';
  }

  // 🚀 WAVE 3.7: Apply pace safety clamp
  pace = Math.max(3.2, Math.min(12.0, pace));
  
  // 🚀 WAVE 1.1: Add deterministic variability to easy/long runs
  let finalPace = pace;
  if (type === 'easy' || type === 'long_run') {
    // Deterministic seed based on week and day of week
    const deterministicSeed = (week * 7 + dow) % 100 / 100;
    const variation = (deterministicSeed - 0.5) * 0.4; // ±0.2 min/km
    finalPace = pace + variation;
    finalPace = Math.max(3.2, Math.min(12.0, finalPace)); // Re-apply clamp after variation
    
    console.log(`[generateSession] Week ${week}, ${type}: Applied variation ${variation.toFixed(2)} → ${finalPace.toFixed(2)} min/km`);
  }

  return {
    type,
    title,
    description,
    distance_km: type === 'easy' ? distance_km : (distance_km ?? null),
    duration_min: duration_min ?? null,
    target_hr_zone: zone,
    target_pace_min_per_km: Number(finalPace.toFixed(2)),
    intensity,
  };
}

function buildPlanSummary(goal: string, weeks: number, p: Paces, workouts: any[], userDefinedTimeMinutes?: number, athleteAnalyzer?: AthleteCapacityAnalyzer) {
  const phases: Array<'base' | 'build' | 'peak' | 'taper'> = [];
  for (let w = 1; w <= weeks; w++) phases.push(getPhase(w, weeks));

  // Calculate plan statistics
  const totalKm = workouts.reduce((sum, w) => sum + (w.distance_km || 0), 0);
  const longestRun = Math.max(...workouts.map(w => w.distance_km || 0));
  const avgWeeklyKm = totalKm / weeks;
  
  // Count workout types
  const workoutTypes = workouts.reduce((acc: any, w: any) => {
    const type = w.type || 'easy';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Phase distribution
  const phaseDistribution = phases.reduce((acc: any, phase) => {
    acc[phase] = (acc[phase] || 0) + 1;
    return acc;
  }, {});

  // Estatísticas de intensidade por zona (controle de polarização)
  const zoneDistribution = workouts.reduce((acc: any, w: any) => {
    const zone = `Z${w.target_hr_zone || 2}`;
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {});

  // Contagem de sessões por intensidade
  const intensityDistribution = workouts.reduce((acc: any, w: any) => {
    const intensity = w.intensity || 'low';
    acc[intensity] = (acc[intensity] || 0) + 1;
    return acc;
  }, {});

  // Cálculo de proporção de polarização (ideal: ~80% Z2, ~20% Z3-Z5)
  const totalSessions = workouts.length;
  const z2Count = zoneDistribution.Z2 || 0;
  const z3PlusCount = (zoneDistribution.Z3 || 0) + (zoneDistribution.Z4 || 0) + (zoneDistribution.Z5 || 0);
  const polarizationRatio = totalSessions > 0 
    ? { 
        easy_pct: Math.round((z2Count / totalSessions) * 100),
        quality_pct: Math.round((z3PlusCount / totalSessions) * 100)
      }
    : null;

  // Targets: use user-defined time if available, otherwise calculate from paces
  let target_pace_min_km: number | null = null;
  let target_time_minutes: number | null = null;
  const g = normalizeGoal(goal || '');
  
  if (userDefinedTimeMinutes && typeof userDefinedTimeMinutes === 'number') {
    // Priorizar meta definida pelo usuário
    target_time_minutes = userDefinedTimeMinutes;
    
    if (g === '5k') target_pace_min_km = userDefinedTimeMinutes / 5;
    else if (g === '10k') target_pace_min_km = userDefinedTimeMinutes / 10;
    else if (g === '21k') target_pace_min_km = userDefinedTimeMinutes / 21.097;
    else if (g === '42k') target_pace_min_km = userDefinedTimeMinutes / 42.195;
    else target_pace_min_km = p.pace_median;
    
  } else {
    // Fallback: calcular do histórico
    if (g === '5k') {
      target_pace_min_km = p.pace_5k;
      target_time_minutes = 5 * p.pace_5k;
    } else if (g === '10k') {
      target_pace_min_km = p.pace_10k;
      target_time_minutes = 10 * p.pace_10k;
    } else if (g === '21k') {
      target_pace_min_km = p.pace_half;
      target_time_minutes = 21.097 * p.pace_half;
    } else if (g === '42k') {
      target_pace_min_km = p.pace_marathon;
      target_time_minutes = 42.195 * p.pace_marathon;
    } else {
      target_pace_min_km = p.pace_median;
      target_time_minutes = null;
    }
  }

  // 🚀 WAVE 3.8: Save plan seed metadata for auditability
  const planSeed = {
    vo2max_best: athleteAnalyzer?.vo2maxBest || null,
    best_segment_pace: athleteAnalyzer?.bestSegmentPace || null,
    avg_weekly_km: athleteAnalyzer?.trainingVolume.avgWeeklyKm || null,
    longest_run_last_8w: athleteAnalyzer?.trainingVolume.longestRunLast8W || null,
    improvement_percent: (p as any).improvement_percent || null,
    adjusted_weeks: weeks,
    generated_at: new Date().toISOString()
  };

  return {
    periodization: phases,
    notes: 'Plano fisiologicamente otimizado com periodização 4:1, distribuição de intensidade baseada em dias fixos (terça/quinta), controle de carga progressivo e polarização de treino.',
    statistics: {
      total_km: Math.round(totalKm),
      longest_run_km: longestRun,
      avg_weekly_km: Math.round(avgWeeklyKm * 10) / 10,
      workout_types: workoutTypes,
      phase_distribution: phaseDistribution,
      zone_distribution: zoneDistribution,
      intensity_distribution: intensityDistribution,
      polarization_ratio: polarizationRatio,
    },
    targets: {
      target_pace_min_km: Number((target_pace_min_km ?? p.pace_median).toFixed(2)),
      target_time_minutes: target_time_minutes ? Math.round(target_time_minutes) : null,
    },
    seed: planSeed,
  };
}

// ---------------- EDGE FUNCTION ENTRYPOINT ----------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: userResult } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    const user = userResult?.user;
    if (!user) throw new Error('Invalid auth token');

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body.plan_id;
    if (!planId) throw new Error('plan_id is required');

    console.info('[generate-training-plan] start deterministic', { planId, userId: user.id });

    const { data: plan, error: planErr } = await supabase
      .from('training_plans')
      .select('id, user_id, plan_name, goal_type, start_date, end_date, weeks, target_event_date, status, goal_target_time_minutes')
      .eq('id', planId)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) throw new Error('Plan not found');

    // Check if user already has another active plan (excluding current one)
    const { data: existingActivePlans } = await supabase
      .from('training_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .neq('id', planId);

    if (existingActivePlans && existingActivePlans.length > 0) {
      console.error('[generate-training-plan] User already has active plan:', existingActivePlans[0].id);
      
      // Cancel the new plan that was just created
      await supabase
        .from('training_plans')
        .update({ status: 'cancelled' })
        .eq('id', planId);
      
      throw new Error('USER_HAS_ACTIVE_PLAN: Você já possui um plano de treino ativo. Cancele o plano atual antes de criar um novo.');
    }

    const { data: prefs } = await supabase
      .from('training_plan_preferences')
      .select('days_per_week, days_of_week, long_run_weekday, start_date')
      .eq('plan_id', planId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, birth_date, weight_kg, height_cm, gender')
      .eq('user_id', user.id)
      .maybeSingle();

    // Recent activities to calibrate
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 180);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    const { data: activities } = await supabase
      .from('all_activities')
      .select('activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,activity_type,vo2_max_daniels')
      .eq('user_id', user.id)
      .gte('activity_date', sinceStr)
      .order('activity_date', { ascending: false });

    const { data: bestSegments } = await supabase
      .from('activity_best_segments')
      .select('*')
      .eq('user_id', user.id)
      .order('best_1km_pace_min_km', { ascending: true })
      .limit(10);

    console.info('[generate-training-plan] Fetched:', {
      activities: activities?.length || 0,
      bestSegments: bestSegments?.length || 0
    });

    const runs = (activities || []).filter((a: any) => (a.activity_type || '').toLowerCase().includes('run'));
    const athleteAnalyzer = new AthleteCapacityAnalyzer(runs, bestSegments || [], profile);
    
    // Calcular número de semanas do plano
    const weeks = Math.max(1, Math.floor(plan.weeks || 4));
    
    // Suporte a paces declarados pelo usuário
    const inputPaces = body?.declared_paces;
    let safeTargetPaces: Paces;
    
    // PRIORIDADE 1: Meta de tempo definida pelo usuário no Step 13
    if (plan.goal_target_time_minutes && typeof plan.goal_target_time_minutes === 'number') {
      const goalMinutes = plan.goal_target_time_minutes;
      const g = normalizeGoal(plan.goal_type);
      
      // Obter capacidade ATUAL do atleta
      const currentCapacityPaces = athleteAnalyzer.getSafeTargetPaces(plan.goal_type);
      
      // Calcular pace ALVO da meta
      let targetPaceMinPerKm: number;
      if (g === '5k') targetPaceMinPerKm = goalMinutes / 5;
      else if (g === '10k') targetPaceMinPerKm = goalMinutes / 10;
      else if (g === '21k') targetPaceMinPerKm = goalMinutes / 21.097;
      else if (g === '42k') targetPaceMinPerKm = goalMinutes / 42.195;
      else targetPaceMinPerKm = currentCapacityPaces.pace_median;
      
      // Calcular % de melhoria necessária
      const currentPace = (currentCapacityPaces as any)[`pace_${g}`] || currentCapacityPaces.pace_median;
      const improvementPercent = ((currentPace - targetPaceMinPerKm) / currentPace) * 100;
      
      console.info('[generate-training-plan] Goal analysis:', {
        currentPace: currentPace.toFixed(2),
        targetPace: targetPaceMinPerKm.toFixed(2),
        improvementNeeded: improvementPercent.toFixed(1) + '%',
        weeks: weeks
      });
      
      // Usar capacidade ATUAL como base para treinos
      safeTargetPaces = {
        ...currentCapacityPaces,
        target_pace: targetPaceMinPerKm,
        improvement_percent: improvementPercent
      };
      
    } else if (inputPaces && (inputPaces.pace_5k || inputPaces.pace_10k || inputPaces.pace_half || inputPaces.pace_marathon)) {
      console.info('[generate-training-plan] Using declared paces from user input', inputPaces);
      safeTargetPaces = deriveTrainingZonesFromDeclaredPaces(inputPaces, plan.goal_type);
      
    } else {
      console.info('[generate-training-plan] Using athlete current capacity');
      safeTargetPaces = athleteAnalyzer.getSafeTargetPaces(plan.goal_type);
    }

    const workouts = generatePlan(plan.goal_type, weeks, safeTargetPaces, prefs, athleteAnalyzer);

    // 🚀 WAVE 1.1: Calculate actual weeks generated (adjustedWeeks)
    const adjustedWeeks = workouts.length > 0 
      ? Math.max(...workouts.map((w: any) => Number(w.week) || 1))
      : weeks;
    
    if (adjustedWeeks !== weeks) {
      console.log(`[generate-training-plan] Adjusted weeks from requested ${weeks} to generated ${adjustedWeeks}`);
    }

    // 🚀 Validação de qualidade do plano gerado
    const easyWorkouts = workouts.filter((w: any) => w.type === 'easy');
    const qualityWorkouts = workouts.filter((w: any) => ['tempo', 'interval', 'fartlek', 'progressivo'].includes(w.type));
    const longWorkouts = workouts.filter((w: any) => w.type === 'long_run');

    const avgEasyPace = easyWorkouts.length > 0 
      ? easyWorkouts.reduce((sum: number, w: any) => sum + (w.target_pace_min_per_km || 0), 0) / easyWorkouts.length
      : 0;
      
    const avgQualityPace = qualityWorkouts.length > 0
      ? qualityWorkouts.reduce((sum: number, w: any) => sum + (w.target_pace_min_per_km || 0), 0) / qualityWorkouts.length
      : 0;

    const firstWeekPaces = workouts.filter((w: any) => w.week === 1).map((w: any) => w.target_pace_min_per_km);
    const lastWeekPaces = workouts.filter((w: any) => w.week === adjustedWeeks).map((w: any) => w.target_pace_min_per_km);

    console.info('📊 [generate-training-plan] PLAN QUALITY VALIDATION:', {
      totalWorkouts: workouts.length,
      distribution: {
        easy: easyWorkouts.length,
        long: longWorkouts.length,
        quality: qualityWorkouts.length,
        percentage_quality: ((qualityWorkouts.length / workouts.length) * 100).toFixed(1) + '%'
      },
      paces: {
        avgEasy: avgEasyPace.toFixed(2) + ' min/km',
        avgQuality: avgQualityPace.toFixed(2) + ' min/km',
        firstWeek: firstWeekPaces.map(p => p?.toFixed(2) || '0').join(', '),
        lastWeek: lastWeekPaces.map(p => p?.toFixed(2) || '0').join(', ')
      },
      progression: {
        week1AvgPace: firstWeekPaces.length > 0 ? (firstWeekPaces.reduce((a, b) => a + b, 0) / firstWeekPaces.length).toFixed(2) : 'N/A',
        weekNAvgPace: lastWeekPaces.length > 0 ? (lastWeekPaces.reduce((a, b) => a + b, 0) / lastWeekPaces.length).toFixed(2) : 'N/A',
        improvement: (safeTargetPaces as any).improvement_percent ? (safeTargetPaces as any).improvement_percent.toFixed(1) + '%' : 'N/A'
      },
      athlete: {
        currentCapacity: safeTargetPaces.pace_median.toFixed(2) + ' min/km',
        targetPace: (safeTargetPaces as any).target_pace ? (safeTargetPaces as any).target_pace.toFixed(2) + ' min/km' : 'N/A',
        bestSegment: (safeTargetPaces as any).pace_best ? (safeTargetPaces as any).pace_best.toFixed(2) + ' min/km' : 'N/A'
      }
    });

    // 🚀 WAVE 3.6: Auto-correct low quality percentage for 5k/10k goals
    const qualityPercentage = (qualityWorkouts.length / workouts.length) * 100;
    const goal = normalizeGoal(plan.goal_type);
    
    if (qualityPercentage < 15 && (goal === '5k' || goal === '10k')) {
      console.warn('⚠️ [generate-training-plan] Low quality workout percentage for speed goal:', qualityPercentage.toFixed(1) + '%');
      console.log('[generate-training-plan] Attempting to promote 1-2 easy runs to tempo runs...');
      
      // Promote 1-2 easy runs in build phase to tempo runs
      let promotedCount = 0;
      const targetPromotions = Math.min(2, Math.ceil((15 - qualityPercentage) / 100 * workouts.length));
      
      for (const workout of workouts) {
        if (promotedCount >= targetPromotions) break;
        
        const phase = getPhase(workout.week, adjustedWeeks);
        if (workout.type === 'easy' && phase === 'build' && !workout.is_cutback_week) {
          workout.type = 'tempo';
          workout.title = 'Tempo 20min';
          workout.description = 'Aquecimento + 20min em ritmo limiar (promovido para qualidade)';
          workout.duration_min = 20;
          workout.distance_km = null;
          workout.target_pace_min_per_km = Number(safeTargetPaces.pace_tempo.toFixed(2));
          workout.target_hr_zone = 3;
          workout.intensity = 'moderate';
          promotedCount++;
          console.log(`[generate-training-plan] Promoted easy run to tempo in week ${workout.week}`);
        }
      }
      
      if (promotedCount > 0) {
        const newQualityPercentage = ((qualityWorkouts.length + promotedCount) / workouts.length) * 100;
        console.log(`[generate-training-plan] Quality percentage increased from ${qualityPercentage.toFixed(1)}% to ${newQualityPercentage.toFixed(1)}%`);
      }
    }

    if (easyWorkouts.length > 0 && avgEasyPace < safeTargetPaces.pace_median) {
      console.warn('⚠️ [generate-training-plan] Easy pace faster than athlete current capacity!', {
        avgEasyPace: avgEasyPace.toFixed(2),
        currentCapacity: safeTargetPaces.pace_median.toFixed(2)
      });
    }

    const startDateIso = prefs?.start_date || plan?.start_date;
    if (!startDateIso) throw new Error('Missing start_date to schedule workouts');
    const startDate = new Date(`${startDateIso}T00:00:00Z`);
    
    // 🚀 WAVE 1.1: Calculate end_date using adjustedWeeks
    const endDate = addDays(startDate, adjustedWeeks * 7 - 1);

    const rows = (workouts || []).map((w: any) => {
      const weekdayIdx = dayToIndex[(w.weekday || '').toLowerCase()] ?? 6;
      const date = getDateForWeekday(startDate, Number(w.week) || 1, weekdayIdx);
      return {
        user_id: plan.user_id,
        plan_id: plan.id,
        workout_date: formatDate(date),
        title: w.title || 'Workout',
        description: w.description || null,
        workout_type: w.type || null,
        target_pace_min_km: typeof w.target_pace_min_per_km === 'number' ? w.target_pace_min_per_km : Number.parseFloat(String(w.target_pace_min_per_km)),
        target_hr_zone: w.target_hr_zone != null ? String(w.target_hr_zone) : null,
        distance_meters: typeof w.distance_km === 'number' ? Math.round(w.distance_km * 1000) : null,
        duration_minutes: typeof w.duration_min === 'number' ? Math.round(w.duration_min) : null,
        status: 'planned' as const,
      };
    });

    // Replace existing planned workouts for this plan
    await supabase.from('training_plan_workouts').delete().eq('plan_id', plan.id);
    let inserted = 0;
    if (rows.length) {
      const { error: insErr } = await supabase.from('training_plan_workouts').insert(rows);
      if (insErr) throw insErr;
      inserted = rows.length;
    }

    // 🚀 WAVE 1.1: Build summary with adjustedWeeks and save seed metadata
    const planSummary = buildPlanSummary(plan.goal_type, adjustedWeeks, safeTargetPaces, workouts, plan.goal_target_time_minutes, athleteAnalyzer);

    // 🚀 WAVE 1.1: Update plan with adjustedWeeks and recalculated end_date
    const { error: updErr } = await supabase
      .from('training_plans')
      .update({
        status: 'active',
        generated_at: new Date().toISOString(),
        plan_summary: planSummary,
        weeks: adjustedWeeks,
        end_date: formatDate(endDate),
      })
      .eq('id', plan.id);
    if (updErr) throw updErr;

    const totalMs = Date.now() - startedAt;
    console.info('[generate-training-plan] deterministic done', { planId: plan.id, inserted, totalMs });

    return new Response(
      JSON.stringify({ ok: true, plan_id: plan.id, inserted_workouts_count: inserted, used_llm: false, plan_summary: planSummary, debug: { total_ms: totalMs } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[generate-training-plan] error', { message: err?.message, stack: err?.stack });
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
