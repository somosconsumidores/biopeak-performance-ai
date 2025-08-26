import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { corsHeaders } from '../_shared/cors.ts'

// Simple utilities
function percentileRank(values: number[], target: number) {
  if (!values.length || !Number.isFinite(target)) return null
  const sorted = [...values].sort((a, b) => a - b)
  let count = 0
  for (const v of sorted) if (v <= target) count++
  return Math.round((count / sorted.length) * 100)
}

function zscore(arr: number[]) {
  const n = arr.length
  const mean = arr.reduce((s, v) => s + v, 0) / (n || 1)
  const variance = arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n || 1)
  const std = Math.sqrt(variance) || 1
  return { mean, std }
}

// Lightweight K-means implementation (k=4 by default)
function kmeans(data: number[][], k = 4, maxIter = 50) {
  if (data.length === 0) return { centroids: [], labels: [] as number[] }
  const dim = data[0].length
  // Init: pick first k unique points (deterministic for stability)
  const centroids = data.slice(0, k).map((v) => v.slice())
  let labels = new Array(data.length).fill(0)

  const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    let changed = false
    for (let i = 0; i < data.length; i++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(data[i], centroids[c])
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      if (labels[i] !== best) {
        labels[i] = best
        changed = true
      }
    }

    // Recompute centroids
    const sums = Array.from({ length: k }, () => new Array(dim).fill(0))
    const counts = new Array(k).fill(0)
    for (let i = 0; i < data.length; i++) {
      const l = labels[i]
      counts[l]++
      for (let d = 0; d < dim; d++) sums[l][d] += data[i][d]
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < dim; d++) centroids[c][d] = sums[c][d] / counts[c]
      }
    }

    if (!changed) break
  }

  return { centroids, labels }
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, lookback_days = 56 } = await req.json()
    if (!user_id) throw new Error('Missing user_id')

    const since = new Date()
    since.setDate(since.getDate() - Number(lookback_days))
    const sinceStr = since.toISOString().split('T')[0]

    // Fetch last ~8 weeks of running activities across users (unified table)
    const { data: acts, error: actsErr } = await supabase
      .from('all_activities')
      .select('user_id, activity_date, total_distance_meters, total_time_minutes, pace_min_per_km, activity_type')
      .gte('activity_date', sinceStr)

    if (actsErr) throw actsErr

    const runActs = (acts || []).filter((a: any) => (a.activity_type || '').toLowerCase().includes('run'))

    type Acc = {
      totalDist: number
      totalTimeMin: number
      count: number
      bestPace3k?: number
    }

    const perUser = new Map<string, Acc>()
    const isPaceValid = (p: number) => Number.isFinite(p) && p >= 2.5 && p <= 12

    for (const a of runActs) {
      const uid = a.user_id as string
      const acc = perUser.get(uid) || { totalDist: 0, totalTimeMin: 0, count: 0 }
      const dist = Number(a.total_distance_meters || 0)
      const timeMin = Number(a.total_time_minutes || 0)
      const pace = Number(a.pace_min_per_km)

      acc.totalDist += dist
      acc.totalTimeMin += timeMin
      acc.count += 1

      if (dist >= 3000 && timeMin >= 8 && isPaceValid(pace)) {
        acc.bestPace3k = Math.min(acc.bestPace3k ?? Infinity, pace)
      }

      perUser.set(uid, acc)
    }

    // Build feature vectors per user (weekly averages)
    const rows: { uid: string; weeklyKm: number; weeklyFreq: number; weeklyMin: number; speedKmPerMin: number | null }[] = []
    for (const [uid, acc] of perUser.entries()) {
      const weeklyKm = (acc.totalDist / 1000) / (lookback_days / 7)
      const weeklyFreq = acc.count / (lookback_days / 7)
      const weeklyMin = acc.totalTimeMin / (lookback_days / 7)
      const speedKmPerMin = acc.bestPace3k ? 1 / acc.bestPace3k : null
      rows.push({ uid, weeklyKm, weeklyFreq, weeklyMin, speedKmPerMin })
    }

    if (!rows.length) {
      return new Response(JSON.stringify({ success: true, level: 'Beginner', reason: 'no_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Impute missing speed with mean of present speeds
    const presentSpeeds = rows.map((r) => r.speedKmPerMin).filter((v): v is number => v !== null && Number.isFinite(v))
    const meanSpeed = presentSpeeds.length ? presentSpeeds.reduce((s, v) => s + v, 0) / presentSpeeds.length : 0
    const features = rows.map((r) => [r.weeklyKm, r.weeklyFreq, r.weeklyMin, (r.speedKmPerMin ?? meanSpeed)])

    // Standardize
    const cols = [0, 1, 2, 3]
    const stats = cols.map((c) => zscore(features.map((f) => f[c])))
    const standardized = features.map((f) => f.map((v, i) => (v - stats[i].mean) / (stats[i].std || 1)))

    // K-means (k=4)
    const { centroids, labels } = kmeans(standardized, 4)

    // Order clusters by composite score (higher is better)
    const composite = (v: number[]) => v[0] * 0.4 + v[1] * 0.2 + v[2] * 0.15 + v[3] * 0.25
    const clusterScores = centroids.map((c, idx) => ({ idx, score: composite(c) }))
    clusterScores.sort((a, b) => a.score - b.score) // ascending
    const rankToLabel = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const
    const clusterLabelMap = new Map<number, string>()
    clusterScores.forEach((c, rank) => clusterLabelMap.set(c.idx, rankToLabel[rank]))

    // Extract target user row
    const idxUser = rows.findIndex((r) => r.uid === user_id)
    const userRow = rows[idxUser]
    const userLabelIdx = labels[idxUser]
    const levelCluster = (clusterLabelMap.get(userLabelIdx) || 'Beginner') as 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite'

    // Percentiles (global over lookback window)
    const pWeeklyKm = percentileRank(rows.map((r) => r.weeklyKm), userRow.weeklyKm)
    const pWeeklyFreq = percentileRank(rows.map((r) => r.weeklyFreq), userRow.weeklyFreq)
    const pWeeklyMin = percentileRank(rows.map((r) => r.weeklyMin), userRow.weeklyMin)
    const pSpeed = percentileRank(rows.map((r) => r.speedKmPerMin ?? meanSpeed), userRow.speedKmPerMin ?? meanSpeed)

    const userComposite = composite(standardized[idxUser])
    const allComposite = standardized.map((v) => composite(v))
    const pComposite = percentileRank(allComposite, userComposite)

    // Optional: derive percentile-based level
    let levelPercentile = 'Beginner'
    if ((pComposite ?? 0) >= 90) levelPercentile = 'Elite'
    else if ((pComposite ?? 0) >= 70) levelPercentile = 'Advanced'
    else if ((pComposite ?? 0) >= 40) levelPercentile = 'Intermediate'

    return new Response(
      JSON.stringify({
        success: true,
        level: levelCluster,
        alternative_level_percentile: levelPercentile,
        features: {
          weekly_distance_km: Number(userRow.weeklyKm.toFixed(1)),
          weekly_frequency: Number(userRow.weeklyFreq.toFixed(2)),
          weekly_duration_minutes: Number(userRow.weeklyMin.toFixed(0)),
          best_sustained_pace_min_km: userRow.speedKmPerMin ? Number((1 / userRow.speedKmPerMin).toFixed(2)) : null,
        },
        percentiles: {
          weekly_distance_km: pWeeklyKm,
          weekly_frequency: pWeeklyFreq,
          weekly_duration_minutes: pWeeklyMin,
          sustained_speed_km_per_min: pSpeed,
          composite: pComposite,
        },
        method: 'kmeans+percentiles',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('❌ compute-athlete-level error:', err)
    return new Response(JSON.stringify({ success: false, error: err?.message || 'unknown_error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
