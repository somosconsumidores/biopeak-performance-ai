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
  constructor(runs: any[], profile: any) {
    this.runs = runs || [];
    this.profile = profile;
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

  calculateBaselines() {
    const valid = this.getValidRunData();
    if (!valid.length) return this.getDefaults();

    const paces = valid.map((r: any) => Number(r.pace_min_per_km)).sort((a, b) => a - b);
    const best = paces[0];
    const median = paces[Math.floor(paces.length / 2)];
    const p75 = paces[Math.floor(paces.length * 0.75)];

    const base5kMin = median * 5; // use median for robustness
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
      // training zones
      pace_easy: Math.max(median + 1.0, p75),
      pace_long: Math.max(median + 0.7, p75),
      pace_tempo: best + 0.35,
      pace_interval_400m: best - 0.15,
      pace_interval_800m: best,
      pace_interval_1km: best + 0.10,
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
      pace_easy: base + 1.0,
      pace_long: base + 0.7,
      pace_tempo: base * 0.95,
      pace_interval_400m: base * 0.9,
      pace_interval_800m: base * 0.95,
      pace_interval_1km: base,
    };
  }

  getSafeTargetPaces() {
    return this.calculateBaselines();
  }
}

// ---------------- PLAN GENERATOR ----------------

type GoalType =
  | '5k' | '10k' | '21k' | '42k'
  | 'condicionamento' | 'perda_de_peso' | 'manutencao' | 'retorno' | 'melhorar_tempos';

type Paces = ReturnType<SafetyCalibrator['getSafeTargetPaces']>;

function getPhase(week: number, totalWeeks: number): 'base' | 'build' | 'peak' | 'taper' {
  if (week <= Math.max(1, Math.floor(totalWeeks * 0.4))) return 'base';
  if (week <= Math.max(2, Math.floor(totalWeeks * 0.75))) return 'build';
  if (week <= Math.max(3, Math.floor(totalWeeks * 0.9))) return 'peak';
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

function generatePlan(goalRaw: string, weeks: number, targetPaces: Paces, prefs: any) {
  const goal = (goalRaw || '').toLowerCase() as GoalType;
  const longDayIdx = toDayIndex(prefs?.long_run_weekday, 6);
  const dayIndices = defaultDaysFromPrefs(prefs, longDayIdx);

  const workouts: any[] = [];

  for (let w = 1; w <= weeks; w++) {
    const phase = getPhase(w, weeks);
    const isRecovery = w % 4 === 0 && phase !== 'taper';
    const volumeMultiplier = isRecovery ? 0.7 : 1.0;

    for (const dow of dayIndices) {
      const weekday = Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || 'saturday';
      const isLong = dow === longDayIdx;
      const session = isLong
        ? generateLongRun(goal, w, phase, volumeMultiplier, targetPaces)
        : generateSession(goal, w, phase, volumeMultiplier, targetPaces);

      workouts.push({ ...session, week: w, weekday });
    }
  }

  return workouts;
}

function generateLongRun(goal: GoalType, week: number, phase: string, vol: number, p: Paces) {
  let dist = 10 + week * 0.8;
  switch (goal) {
    case '5k': dist = 6 + week * 0.3; break;
    case '10k': dist = 8 + week * 0.5; break;
    case '21k': dist = Math.min(22, 12 + week * 1.0); break;
    case '42k': dist = Math.min(32, 15 + week * 1.5); break;
    case 'condicionamento': dist = 8 + week * 0.4; break;
    case 'perda_de_peso': dist = 7 + week * 0.4; break;
    case 'manutencao': dist = 10 + week * 0.3; break;
    case 'retorno': dist = Math.min(14, 6 + week * 0.6); break;
    case 'melhorar_tempos': dist = 12 + week * 0.7; break;
  }

  dist = Math.max(6, Math.round(dist * vol));

  const baseDesc = (phase === 'build' || phase === 'peak')
    ? `${dist}km incluindo blocos em ritmo de prova`
    : `${dist}km contínuos em Z2`;

  const pace = goal === '42k' ? p.pace_marathon
    : goal === '21k' ? p.pace_half
    : goal === '10k' ? p.pace_10k
    : p.pace_long;

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

function generateSession(goal: GoalType, week: number, phase: string, vol: number, p: Paces) {
  // Defaults: easy session
  let type = 'easy';
  let title = 'Corrida leve';
  let description = 'Corrida confortável em Z2';
  let distance_km = Math.round((5 + week * 0.5) * vol);
  let duration_min: number | null = null;
  let pace = p.pace_easy;
  let zone = 2;
  let intensity = 'low';

  if (goal === '5k') {
    if (phase !== 'base' && week % 2 === 0) {
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
    if (phase !== 'base' && week % 2 === 0) {
      type = 'tempo';
      title = 'Tempo run 30min';
      description = 'Aquecimento + 30min em ritmo de limiar';
      duration_min = 30;
      distance_km = null as any;
      pace = p.pace_tempo;
      zone = 3;
      intensity = 'moderate';
    }
  } else if (goal === '21k') {
    if (phase !== 'taper' && week % 3 === 0) {
      type = 'interval';
      title = '5x1000m';
      description = 'Aquecimento + 5x1km ritmo 10k, rec 2min';
      duration_min = 35;
      distance_km = null as any;
      pace = p.pace_interval_1km;
      zone = 4;
      intensity = 'high';
    }
  } else if (goal === '42k') {
    if (phase === 'build' && week % 2 === 0) {
      type = 'tempo';
      title = 'Tempo longo 40min';
      description = 'Aquecimento + 40min ritmo maratona';
      duration_min = 40;
      distance_km = null as any;
      pace = p.pace_marathon;
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
    // foco em Z2/Z3 e sessões mais longas
    if (week % 2 === 1) {
      type = 'moderate';
      title = 'Z2-Z3 contínuo';
      description = '30-45min em Z2 com breves progressões';
      duration_min = 40;
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
    // retorno gradual
    distance_km = Math.max(3, Math.round((3 + week * 0.4) * vol));
    pace = p.pace_easy + 0.3; // ainda mais conservador
    zone = 2;
    intensity = 'low';
  } else if (goal === 'melhorar_tempos') {
    if (phase !== 'base' && week % 2 === 1) {
      type = 'interval';
      title = '6x800m';
      description = 'Aquecimento + 6x800m ritmo 5-10k, rec 2min';
      duration_min = 35;
      distance_km = null as any;
      pace = p.pace_interval_800m;
      zone = 4;
      intensity = 'high';
    } else if (phase === 'peak') {
      type = 'tempo';
      title = 'Tempo 20min';
      description = 'Aquecimento + 20min em limiar';
      duration_min = 20;
      distance_km = null as any;
      pace = p.pace_tempo;
      zone = 3;
      intensity = 'moderate';
    }
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

function buildPlanSummary(goal: string, weeks: number, p: Paces) {
  const phases: Array<'base' | 'build' | 'peak' | 'taper'> = [];
  for (let w = 1; w <= weeks; w++) phases.push(getPhase(w, weeks));

  // Targets: estimate race time when applicable
  let target_pace_min_km: number | null = null;
  let target_time_minutes: number | null = null;
  const g = (goal || '').toLowerCase();
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
    notes: 'Plano determinístico gerado sem IA com paces personalizados.',
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
    const workouts = generatePlan(plan.goal_type, weeks, safeTargetPaces, prefs);

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
    const planSummary = buildPlanSummary(plan.goal_type, weeks, safeTargetPaces);
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
