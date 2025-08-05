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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { activity_id, user_id } = await req.json()
    
    if (!activity_id || !user_id) {
      throw new Error('Missing required parameters: activity_id and user_id')
    }

    console.log('🔄 Calculating Strava performance metrics for activity:', activity_id, 'user:', user_id)

    // Get Strava activity data using UUID
    const { data: activity, error: activityError } = await supabase
      .from('strava_activities')
      .select('*')
      .eq('id', activity_id)
      .eq('user_id', user_id)
      .single()

    if (activityError) {
      console.error('❌ Strava activity not found:', activityError)
      throw new Error(`Strava activity not found: ${activityError.message}`)
    }

    console.log('✅ Found Strava activity:', activity.name)

    // Calculate basic performance metrics from activity data
    const metrics = calculateBasicStravaMetrics(activity)

    // Save metrics to database
    const { data: savedMetrics, error: saveError } = await supabase
      .from('performance_metrics')
      .upsert({
        ...metrics,
        calculated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,activity_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (saveError) {
      console.error('❌ Error saving Strava performance metrics:', saveError)
      throw new Error(`Failed to save metrics: ${saveError.message}`)
    }

    console.log('✅ Strava performance metrics calculated and saved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        metrics: savedMetrics,
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

function calculateBasicStravaMetrics(activity: any) {
  console.log(`🔍 Analyzing Strava activity: ${activity.name}`)

  // Basic calculations from activity summary
  const durationMinutes = activity.moving_time / 60
  const distanceKm = activity.distance / 1000
  const avgSpeedMs = activity.average_speed
  const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / 60) / avgSpeedMs : null

  // Movement Efficiency: distance per minute
  const movementEfficiency = durationMinutes > 0 ? distanceKm / durationMinutes : null

  // Generate comments based on calculations
  const efficiencyComment = movementEfficiency 
    ? `Eficiência de movimento: ${movementEfficiency.toFixed(2)} km/min`
    : "Dados insuficientes para calcular eficiência"

  const paceComment = avgPaceMinKm
    ? `Pace médio: ${avgPaceMinKm.toFixed(2)} min/km`
    : "Dados de pace indisponíveis"

  return {
    user_id: activity.user_id,
    activity_id: activity.id,
    movement_efficiency: movementEfficiency,
    pace_consistency: null,
    pace_distribution_beginning: null,
    pace_distribution_middle: null,
    pace_distribution_end: null,
    terrain_adaptation_score: null,
    fatigue_index: null,
    efficiency_comment: efficiencyComment,
    pace_comment: paceComment,
    heart_rate_comment: "Análise sem dados de frequência cardíaca",
    effort_distribution_comment: "Dados insuficientes para análise de distribuição",
    activity_source: 'strava'
  }
}