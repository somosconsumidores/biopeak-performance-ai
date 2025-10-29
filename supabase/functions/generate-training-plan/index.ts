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

// ---------------- SAFETY CALIBRATOR ----------------
class SafetyCalibrator {
  runs: any[];
  profile: any;
  avgWeeklyKm: number;
  longestRunLast8W: number;
  
  constructor(runs: any[], profile: any) {
    this.runs = runs || [];
    this.profile = profile;
    this.avgWeeklyKm = 0;
    this.longestRunLast8W = 0;
    this.calculateHistoricalMetrics();
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

  calculateHistoricalMetrics() {
    const valid = this.getValidRunData();
    if (!valid.length) {
      this.avgWeeklyKm = 25;
      this.longestRunLast8W = 12;
      return;
    }

    // Calculate average weekly km from last 90 days
    const totalKm = valid.reduce((sum: number, r: any) => 
      sum + (Number(r.total_distance_meters || 0) / 1000), 0
    );
    const weeksInData = Math.max(1, valid.length > 0 ? 12 : 1);
    this.avgWeeklyKm = Math.max(20, totalKm / weeksInData);

    // Find longest run in last 8 weeks
    const now = new Date();
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 3600 * 1000);
    const recentRuns = valid.filter((r: any) => new Date(r.activity_date) >= eightWeeksAgo);
    const distances = recentRuns.map((r: any) => Number(r.total_distance_meters || 0) / 1000);
    this.longestRunLast8W = distances.length > 0 ? Math.max(...distances, 10) : 10;

    console.log('[SafetyCalibrator]', { 
      avgWeeklyKm: this.avgWeeklyKm.toFixed(1), 
      longestRunLast8W: this.longestRunLast8W.toFixed(1) 
    });
  }

  calculateBaselines() {
    const valid = this.getValidRunData();
    if (!valid.length) return this.getDefaults();

    const paces = valid.map((r: any) => Number(r.pace_min_per_km)).sort((a, b) => a - b);
    const best = paces[0];
    const median = paces[Math.floor(paces.length / 2)];
    const p75 = paces[Math.floor(paces.length * 0.75)];

    const base5kMin = median * 5;
    const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06);

    const pace_10k = riegel(base5kMin, 5, 10) / 10;
    const pace_half = riegel(base5kMin, 5, 21.097) / 21.097;
    const pace_marathon = riegel(base5kMin, 5, 42.195) / 42.195;

    return {
      pace_best: best,
      pace_median: median,
      pace_p75: p75,
      pace_5k: median,
      pace_10k,
      pace_half,
      pace_marathon,
      // training zones - more physiologically coherent
      pace_easy: pace_marathon + 0.75,
      pace_long: pace_marathon + 0.45,
      pace_tempo: pace_half - 0.12,
      pace_interval_400m: best - 0.15,
      pace_interval_800m: best,
      pace_interval_1km: pace_10k - 0.08,
    };
  }

  getDefaults() {
    const age = this.profile?.birth_date
      ? Math.floor((Date.now() - new Date(this.profile.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 35;
    const base = age < 25 ? 5.5 : age < 35 ? 6.0 : age < 45 ? 6.5 : 7.0;
    return {
      pace_best: base,
      pace_median: base,
      pace_p75: base + 0.5,
      pace_5k: base,
      pace_10k: base * 1.08,
      pace_half: base * 1.15,
      pace_marathon: base * 1.25,
      pace_easy: base * 1.25 + 0.75,
      pace_long: base * 1.25 + 0.45,
      pace_tempo: base * 1.15 - 0.12,
      pace_interval_400m: base * 0.9,
      pace_interval_800m: base * 0.95,
      pace_interval_1km: base * 1.08 - 0.08,
    };
  }

  getSafeTargetPaces() {
    return this.calculateBaselines();
  }

  getMaxWeeklyKm(): number {
    return Math.min(70, this.avgWeeklyKm * 1.15);
  }

  getMaxLongRunKm(): number {
    return Math.min(32, Math.max(20, this.longestRunLast8W * 1.2));
  }
}

// ---------------- PLAN GENERATOR ----------------

type GoalType =
  | '5k' | '10k' | '21k' | '42k'
  | 'condicionamento' | 'perda_de_peso' | 'manutencao' | 'retorno' | 'melhorar_tempos';

type Paces = ReturnType<SafetyCalibrator['getSafeTargetPaces']>;

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
  calibrator: SafetyCalibrator
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
  calibrator: SafetyCalibrator,
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
  dow: number, // dia da semana (0-6)
  phase: string, 
  vol: number, 
  p: Paces,
  isCutbackWeek: boolean,
  totalSessions: number,
  weeklyQualityCount: number,
  calibrator: SafetyCalibrator
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
      
      // Progressão conforme a fase do plano
      if (phase === 'peak' && mod === 2) {
        // Na fase peak, aumentar intensidade dos intervalados para Z5
        zone = 5;
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

function buildPlanSummary(goal: string, weeks: number, p: Paces, workouts: any[]) {
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

  // Targets: estimate race time when applicable
  let target_pace_min_km: number | null = null;
  let target_time_minutes: number | null = null;
  const g = normalizeGoal(goal || '');
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
      .select('id, user_id, plan_name, goal_type, start_date, end_date, weeks, target_event_date, status')
      .eq('id', planId)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) throw new Error('Plan not found');

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
      .select('activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,activity_type')
      .eq('user_id', user.id)
      .gte('activity_date', sinceStr)
      .order('activity_date', { ascending: false });

    const runs = (activities || []).filter((a: any) => (a.activity_type || '').toLowerCase().includes('run'));
    const safetyCalibrator = new SafetyCalibrator(runs, profile);
    const safeTargetPaces = safetyCalibrator.getSafeTargetPaces();

    const weeks = Math.max(1, Math.floor(plan.weeks || 4));
    const workouts = generatePlan(plan.goal_type, weeks, safeTargetPaces, prefs, safetyCalibrator);

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
    const planSummary = buildPlanSummary(plan.goal_type, weeks, safeTargetPaces, workouts);
    const goalMinutes = planSummary?.targets?.target_time_minutes ?? null;

    const { error: updErr } = await supabase
      .from('training_plans')
      .update({
        status: 'active',
        generated_at: new Date().toISOString(),
        plan_summary: planSummary,
        goal_target_time_minutes: typeof goalMinutes === 'number' ? goalMinutes : null,
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
