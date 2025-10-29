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

// Seeded RNG for deterministic behavior
function seededRandom(seed = 1337) {
  let x = seed >>> 0
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    // Map to [0,1)
    return ((x >>> 0) % 1_000_000) / 1_000_000
  }
}

// First principal component weights via power iteration on standardized data
function computePC1Weights(X: number[][], maxIter = 100, tol = 1e-6) {
  if (!X.length) return [1, 1, 1, 1].map((v, _, a) => 1 / Math.sqrt(a.length))
  const dim = X[0].length
  // Init weights slightly biased to distance to stabilize sign
  let w = Array.from({ length: dim }, (_, i) => (i === 0 ? 1 : 0.5))
  const normalize = (v: number[]) => {
    const n = Math.hypot(...v) || 1
    return v.map((x) => x / n)
  }
  w = normalize(w)

  const XtXw = () => {
    // t = X * w
    const t = X.map((row) => row.reduce((s, v, i) => s + v * w[i], 0))
    // w_next = (X^T * t) / n
    const res = new Array(dim).fill(0)
    for (let i = 0; i < X.length; i++) {
      const ti = t[i]
      for (let j = 0; j < dim; j++) res[j] += X[i][j] * ti
    }
    for (let j = 0; j < dim; j++) res[j] /= X.length
    return res
  }

  for (let it = 0; it < maxIter; it++) {
    const wNext = normalize(XtXw())
    const diff = Math.hypot(...w.map((v, j) => v - wNext[j]))
    w = wNext
    if (diff < tol) break
  }
  // Ensure the direction aligns positively with weekly distance (feature 0)
  if (w[0] < 0) w = w.map((v) => -v)
  return w
}

// K-means with k-means++ initialization (seeded)
function kmeans(data: number[][], k = 4, maxIter = 50, seed = 1337) {
  if (data.length === 0) return { centroids: [], labels: [] as number[] }
  const dim = data[0].length
  const rand = seededRandom(seed)

  const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)

  // k-means++ init
  const centroids: number[][] = []
  centroids.push(data[Math.floor(rand() * data.length)].slice())
  while (centroids.length < k) {
    const d2 = data.map((p) => {
      let best = Infinity
      for (const c of centroids) {
        const d = dist2(p, c)
        if (d < best) best = d
      }
      return best
    })
    const sum = d2.reduce((s, v) => s + v, 0) || 1
    let r = rand() * sum
    let idx = 0
    for (let i = 0; i < d2.length; i++) {
      r -= d2[i]
      if (r <= 0) {
        idx = i
        break
      }
    }
    centroids.push(data[idx].slice())
  }

  let labels = new Array(data.length).fill(0)

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

    // Adaptive lookback: try provided days, then extend to 120 and 180 if few recent runs for target user
    let effectiveLookback = Math.min(Math.max(Number(lookback_days) || 56, 14), 180)
    const candidates = Array.from(new Set([effectiveLookback, 120, 180]))

    let acts: any[] = []
    for (const lb of candidates) {
      const since = new Date()
      since.setDate(since.getDate() - lb)
      const sinceStr = since.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('all_activities')
        .select('user_id, activity_date, total_distance_meters, total_time_minutes, pace_min_per_km, activity_type')
        .gte('activity_date', sinceStr)

      if (error) throw error
      acts = data || []

      const runActsProbe = acts.filter((a: any) => (a.activity_type || '').toLowerCase().includes('run'))
      const userRunCount = runActsProbe.filter((a: any) => a.user_id === user_id).length
      effectiveLookback = lb
      if (userRunCount >= 6 || lb === 180) break
    }

    const runActs = (acts || []).filter((a: any) => (a.activity_type || '').toLowerCase().includes('run'))

    type Acc = {
      totalDist: number
      totalTimeMin: number
      count: number
      bestPace3k?: number
      bestPace1k?: number
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

      if (isPaceValid(pace)) {
        if (dist >= 3000 && timeMin >= 8) {
          acc.bestPace3k = Math.min(acc.bestPace3k ?? Infinity, pace)
        }
        if (dist >= 1000 && timeMin >= 4) {
          acc.bestPace1k = Math.min(acc.bestPace1k ?? Infinity, pace)
        }
      }

      perUser.set(uid, acc)
    }

    // Build feature vectors per user (weekly averages)
    const rows: { uid: string; weeklyKm: number; weeklyFreq: number; weeklyMin: number; speedKmPerMin: number | null }[] = []
    for (const [uid, acc] of perUser.entries()) {
      const weeklyKm = (acc.totalDist / 1000) / (effectiveLookback / 7)
      const weeklyFreq = acc.count / (effectiveLookback / 7)
      const weeklyMin = acc.totalTimeMin / (effectiveLookback / 7)
      const speedKmPerMin = acc.bestPace3k ? 1 / acc.bestPace3k : (acc.bestPace1k ? 1 / acc.bestPace1k : null)
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
    // Data-driven composite via PCA (PC1)
    const pc1 = computePC1Weights(standardized)
    const composite = (v: number[]) => v.reduce((s, val, i) => s + val * pc1[i], 0)
    const clusterScores = centroids.map((c, idx) => ({ idx, score: composite(c) }))
    clusterScores.sort((a, b) => a.score - b.score) // ascending
    const rankToLabel = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const
    const clusterLabelMap = new Map<number, string>()
    clusterScores.forEach((c, rank) => clusterLabelMap.set(c.idx, rankToLabel[rank]))

    // Extract target user row
    const idxUser = rows.findIndex((r) => r.uid === user_id)
    
    // If user not found in the activity data, return Beginner
    if (idxUser === -1) {
      return new Response(JSON.stringify({ 
        success: true, 
        level: 'Beginner', 
        reason: 'no_user_data',
        features: {
          weekly_distance_km: 0,
          weekly_frequency: 0,
          weekly_duration_minutes: 0,
          best_sustained_pace_min_km: null,
        },
        percentiles: {
          weekly_distance_km: null,
          weekly_frequency: null,
          weekly_duration_minutes: null,
          sustained_speed_km_per_min: null,
          composite: null,
        },
        method: 'no_data'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    
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
