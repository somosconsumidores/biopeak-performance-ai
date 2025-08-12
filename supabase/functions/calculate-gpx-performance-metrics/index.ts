import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { activity_id, user_id } = await req.json()
    if (!activity_id || !user_id) {
      throw new Error('Missing required parameters: activity_id and user_id')
    }

    console.log('🔄 Calculating GPX performance metrics for activity:', activity_id, 'user:', user_id)

    // Resolve GPX activity in strava_gpx_activities
    const { data: activity, error: actErr } = await supabase
      .from('strava_gpx_activities')
      .select('*')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (actErr) throw actErr
    if (!activity) throw new Error('GPX activity not found for provided identifiers')

    console.log('✅ Found GPX activity:', activity.name, 'type:', activity.activity_type)

    // Fetch GPX details in batches
    const details = await fetchGpxDetails(supabase, activity_id)
    console.log(`📊 Found ${details.length} GPX detail records for calculation`)

    // Calculate metrics (parity with Strava calculation but using GPX fields)
    const metrics = calculatePerformanceMetricsFromGpx(activity, details)

    // Save metrics (strip unsupported columns like duration_seconds/calories to avoid schema mismatches)
    const { duration_seconds, calories, ...sanitized } = (metrics as any)

    const payload = {
      ...sanitized,
      user_id,
      activity_id: activity.activity_id,
      activity_source: 'gpx',
      calculated_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase
      .from('performance_metrics')
      .upsert(payload)

    if (saveError) {
      console.error('❌ Error saving GPX performance metrics:', saveError)
      throw new Error(`Failed to save metrics: ${saveError.message}`)
    }

    console.log('✅ GPX performance metrics calculated and saved successfully')

    return new Response(
      JSON.stringify({ success: true, metrics, details_count: details.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('❌ Error in calculate-gpx-performance-metrics:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function fetchGpxDetails(supabase: any, activityId: string) {
  const pageSize = 1000
  let allRows: any[] = []
  let from = 0
  while (true) {
    const { data: page, error: pageError } = await supabase
      .from('strava_gpx_activity_details')
      .select('speed_meters_per_second, heart_rate, total_distance_in_meters, sample_timestamp')
      .eq('activity_id', activityId)
      .order('sample_timestamp', { ascending: true })
      .range(from, from + pageSize - 1)
    if (pageError) throw pageError
    if (!page || page.length === 0) break
    allRows = allRows.concat(page)
    if (page.length < pageSize) break
    from += pageSize
  }

  // Compute missing speeds from distance/time if needed
  if (allRows.length > 1) {
    for (let i = 1; i < allRows.length; i++) {
      const prev = allRows[i - 1]
      const cur = allRows[i]
      if (!cur.speed_meters_per_second || cur.speed_meters_per_second <= 0) {
        const tPrev = new Date(prev.sample_timestamp).getTime()
        const tCur = new Date(cur.sample_timestamp).getTime()
        const dt = (tCur - tPrev) / 1000
        const dPrev = Number(prev.total_distance_in_meters || 0)
        const dCur = Number(cur.total_distance_in_meters || 0)
        const dd = dCur - dPrev
        const sp = dt > 0 && dd >= 0 ? dd / dt : 0
        cur.speed_meters_per_second = sp
      }
    }
  }

  return allRows
}

function calculatePerformanceMetricsFromGpx(activity: any, details: any[]) {
  const metrics: any = {}

  // Efficiency: distance per minute (km/min) and metabolic comments when HR + calories available
  if (activity.duration_in_seconds && activity.distance_in_meters) {
    const minutes = activity.duration_in_seconds / 60
    if (minutes > 0) {
      const km = activity.distance_in_meters / 1000
      metrics.distance_per_minute = Number((km / minutes).toFixed(2))
    }
  }

  // Pace / speed
  if (activity.average_speed_in_meters_per_second) {
    metrics.average_speed_kmh = Number((activity.average_speed_in_meters_per_second * 3.6).toFixed(1))
  }

  // Pace variation coefficient from speeds
  const speeds = details
    .map((d: any) => d.speed_meters_per_second)
    .filter((v: any) => v !== null && v > 0)
  if (speeds.length > 1) {
    const mean = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length
    const variance = speeds.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / speeds.length
    const stdDev = Math.sqrt(variance)
    metrics.pace_variation_coefficient = Number(((stdDev / mean) * 100).toFixed(1))

    if (metrics.pace_variation_coefficient <= 15) metrics.pace_comment = 'Ritmo muito consistente'
    else if (metrics.pace_variation_coefficient <= 25) metrics.pace_comment = 'Ritmo moderadamente consistente'
    else metrics.pace_comment = 'Ritmo inconsistente'
  }

  // Heart rate metrics
  if (activity.average_heart_rate) {
    metrics.average_hr = Math.round(activity.average_heart_rate)
    if (activity.max_heart_rate) {
      metrics.max_hr = Math.round(activity.max_heart_rate)
      metrics.relative_intensity = Number(((activity.average_heart_rate / activity.max_heart_rate) * 100).toFixed(1))
      const estimatedMaxHr = activity.max_heart_rate
      const restingHr = 60
      const hrReserve = estimatedMaxHr - restingHr
      if (hrReserve > 0) {
        metrics.relative_reserve = Number((((activity.average_heart_rate - restingHr) / hrReserve) * 100).toFixed(1))
      }

      if (metrics.relative_intensity >= 90) metrics.heart_rate_comment = 'Intensidade muito alta'
      else if (metrics.relative_intensity >= 80) metrics.heart_rate_comment = 'Intensidade alta'
      else if (metrics.relative_intensity >= 70) metrics.heart_rate_comment = 'Intensidade moderada'
      else metrics.heart_rate_comment = 'Intensidade baixa'
    }
  }

  // Effort Distribution by thirds using HR stream
  const heartRates = details.map((d: any) => d.heart_rate).filter((hr: any) => hr !== null && hr > 0)
  if (heartRates.length >= 3) {
    const third = Math.floor(heartRates.length / 3)
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)

    metrics.effort_beginning_bpm = avg(heartRates.slice(0, third))
    metrics.effort_middle_bpm = avg(heartRates.slice(third, 2 * third))
    metrics.effort_end_bpm = avg(heartRates.slice(2 * third))

    const maxEffort = Math.max(metrics.effort_beginning_bpm, metrics.effort_middle_bpm, metrics.effort_end_bpm)
    const minEffort = Math.min(metrics.effort_beginning_bpm, metrics.effort_middle_bpm, metrics.effort_end_bpm)
    if (maxEffort - minEffort <= 10) metrics.effort_distribution_comment = 'Esforço muito consistente'
    else if (maxEffort - minEffort <= 20) metrics.effort_distribution_comment = 'Esforço moderadamente consistente'
    else metrics.effort_distribution_comment = 'Esforço variável'
  }

  // Duration / calories passthrough (optional for UI)
  if (activity.duration_in_seconds) metrics.duration_seconds = activity.duration_in_seconds
  if (activity.calories) metrics.calories = activity.calories

  return metrics
}
