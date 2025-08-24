import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuildBody {
  activity_id: number | string
  user_id?: string
  access_token?: string
  internal_call?: boolean
  full_precision?: boolean
}

interface SeriesPoint {
  i: number
  distance_m?: number | null
  pace_min_km?: number | null
  heart_rate?: number | null
  speed_ms?: number | null
}

function paceFromSpeed(speed?: number | null): number | null {
  if (!speed || !isFinite(speed) || speed <= 0) return null
  return (1000 / speed) / 60
}

function safeAvg(nums: (number | null | undefined)[]): number | null {
  const vals = nums.filter((n): n is number => typeof n === 'number' && isFinite(n))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// Largest Triangle Three Buckets downsampling
function lttbDownsample(data: SeriesPoint[], threshold: number): SeriesPoint[] {
  if (threshold >= data.length || threshold === 0) return data
  const sampled: SeriesPoint[] = []
  const bucketSize = (data.length - 2) / (threshold - 2)
  let a = 0
  sampled.push(data[a])
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1
    const rangeEnd = Math.floor((i + 2) * bucketSize) + 1
    const rangeEndClamped = Math.min(rangeEnd, data.length)

    let avgX = 0, avgY = 0, avgCount = 0
    for (let j = rangeStart; j < rangeEndClamped; j++) {
      const x = data[j].distance_m ?? j
      const y = data[j].pace_min_km ?? 0
      avgX += x
      avgY += y
      avgCount++
    }
    avgX /= Math.max(avgCount, 1)
    avgY /= Math.max(avgCount, 1)

    let rangeOffs = Math.floor(i * bucketSize) + 1
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let nextA = rangeOffs

    for (; rangeOffs < rangeTo; rangeOffs++) {
      const ax = data[a].distance_m ?? a
      const ay = data[a].pace_min_km ?? 0
      const bx = data[rangeOffs].distance_m ?? rangeOffs
      const by = data[rangeOffs].pace_min_km ?? 0
      const area = Math.abs((ax - avgX) * (by - ay) - (ax - bx) * (avgY - ay))
      if (area > maxArea) {
        maxArea = area
        nextA = rangeOffs
      }
    }

    sampled.push(data[nextA])
    a = nextA
  }
  sampled.push(data[data.length - 1])
  return sampled
}

function dedupeByIndex(data: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let lastI: number | null = null
  for (const p of data) {
    if (lastI === p.i) continue
    out.push(p)
    lastI = p.i
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })

  try {
    const body = (await req.json()) as BuildBody
    if (!body?.activity_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing activity_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve user
    let userId = body.user_id || null
    if (!userId && !body.internal_call) {
      const { data: userData } = await supabase.auth.getUser()
      userId = userData?.user?.id ?? null
    }
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'Unable to resolve user_id' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve Strava access token
    let accessToken = body.access_token || null
    if (!accessToken) {
      const { data: tokenRow } = await supabase
        .from('strava_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      accessToken = tokenRow?.access_token || null
    }
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, error: 'Missing access token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch streams from Strava
    const keys = [
      'latlng', 'time', 'distance', 'velocity_smooth', 'heartrate', 'grade_smooth', 'watts', 'cadence', 'moving', 'temp'
    ]
    const streamsUrl = `https://www.strava.com/api/v3/activities/${body.activity_id}/streams?keys=${keys.join(',')}&key_by_type=true`

    let res = await fetch(streamsUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })

    // If unauthorized, try refresh once via edge function
    if (res.status === 401) {
      const refreshResp = await supabase.functions.invoke('strava-token-refresh', {
        body: { user_id: userId },
      })
      if (!refreshResp.error && refreshResp.data?.access_token) {
        accessToken = refreshResp.data.access_token
        res = await fetch(streamsUrl, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        })
      }
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Strava streams error ${res.status}: ${text}`)
    }

    const data = await res.json()
    // data is keyed by type when key_by_type=true
    const latlng: number[][] | undefined = data?.latlng?.data
    const time: number[] | undefined = data?.time?.data
    const distance: number[] | undefined = data?.distance?.data
    const speed: number[] | undefined = (data?.velocity_smooth || data?.speed)?.data
    const hr: number[] | undefined = (data?.heartrate || data?.heart_rate)?.data

    const n = Math.max(
      time?.length || 0,
      distance?.length || 0,
      speed?.length || 0,
      hr?.length || 0,
      latlng?.length || 0,
    )

    if (!n || n < 2) {
      return new Response(JSON.stringify({ success: false, error: 'No stream points' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawSeries: SeriesPoint[] = new Array(n)
    for (let i = 0; i < n; i++) {
      const s = speed?.[i] ?? null
      const p = paceFromSpeed(s)
      rawSeries[i] = {
        i,
        distance_m: distance?.[i] ?? null,
        pace_min_km: p,
        heart_rate: hr?.[i] ?? null,
        speed_ms: s,
      }
    }

    // Compute stats
    const duration_seconds = (time && time.length ? time[time.length - 1] - time[0] : null) ?? null
    const total_distance_meters = distance && distance.length ? distance[distance.length - 1] : safeAvg(rawSeries.map(r => r.distance_m))
    const avg_speed_ms = safeAvg(rawSeries.map(r => r.speed_ms))
    const avg_pace_min_km = paceFromSpeed(avg_speed_ms)
    const avg_heart_rate = safeAvg(rawSeries.map(r => r.heart_rate))
    const max_heart_rate = Math.max(...rawSeries.map(r => (r.heart_rate ?? -Infinity))).toString() === '-Infinity' ? null : Math.max(...rawSeries.map(r => r.heart_rate ?? -Infinity))

    // Sampling policy: default full precision unless explicitly disabled
    const useFullPrecision = body.full_precision !== false
    let sampled = dedupeByIndex(rawSeries)
    if (useFullPrecision && sampled.length > 10000) {
      sampled = lttbDownsample(sampled, 5000)
    }
    if (!useFullPrecision) {
      // lightweight LTTB to ~2000 points
      if (sampled.length > 2000) sampled = lttbDownsample(sampled, 2000)
    }

    // Build coordinates payload
    let bbox = null as null | { minLat: number; minLon: number; maxLat: number; maxLon: number }
    let startLat: number | null = null
    let startLon: number | null = null
    let coordinates: { lat: number; lon: number }[] = []
    if (latlng && latlng.length) {
      for (let i = 0; i < latlng.length; i++) {
        const [lat, lon] = latlng[i] || []
        if (typeof lat === 'number' && typeof lon === 'number') {
          if (startLat == null) { startLat = lat; startLon = lon }
          if (!bbox) bbox = { minLat: lat, minLon: lon, maxLat: lat, maxLon: lon }
          else {
            bbox.minLat = Math.min(bbox.minLat, lat)
            bbox.minLon = Math.min(bbox.minLon, lon)
            bbox.maxLat = Math.max(bbox.maxLat, lat)
            bbox.maxLon = Math.max(bbox.maxLon, lon)
          }
          coordinates.push({ lat, lon })
        }
      }
    }

    // Upsert activity_chart_data
    const acdPayload = {
      user_id: userId,
      activity_id: String(body.activity_id),
      activity_source: 'strava',
      processed_at: new Date().toISOString(),
      total_distance_meters: total_distance_meters ?? null,
      duration_seconds: duration_seconds ?? null,
      avg_speed_ms: avg_speed_ms ?? null,
      avg_pace_min_km: avg_pace_min_km ?? null,
      avg_heart_rate: avg_heart_rate ? Math.round(avg_heart_rate) : null,
      max_heart_rate: max_heart_rate ?? null,
      data_points_count: sampled.length,
      series_data: sampled.map(({ i, ...rest }) => rest),
    }

    const { error: upsertErr } = await supabase
      .from('activity_chart_data')
      .upsert(acdPayload as any, { onConflict: 'user_id,activity_source,activity_id' })
    if (upsertErr) throw upsertErr

    // Upsert coordinates if we have any
    if (coordinates.length) {
      const coordsPayload: any = {
        user_id: userId,
        activity_source: 'strava',
        activity_id: String(body.activity_id),
        coordinates,
        total_points: coordinates.length,
        sampled_points: Math.min(sampled.length, coordinates.length),
        starting_latitude: startLat,
        starting_longitude: startLon,
        bounding_box: bbox,
      }
      const { error: coordErr } = await supabase
        .from('activity_coordinates')
        .upsert(coordsPayload, { onConflict: 'user_id,activity_source,activity_id' })
      if (coordErr) console.warn('Coordinates upsert warning:', coordErr.message)
    }

    console.log(`Built chart data directly from Strava streams for activity: ${body.activity_id}`)
    return new Response(JSON.stringify({ success: true, points: sampled.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('build-activity-chart-from-strava-streams error:', e)
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
