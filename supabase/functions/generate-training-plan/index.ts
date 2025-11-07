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
    
    const distanceRanges = [
      { key: 'pace_5k', min: 4500, max: 5500 },
      { key: 'pace_10k', min: 9000, max: 11000 },
      { key: 'pace_21k', min: 20000, max: 22000 },
      { key: 'pace_42k', min: 41000, max: 43000 }
    ];
    
    for (const range of distanceRanges) {
      const runsInRange = validRuns.filter((r: any) => {
        const dist = Number(r.total_distance_meters || 0);
        return dist >= range.min && dist <= range.max;
      });
      
      if (runsInRange.length > 0) {
        const bestPace = Math.min(...runsInRange.map((r: any) => Number(r.pace_min_per_km)));
        this.bestPerformances[range.key as keyof typeof this.bestPerformances] = bestPace;
      }
    }
    
    console.log('[AthleteCapacityAnalyzer] Best performances:', this.bestPerformances);
  }
  
  analyzeBestSegments() {
    if (this.bestSegments.length > 0) {
      const topSegments = this.bestSegments
        .map((s: any) => Number(s.best_1km_pace_min_km))
        .filter((p: number) => p > 3 && p < 10)
        .sort((a: number, b: number) => a - b)
        .slice(0, 3);
      
      if (topSegments.length > 0) {
        this.bestSegmentPace = topSegments.reduce((sum: number, p: number) => sum + p, 0) / topSegments.length;
      }
    }
    
    console.log('[AthleteCapacityAnalyzer] Best segment pace (avg top 3):', this.bestSegmentPace);
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
    const weeksInData = 12;
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
  weeks: number, 
  targetPaces: Paces, 
  prefs: any, 
  calibrator: AthleteCapacityAnalyzer
) {
  const goal = normalizeGoal(goalRaw);
  const longDayIdx = toDayIndex(prefs?.long_run_weekday, 6);
  const dayIndices = defaultDaysFromPrefs(prefs, longDayIdx);

  const workouts: any[] = [];
  const loadCyclePattern = [1.0, 1.05, 1.1, 0.75]; // 4:1 cycle
  let longRunCount30Plus = 0;
  let lastLongRun30PlusWeek = 0;

  for (let w = 1; w <= weeks; w++) {
    const phase = getPhase(w, weeks);
    const cycleIndex = (w - 1) % 4;
    const isCutbackWeek = cycleIndex === 3 && phase !== 'taper';
    
    // Apply load cycle multiplier
    let volumeMultiplier = loadCyclePattern[cycleIndex];
    
    // Taper: reduce volume progressively
    if (phase === 'taper') {
      const weeksFromEnd = weeks - w + 1;
      volumeMultiplier = weeksFromEnd === 1 ? 0.5 : 0.7;
    }

    // Track weekly quality sessions (max 2 per week)
    let weeklyQualityCount = 0;

    for (const dow of dayIndices) {
      const weekday = Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || 'saturday';
      const isLong = dow === longDayIdx;
      
      const session = isLong
        ? generateLongRun(
            goal, w, phase, volumeMultiplier, targetPaces, calibrator,
            { count30Plus: longRunCount30Plus, lastWeek30Plus: lastLongRun30PlusWeek }
          )
        : generateSession(goal, w, dow, phase, volumeMultiplier, targetPaces, isCutbackWeek, dayIndices.length, weeklyQualityCount, calibrator);

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
      dist = Math.min(16, 10 + week * 0.4); 
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

  return {
    type: 'long_run',
    title: `Longão ${dist}km`,
    description: baseDesc,
    distance_km: dist,
    duration_min: null,
    target_hr_zone: 2,
    target_pace_min_per_km: Number(pace.toFixed(2)),
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
  calibrator: AthleteCapacityAnalyzer
) {
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
      if (week % 2 === 0) {
        type = 'interval';
        title = '8x400m';
        description = 'Aquecimento + 8x400m ritmo 5k, 90s rec';
        duration_min = 25;
        distance_km = null as any;
        pace = p.pace_interval_400m;
        zone = 4;
        intensity = 'high';
      }
    } else if (goal === '10k') {
      if (week % 2 === 0) {
        type = 'tempo';
        title = 'Tempo 25min';
        description = 'Aquecimento + 25min em ritmo de limiar';
        duration_min = 25;
        distance_km = null as any;
        pace = p.pace_tempo;
        zone = 3;
        intensity = 'moderate';
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

  return {
    type,
    title,
    description,
    distance_km: type === 'easy' ? distance_km : (distance_km ?? null),
    duration_min: duration_min ?? null,
    target_hr_zone: zone,
    target_pace_min_per_km: Number(pace.toFixed(2)),
    intensity,
  };
}

function buildPlanSummary(goal: string, weeks: number, p: Paces, workouts: any[], userDefinedTimeMinutes?: number) {
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

    const weeks = Math.max(1, Math.floor(plan.weeks || 4));
    const workouts = generatePlan(plan.goal_type, weeks, safeTargetPaces, prefs, athleteAnalyzer);

    const startDateIso = prefs?.start_date || plan?.start_date;
    if (!startDateIso) throw new Error('Missing start_date to schedule workouts');
    const startDate = new Date(`${startDateIso}T00:00:00Z`);

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

    // Build and save plan summary and status
    const planSummary = buildPlanSummary(plan.goal_type, weeks, safeTargetPaces, workouts, plan.goal_target_time_minutes);

    const { error: updErr } = await supabase
      .from('training_plans')
      .update({
        status: 'active',
        generated_at: new Date().toISOString(),
        plan_summary: planSummary,
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
