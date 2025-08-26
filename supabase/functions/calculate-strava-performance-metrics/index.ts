import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

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
    // Use SERVICE ROLE for consistent access like Garmin function
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { activity_id, user_id } = await req.json()
    
    if (!activity_id || !user_id) {
      throw new Error('Missing required parameters: activity_id and user_id')
    }

    console.log('🔄 Calculating Strava performance metrics for activity:', activity_id, 'user:', user_id)

    // Try to resolve the Strava activity by internal UUID first, then by numeric strava_activity_id
    const resolved = await resolveStravaActivity(supabase, activity_id, user_id)
    if (!resolved) {
      throw new Error('Strava activity not found for provided identifiers')
    }

    const { activity, stravaActivityId } = resolved
    console.log('✅ Found Strava activity:', activity.name, 'strava_id:', stravaActivityId)

    // Fetch activity details in batches (similar to Garmin)
    const details = await fetchStravaDetails(supabase, stravaActivityId)
    console.log(`📊 Found ${details.length} total detail records for calculation`)

    // Calculate performance metrics (parity with Garmin logic, mapped to Strava fields)
    const metrics = calculatePerformanceMetrics(activity, details)

    // Save metrics to database
  const { error: saveError } = await supabase
      .from('performance_metrics')
      .upsert({
        ...metrics,
        user_id,
        activity_id: activity.id,
        activity_source: 'strava',
        calculated_at: new Date().toISOString()
      }, { onConflict: 'user_id,activity_id' })

    if (saveError) {
      console.error('❌ Error saving Strava performance metrics:', saveError)
      throw new Error(`Failed to save metrics: ${saveError.message}`)
    }

    console.log('✅ Strava performance metrics calculated and saved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        metrics,
        details_count: details.length,
        message: 'Strava performance metrics calculated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Error in calculate-strava-performance-metrics:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function resolveStravaActivity(supabase: any, activity_id: string, user_id: string) {
  // 1) Try internal UUID id
  const byUuid = await supabase
    .from('strava_activities')
    .select('*')
    .eq('id', activity_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (byUuid.data) {
    return { activity: byUuid.data, stravaActivityId: byUuid.data.strava_activity_id as number }
  }

  // 2) Try numeric Strava ID
  const numericId = Number(activity_id)
  if (!Number.isNaN(numericId) && Number.isFinite(numericId)) {
    const byStravaId = await supabase
      .from('strava_activities')
      .select('*')
      .eq('strava_activity_id', numericId)
      .eq('user_id', user_id)
      .maybeSingle()

    if (byStravaId.data) {
      return { activity: byStravaId.data, stravaActivityId: numericId }
    }
  }

  console.error('❌ Strava activity not found for', { activity_id, user_id })
  return null
}

async function fetchStravaDetails(supabase: any, stravaActivityId: number) {
  const pageSize = 1000
  let allRows: any[] = []
  let from = 0
  while (true) {
    const { data: page, error: pageError } = await supabase
      .from('strava_activity_details')
      .select('velocity_smooth, heartrate, time_seconds, time_index')
      .eq('strava_activity_id', stravaActivityId)
      .order('time_index', { ascending: true })
      .range(from, from + pageSize - 1)
    if (pageError) {
      console.error('❌ Error fetching Strava activity details page:', pageError)
      throw pageError
    }
    if (!page || page.length === 0) break
    allRows = allRows.concat(page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return allRows
}

function calculatePerformanceMetrics(activity: any, details: any[]) {
  const metrics: any = {
    user_id: activity.user_id,
    activity_id: activity.id
  }

  // Efficiency calculations (map Garmin logic to Strava fields)
  if (activity.average_heartrate && activity.moving_time) {
    // We usually don't have power streams; use metabolic fallback when needed
    // Distance per minute
    if (activity.distance && activity.moving_time > 0) {
      metrics.distance_per_minute = Number((activity.distance / (activity.moving_time / 60)).toFixed(1))
    }

    // Metabolic efficiency via calories when available
    const totalBeats = activity.average_heartrate * (activity.moving_time / 60)
    if (activity.calories && totalBeats > 0) {
      const caloriesPerBeat = activity.calories / totalBeats
      if (caloriesPerBeat >= 0.08) {
        metrics.efficiency_comment = 'Excelente eficiência metabólica'
      } else if (caloriesPerBeat >= 0.06) {
        metrics.efficiency_comment = 'Boa eficiência metabólica'
      } else if (caloriesPerBeat >= 0.04) {
        metrics.efficiency_comment = 'Eficiência metabólica moderada'
      } else {
        metrics.efficiency_comment = 'Baixa eficiência metabólica'
      }
    }
  }

  // Pace/Speed calculations
  if (activity.average_speed) {
    metrics.average_speed_kmh = Number((activity.average_speed * 3.6).toFixed(1))
  }

  // Pace variation coefficient from velocity stream
  if (details.length > 0) {
    const speeds = details
      .map((d: any) => d.velocity_smooth)
      .filter((v: any) => v !== null && v > 0)

    if (speeds.length > 1) {
      const mean = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length
      const variance = speeds.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / speeds.length
      const stdDev = Math.sqrt(variance)
      metrics.pace_variation_coefficient = Number(((stdDev / mean) * 100).toFixed(1))

      if (metrics.pace_variation_coefficient <= 15) {
        metrics.pace_comment = 'Ritmo muito consistente'
      } else if (metrics.pace_variation_coefficient <= 25) {
        metrics.pace_comment = 'Ritmo moderadamente consistente'
      } else {
        metrics.pace_comment = 'Ritmo inconsistente'
      }
    }
  }

  // Heart Rate calculations
  if (activity.average_heartrate) {
    metrics.average_hr = Math.round(activity.average_heartrate)
    if (activity.max_heartrate) {
      metrics.relative_intensity = Number(((activity.average_heartrate / activity.max_heartrate) * 100).toFixed(1))
      const estimatedMaxHr = activity.max_heartrate
      const restingHr = 60
      const hrReserve = estimatedMaxHr - restingHr
      metrics.relative_reserve = Number((((activity.average_heartrate - restingHr) / hrReserve) * 100).toFixed(1))

      if (metrics.relative_intensity >= 90) {
        metrics.heart_rate_comment = 'Intensidade muito alta'
      } else if (metrics.relative_intensity >= 80) {
        metrics.heart_rate_comment = 'Intensidade alta'
      } else if (metrics.relative_intensity >= 70) {
        metrics.heart_rate_comment = 'Intensidade moderada'
      } else {
        metrics.heart_rate_comment = 'Intensidade baixa'
      }
    }
  }

  // Effort Distribution calculation (chronological segments)
  const heartRates = details
    .map((d: any) => d.heartrate)
    .filter((hr: any) => hr !== null)
  if (heartRates.length >= 3) {
    const third = Math.floor(heartRates.length / 3)
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)

    metrics.effort_beginning_bpm = avg(heartRates.slice(0, third))
    metrics.effort_middle_bpm = avg(heartRates.slice(third, 2 * third))
    metrics.effort_end_bpm = avg(heartRates.slice(2 * third))

    const maxEffort = Math.max(metrics.effort_beginning_bpm, metrics.effort_middle_bpm, metrics.effort_end_bpm)
    const minEffort = Math.min(metrics.effort_beginning_bpm, metrics.effort_middle_bpm, metrics.effort_end_bpm)

    if (maxEffort - minEffort <= 10) {
      metrics.effort_distribution_comment = 'Esforço muito consistente'
    } else if (maxEffort - minEffort <= 20) {
      metrics.effort_distribution_comment = 'Esforço moderadamente consistente'
    } else {
      metrics.effort_distribution_comment = 'Esforço variável'
    }
  }

  return metrics
}