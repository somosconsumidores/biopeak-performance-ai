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
    const { user_id, activity_id, activity_source } = body

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

    // Fetch samples per source
    let rows: any[] = []
    if (activity_source === 'garmin') {
      const { data, error } = await supabase
        .from('garmin_activity_details')
        .select('sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, timer_duration_in_seconds, moving_duration_in_seconds')
        .eq('user_id', uid)
        .eq('activity_id', activity_id)
        .order('sample_timestamp', { ascending: true })
      if (error) throw error
      rows = data || []
    } else if (activity_source === 'strava') {
      const { data, error } = await supabase
        .from('strava_activity_details')
        .select('time_seconds, distance, heartrate, velocity_smooth')
        .eq('user_id', uid)
        .eq('strava_activity_id', Number(activity_id))
        .order('time_seconds', { ascending: true })
      if (error) throw error
      rows = data || []
    } else if (activity_source === 'polar') {
      const { data, error } = await supabase
        .from('polar_activity_details')
        .select('sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, duration_in_seconds')
        .eq('user_id', uid)
        .eq('activity_id', activity_id)
        .order('sample_timestamp', { ascending: true })
      if (error) throw error
      rows = data || []
    } else if (activity_source === 'strava_gpx') {
      const { data, error } = await supabase
        .from('strava_gpx_activity_details')
        .select('sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second')
        .eq('user_id', uid)
        .eq('activity_id', activity_id)
        .order('sample_timestamp', { ascending: true })
      if (error) throw error
      rows = data || []
    } else if (activity_source === 'zepp_gpx') {
      const { data, error } = await supabase
        .from('zepp_gpx_activity_details')
        .select('sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, duration_in_seconds')
        .eq('user_id', uid)
        .eq('activity_id', activity_id)
        .order('sample_timestamp', { ascending: true })
      if (error) throw error
      rows = data || []
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No detail rows found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build normalized series
    type SeriesPoint = { time_s: number; distance_m: number | null; hr: number | null; speed_ms: number | null; pace_min_km: number | null }
    const series: SeriesPoint[] = []

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
