import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Source = 'garmin' | 'strava' | 'polar' | 'strava_gpx' | 'zepp_gpx'

interface CalcBody {
  user_id?: string
  activity_id: string
  activity_source: Source
  internal_call?: boolean
  full_precision?: boolean
}

function paceFromSpeed(speed?: number | null): number | null {
  if (!speed || speed <= 0) return null
  return 1000 / (speed * 60) // min/km
}

function safeAvg(nums: (number | null | undefined)[]): number | null {
  const arr = nums.filter((n): n is number => typeof n === 'number' && isFinite(n))
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// LTTB downsampling for large datasets
function lttbDownsample(data: any[], threshold: number): any[] {
  if (data.length <= threshold || threshold <= 2) return data;

  const sampled: any[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  
  sampled.push(data[0]);
  
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    
    let avgX = 0, avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
      avgX += j;
      avgY += data[j].pace_min_km || data[j].hr || 0;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;
    
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    
    const pointA = sampled[sampled.length - 1];
    const pointAX = sampled.length - 1;
    const pointAY = pointA.pace_min_km || pointA.hr || 0;
    
    let maxArea = -1;
    let maxAreaPoint: any = data[rangeOffs];
    
    for (let j = rangeOffs; j < rangeTo && j < data.length; j++) {
      const pointY = data[j].pace_min_km || data[j].hr || 0;
      const area = Math.abs((pointAX - avgX) * (pointY - pointAY) - (pointAX - j) * (avgY - pointAY));
      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = data[j];
      }
    }
    
    sampled.push(maxAreaPoint);
  }
  
  sampled.push(data[data.length - 1]);
  
  return sampled;
}

// Fetch all rows in pages to bypass the 1000-row default limit
async function fetchAllPaged<T = any>(client: any, table: string, select: string, filters: Record<string, any>, order?: { column: string; ascending: boolean }, pageSize = 1000): Promise<T[]> {
  let from = 0;
  const all: T[] = [];
  while (true) {
    let q = client.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v as any);
    }
    if (order) q = q.order(order.column, { ascending: order.ascending });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = (await req.json()) as CalcBody
    const { user_id, activity_id, activity_source, full_precision } = body

    if (!activity_id || !activity_source) {
      return new Response(JSON.stringify({ error: 'activity_id and activity_source are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve user_id if not provided using details table
    async function resolveUserId(): Promise<string> {
      if (user_id) return user_id
      let query
      switch (activity_source) {
        case 'garmin':
          query = supabase.from('garmin_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'strava':
          query = supabase.from('strava_activity_details').select('user_id').eq('strava_activity_id', Number(activity_id)).limit(1)
          break
        case 'polar':
          query = supabase.from('polar_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'strava_gpx':
          query = supabase.from('strava_gpx_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'zepp_gpx':
          query = supabase.from('zepp_gpx_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
      }
      const { data, error } = await query
      if (error || !data || data.length === 0) throw new Error('Unable to resolve user_id for activity')
      return data[0].user_id
    }

    const uid = await resolveUserId()

    // Fetch samples per source (paged to get ALL points)
    let rows: any[] = []
    if (activity_source === 'garmin') {
      rows = await fetchAllPaged(
        supabase,
        'garmin_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, timer_duration_in_seconds, moving_duration_in_seconds, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'strava') {
      rows = await fetchAllPaged(
        supabase,
        'strava_activity_details',
        'time_seconds, distance, heartrate, velocity_smooth',
        { user_id: uid, strava_activity_id: Number(activity_id) },
        { column: 'time_seconds', ascending: true }
      )
    } else if (activity_source === 'polar') {
      rows = await fetchAllPaged(
        supabase,
        'polar_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, duration_in_seconds, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'strava_gpx') {
      rows = await fetchAllPaged(
        supabase,
        'strava_gpx_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'zepp_gpx') {
      rows = await fetchAllPaged(
        supabase,
        'zepp_gpx_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, duration_in_seconds, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No detail rows found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build normalized series
    type SeriesPoint = { time_s: number; distance_m: number | null; hr: number | null; speed_ms: number | null; pace_min_km: number | null }
    let series: SeriesPoint[] = []

    let timeS = 0
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      // Prefer explicit time fields when available
      const t =
        r.time_seconds ??
        r.duration_in_seconds ??
        r.timer_duration_in_seconds ??
        r.moving_duration_in_seconds ??
        null

      if (typeof t === 'number' && isFinite(t)) {
        timeS = t
      } else {
        timeS = i // fallback to index as seconds
      }

      const speed = r.speed_meters_per_second ?? r.velocity_smooth ?? null
      const hr = r.heart_rate ?? r.heartrate ?? null
      const dist = r.total_distance_in_meters ?? r.distance ?? null

      series.push({
        time_s: timeS,
        distance_m: typeof dist === 'number' ? dist : null,
        hr: typeof hr === 'number' ? hr : null,
        speed_ms: typeof speed === 'number' ? speed : null,
        pace_min_km: paceFromSpeed(typeof speed === 'number' ? speed : null),
      })
    }

    // Fill missing per-point speed/pace using distance/time deltas (important for GPX sources)
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1]
      const cur = series[i]
      const dt = (cur.time_s ?? 0) - (prev.time_s ?? 0)
      if ((!cur.speed_ms || cur.speed_ms <= 0) && typeof cur.distance_m === 'number' && typeof prev.distance_m === 'number' && dt > 0) {
        const dd = cur.distance_m - prev.distance_m
        if (dd >= 0) {
          const sp = dd / dt
          cur.speed_ms = sp
          cur.pace_min_km = paceFromSpeed(sp)
        }
      }
      // If pace exists but speed missing, derive speed
      if ((cur.pace_min_km && cur.pace_min_km > 0) && (!cur.speed_ms || cur.speed_ms <= 0)) {
        cur.speed_ms = 1000 / (cur.pace_min_km * 60)
      }
      // If speed exists but pace missing, derive pace
      if ((cur.speed_ms && cur.speed_ms > 0) && (!cur.pace_min_km || cur.pace_min_km <= 0)) {
        cur.pace_min_km = paceFromSpeed(cur.speed_ms)
      }
    }

    // Derive stats
    const duration_seconds = Math.max(...series.map(s => s.time_s || 0))
    const total_distance_meters = (() => {
      const vals = series.map(s => s.distance_m).filter((v): v is number => typeof v === 'number')
      if (vals.length > 0) return Math.max(...vals)
      // fallback: estimate from speeds (assume 1s sampling)
      const sum = series.map(s => s.speed_ms || 0).reduce((a, b) => a + b, 0)
      return sum
    })()

    const avg_speed_ms = (() => {
      const v = safeAvg(series.map(s => s.speed_ms))
      if (v == null || v <= 0) {
        if (duration_seconds > 0 && total_distance_meters && total_distance_meters > 0) {
          return total_distance_meters / duration_seconds
        }
        return null
      }
      return v
    })()

    const avg_pace_min_km = (() => {
      if (avg_speed_ms && avg_speed_ms > 0) return paceFromSpeed(avg_speed_ms)
      if (duration_seconds > 0 && total_distance_meters && total_distance_meters > 0) {
        return (duration_seconds / 60) / (total_distance_meters / 1000)
      }
      return null
    })()

    const avg_heart_rate = (() => {
      const v = safeAvg(series.map(s => s.hr))
      return v == null ? null : Math.round(v)
    })()
    const max_heart_rate = (() => {
      const vals = series.map(s => s.hr).filter((v): v is number => typeof v === 'number')
      return vals.length ? Math.max(...vals) : null
    })()

    // Apply full precision logic
    if (full_precision !== true && series.length > 2000) {
      // Default sampling: keep every Nth point to stay around 2000 points
      const step = Math.ceil(series.length / 2000);
      const sampled: SeriesPoint[] = [];
      for (let i = 0; i < series.length; i += step) {
        sampled.push(series[i]);
      }
      // Always include last point
      if (sampled[sampled.length - 1] !== series[series.length - 1]) {
        sampled.push(series[series.length - 1]);
      }
      series = sampled;
    } else if (full_precision === true && series.length > 10000) {
      // Safety net: if too many points even with full precision, apply LTTB
      console.warn(`[calculate-activity-chart-data] Large dataset (${series.length} points), applying LTTB to 5000 points`);
      series = lttbDownsample(series, 5000);
    }

    const data_points_count = series.length

    // Upsert (manual upsert to avoid relying on unique constraint)
    const { data: existing, error: selErr } = await supabase
      .from('activity_chart_data')
      .select('id')
      .eq('user_id', uid)
      .eq('activity_source', activity_source)
      .eq('activity_id', activity_id)
      .maybeSingle()
    if (selErr) throw selErr

    const payload = {
      user_id: uid,
      activity_id,
      activity_source,
      series_data: series,
      data_points_count,
      duration_seconds: duration_seconds || null,
      total_distance_meters: total_distance_meters || null,
      avg_speed_ms: avg_speed_ms || null,
      avg_pace_min_km: avg_pace_min_km || null,
      avg_heart_rate: avg_heart_rate || null,
      max_heart_rate: max_heart_rate || null,
    }

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('activity_chart_data')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updErr) throw updErr
    } else {
      const { error: insErr } = await supabase
        .from('activity_chart_data')
        .insert(payload)
      if (insErr) throw insErr
    }

    // Build and upsert GPS coordinates when available
    const coordPairs = rows
      .map((r: any) => {
        const lat = r.latitude_in_degree ?? r.latitude ?? null
        const lon = r.longitude_in_degree ?? r.longitude ?? null
        return (typeof lat === 'number' && isFinite(lat) && typeof lon === 'number' && isFinite(lon))
          ? [lat, lon] as [number, number]
          : null
      })
      .filter((p: any): p is [number, number] => Array.isArray(p))

    if (coordPairs.length > 0) {
      const total_points = coordPairs.length
      // Downsample coordinates to ~2000 points if needed
      let sampled = coordPairs
      if (coordPairs.length > 2000) {
        const step = Math.ceil(coordPairs.length / 2000)
        sampled = []
        for (let i = 0; i < coordPairs.length; i += step) sampled.push(coordPairs[i])
        if (sampled[sampled.length - 1] !== coordPairs[coordPairs.length - 1]) sampled.push(coordPairs[coordPairs.length - 1])
      }

      const lats = sampled.map(c => c[0])
      const lons = sampled.map(c => c[1])
      const bounds: [[number, number],[number, number]] = [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      ]

      // Upsert into activity_coordinates
      // Upsert into activity_coordinates (handles race conditions and avoids missing columns)
      const coordPayload = {
        user_id: uid,
        activity_id,
        activity_source,
        coordinates: sampled,
        total_points,
        sampled_points: sampled.length,
        starting_latitude: sampled[0]?.[0] ?? null,
        starting_longitude: sampled[0]?.[1] ?? null,
        bounding_box: bounds,
      }

      const { error: upsertCoordErr } = await supabase
        .from('activity_coordinates')
        .upsert(coordPayload, { onConflict: 'user_id,activity_source,activity_id' })
      if (upsertCoordErr) throw upsertCoordErr
      
    }

    return new Response(
      JSON.stringify({ success: true, user_id: uid, activity_id, activity_source, points: series.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (e) {
    console.error('[calculate-activity-chart-data] error', e)
    return new Response(JSON.stringify({ success: false, error: (e as any)?.message || String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
