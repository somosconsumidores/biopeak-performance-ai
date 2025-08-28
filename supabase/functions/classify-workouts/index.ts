
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { corsHeaders } from '../_shared/cors.ts'

type WorkoutType =
  | 'easy_run'
  | 'long_run'
  | 'interval_or_fartlek'
  | 'tempo_run'
  | 'recovery_run'
  | 'walk_or_invalid'
  | 'unclassified'

type ActivityRow = {
  id: string
  user_id: string
  activity_id: string
  activity_source: string | null
  total_distance_meters: number | null
  total_time_minutes: number | null
  pace_min_per_km: number | null
  average_heart_rate: number | null
  max_heart_rate: number | null
  detected_workout_type: string | null
}

// New: variation row from variation_analysis
type VariationRow = {
  user_id: string
  activity_id: string
  cv_pace: number | null
  cv_hr: number | null
}

function mean(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr: number[]): number | null {
  if (arr.length < 2) return 0
  const m = mean(arr)
  if (m == null) return null
  const v = arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (arr.length - 1)
  return Math.sqrt(v)
}

function coefficientOfVariation(arr: number[]): number | null {
  const m = mean(arr)
  const s = stddev(arr)
  if (!m || m === 0 || s == null) return null
  return s / m
}

function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}

function safeNumber(n: any): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : null
}

function deriveAvgSpeedMs(distance_m?: number | null, duration_s?: number | null, pace_min_km?: number | null): number | null {
  // Prefer calcular a partir do pace se informado
  if (pace_min_km && pace_min_km > 0) {
    return 1000 / (pace_min_km * 60)
  }
  if ((distance_m ?? 0) > 0 && (duration_s ?? 0) > 0) {
    return (distance_m as number) / (duration_s as number)
  }
  return null
}

function deriveDurationSeconds(total_time_minutes?: number | null, distance_m?: number | null, pace_min_km?: number | null): number | null {
  if (total_time_minutes && total_time_minutes > 0) return Math.round(total_time_minutes * 60)
  if (pace_min_km && pace_min_km > 0 && (distance_m ?? 0) > 0) {
    return Math.round((pace_min_km * (distance_m as number)) / (1000 / 60)) // pace(min/km) * km -> min; *60 -> s
  }
  return null
}

function hrPercent(avgHR: number | null, maxHR: number | null): number | null {
  if (!avgHR || !maxHR || maxHR <= 0) return null
  return avgHR / maxHR
}

function classify(
  metrics: {
    distance_km: number | null
    duration_s: number | null
    avg_pace_min_km: number | null
    avg_speed_ms: number | null
    avg_hr: number | null
    max_hr: number | null
    pace_cv: number | null
    hr_cv: number | null
  },
  userAgg: {
    best_pace: number | null
    p75_pace: number | null
  }
): WorkoutType {
  const { distance_km, duration_s, avg_pace_min_km, avg_speed_ms, avg_hr, max_hr, pace_cv, hr_cv } = metrics
  const { best_pace, p75_pace } = userAgg

  // Walk / inválido
  if ((avg_speed_ms != null && avg_speed_ms < 1.5) || (avg_hr != null && avg_hr < 90)) {
    return 'walk_or_invalid'
  }

  const hrPct = hrPercent(avg_hr ?? null, max_hr ?? null)

  // Long run
  if (
    distance_km != null && distance_km > 14 &&
    (pace_cv != null && pace_cv < 0.10) &&
    (hrPct != null && hrPct >= 0.70 && hrPct <= 0.85) // Z2–Z3 aproximado
  ) {
    return 'long_run'
  }

  // Interval / Fartlek
  if (
    (pace_cv != null && pace_cv > 0.20) &&
    (duration_s != null && duration_s < 70 * 60)
  ) {
    return 'interval_or_fartlek'
  }

  // Tempo run
  if (
    distance_km != null && distance_km >= 5 && distance_km <= 12 &&
    avg_pace_min_km != null && best_pace != null &&
    avg_pace_min_km >= best_pace && avg_pace_min_km <= best_pace + 0.4 &&
    (hrPct != null && hrPct >= 0.80 && hrPct <= 0.90) // Z3–Z4 aproximado
  ) {
    return 'tempo_run'
  }

  // Easy run
  if (
    distance_km != null && distance_km >= 3 && distance_km <= 12 &&
    avg_pace_min_km != null && best_pace != null &&
    avg_pace_min_km > best_pace + 1.0 &&
    (hr_cv != null && hr_cv < 0.08)
  ) {
    return 'easy_run'
  }

  // Recovery run
  if (
    distance_km != null && distance_km < 6 &&
    avg_pace_min_km != null && p75_pace != null &&
    avg_pace_min_km > p75_pace &&
    (
      (avg_hr != null && max_hr != null && avg_hr < 0.65 * max_hr) ||
      (avg_hr != null && avg_hr < 125)
    )
  ) {
    return 'recovery_run'
  }

  return 'unclassified'
}

async function fetchAllActivities(supabase: any, filters: { user_id?: string; reclassify?: boolean }, pageSize = 1000): Promise<ActivityRow[]> {
  let from = 0
  const all: ActivityRow[] = []
  while (true) {
    let q = supabase
      .from('all_activities')
      .select('id,user_id,activity_id,activity_source,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,detected_workout_type')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (filters.user_id) q = q.eq('user_id', filters.user_id)
    if (!filters.reclassify) q = q.is('detected_workout_type', null)

    const { data, error } = await q
    if (error) throw error
    if (!data || !data.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

async function fetchUserHistoryPaces(supabase: any, userId: string): Promise<number[]> {
  const paces: number[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('all_activities')
      .select('pace_min_per_km,total_distance_meters')
      .eq('user_id', userId)
      .not('pace_min_per_km', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) {
      const pace = safeNumber(r.pace_min_per_km)
      const dist = safeNumber(r.total_distance_meters)
      if (pace && pace > 0 && (dist ?? 0) > 1000) paces.push(pace)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return paces
}

// New: fetch CVs directly from variation_analysis
async function fetchVariationsForUserActivities(supabase: any, userId: string, activityIds: string[]): Promise<Map<string, VariationRow>> {
  const map = new Map<string, VariationRow>()
  if (!activityIds.length) return map

  const pageSize = 1000
  for (let i = 0; i < activityIds.length; i += pageSize) {
    const chunk = activityIds.slice(i, i + pageSize)
    const { data, error } = await supabase
      .from('variation_analysis')
      .select('user_id,activity_id,cv_pace,cv_hr,pace_cv,heart_rate_cv')
      .eq('user_id', userId)
      .in('activity_id', chunk)
    if (error) throw error
    for (const row of (data || [])) {
      map.set(row.activity_id, row as VariationRow)
    }
  }
  return map
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const userFilter: string | undefined = body.user_id
    const reclassify: boolean = Boolean(body.reclassify)

    // 1) Carregar atividades alvo (idempotente: por padrão só NULL)
    const activities = await fetchAllActivities(supabase, { user_id: userFilter, reclassify })
    if (!activities.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: 'nothing to classify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2) Agregar por usuário
    const byUser = new Map<string, ActivityRow[]>()
    for (const a of activities) {
      if (!a.user_id) continue
      const arr = byUser.get(a.user_id) || []
      arr.push(a)
      byUser.set(a.user_id, arr)
    }

    let updates = 0
    const results: any[] = []

    // 3) Processar usuário a usuário
    for (const [userId, acts] of byUser.entries()) {
      // 3a) Histórico de pace do usuário
      const userPaces = await fetchUserHistoryPaces(supabase, userId)
      const best_pace = userPaces.length ? Math.min(...userPaces) : null
      const p75_pace = userPaces.length ? percentile(userPaces, 75) : null

// 3b) Carregar CVs de variation_analysis
const actIds = acts.map(a => String(a.activity_id)).filter(Boolean)
const variationMap = await fetchVariationsForUserActivities(supabase, userId, actIds)

      // 3c) Classificar cada atividade
      for (const a of acts) {
        const distance_km = (safeNumber(a.total_distance_meters) ?? 0) / 1000
        const duration_s = deriveDurationSeconds(a.total_time_minutes, a.total_distance_meters, a.pace_min_per_km)
        const avg_pace_min_km = safeNumber(a.pace_min_per_km)
        const avg_speed_ms = deriveAvgSpeedMs(a.total_distance_meters ?? null, duration_s, avg_pace_min_km)
        const avg_hr = safeNumber(a.average_heart_rate)
        const max_hr = safeNumber(a.max_heart_rate)

// Buscar CVs oficiais (cv_pace, cv_hr) da variation_analysis
const varRow = variationMap.get(String(a.activity_id))
const pace_cv = (varRow?.cv_pace ?? (varRow as any)?.pace_cv) ?? null
const hr_cv = (varRow?.cv_hr ?? (varRow as any)?.heart_rate_cv) ?? null

        const type = classify(
          { distance_km, duration_s, avg_pace_min_km, avg_speed_ms, avg_hr, max_hr, pace_cv, hr_cv },
          { best_pace, p75_pace }
        )

        // Idempotente: só atualiza se mudou ou se reclassify=true
        const shouldUpdate = reclassify || a.detected_workout_type !== type
        if (shouldUpdate) {
          const { error: updErr } = await supabase
            .from('all_activities')
            .update({ detected_workout_type: type })
            .eq('id', a.id)
          if (updErr) {
            console.error('Update error', { user_id: a.user_id, activity_id: a.activity_id, error: updErr.message })
          } else {
            updates++
          }
        }

        // Log detalhado por atividade
        console.log(JSON.stringify({
          user_id: a.user_id,
          activity_id: a.activity_id,
          detected_type: type,
          metrics: {
            distance_km: distance_km ? Number(distance_km.toFixed(2)) : null,
            duration_s,
            avg_pace_min_km,
            avg_speed_ms: avg_speed_ms ? Number(avg_speed_ms.toFixed(2)) : null,
            avg_hr,
            max_hr,
            pace_cv: pace_cv != null ? Number(pace_cv.toFixed(3)) : null,
            hr_cv: hr_cv != null ? Number(hr_cv.toFixed(3)) : null,
            best_pace,
            p75_pace
          }
        }))

        results.push({
          user_id: a.user_id,
          activity_id: a.activity_id,
          type,
        })
      }
    }

    return new Response(JSON.stringify({ success: true, processed: activities.length, updated: updates, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('classify-workouts error:', err)
    return new Response(JSON.stringify({ success: false, error: err?.message || 'unknown_error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
