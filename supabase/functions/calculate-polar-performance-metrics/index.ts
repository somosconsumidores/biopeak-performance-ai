import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to safely convert duration to seconds
function getDurationInSeconds(duration: any): number | null {
  if (!duration) return null
  
  // If it's already a number (seconds), return it
  if (typeof duration === 'number') {
    return duration
  }
  
  // If it's a string that represents a number
  if (typeof duration === 'string' && !isNaN(Number(duration))) {
    return Number(duration)
  }
  
  return null
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

    console.log('🔄 Calculating Polar performance metrics for activity:', activity_id, 'user:', user_id)

    // Get Polar activity data using UUID
    const { data: activity, error: activityError } = await supabase
      .from('polar_activities')
      .select('*')
      .eq('id', activity_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (activityError) {
      console.error('❌ Error fetching Polar activity:', activityError)
      throw new Error(`Error fetching Polar activity: ${activityError.message}`)
    }

    if (!activity) {
      console.error('❌ Polar activity not found for ID:', activity_id)
      throw new Error(`Polar activity not found for ID: ${activity_id}`)
    }

    console.log('✅ Found Polar activity:', activity.sport || 'Unknown Sport')

    // Calculate basic performance metrics from activity data
    const metrics = calculateBasicPolarMetrics(activity)

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
      console.error('❌ Error saving Polar performance metrics:', saveError)
      throw new Error(`Failed to save metrics: ${saveError.message}`)
    }

    console.log('✅ Polar performance metrics calculated and saved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        metrics: savedMetrics,
        message: 'Polar performance metrics calculated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Error in calculate-polar-performance-metrics:', error)
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

function calculateBasicPolarMetrics(activity: any) {
  console.log(`🔍 Analyzing Polar activity: ${activity.sport}`)
  console.log(`📊 Duration value: ${activity.duration} (type: ${typeof activity.duration})`)
  console.log(`📏 Distance value: ${activity.distance} meters`)

  // Get duration in seconds (Polar stores duration as number in seconds)
  const durationSeconds = getDurationInSeconds(activity.duration)
  const durationMinutes = durationSeconds ? durationSeconds / 60 : null
  
  // Basic calculations from activity summary
  const distanceKm = activity.distance ? activity.distance / 1000 : null
  const calories = activity.calories

  console.log(`⏱️ Duration: ${durationSeconds}s (${durationMinutes?.toFixed(2)}min)`)
  console.log(`📍 Distance: ${distanceKm?.toFixed(2)}km`)

  // Movement Efficiency: distance per minute
  const movementEfficiency = (durationMinutes && distanceKm) 
    ? distanceKm / durationMinutes 
    : null

  // Calculate average speed if we have distance and duration
  const avgSpeedKmh = (distanceKm && durationMinutes) 
    ? (distanceKm / durationMinutes) * 60 
    : null

  // Calculate pace in min/km
  const avgPaceMinKm = (avgSpeedKmh && avgSpeedKmh > 0) 
    ? 60 / avgSpeedKmh 
    : null

  console.log(`🏃 Calculated metrics:`)
  console.log(`  - Movement efficiency: ${movementEfficiency?.toFixed(3)} km/min`)
  console.log(`  - Average speed: ${avgSpeedKmh?.toFixed(2)} km/h`)
  console.log(`  - Average pace: ${avgPaceMinKm?.toFixed(2)} min/km`)

  // Generate comments based on calculations
  const efficiencyComment = movementEfficiency 
    ? `Eficiência de movimento: ${movementEfficiency.toFixed(3)} km/min`
    : "Dados insuficientes para calcular eficiência"

  const paceComment = avgPaceMinKm
    ? `Pace médio: ${Math.floor(avgPaceMinKm)}:${Math.round((avgPaceMinKm % 1) * 60).toString().padStart(2, '0')} min/km`
    : "Dados de pace indisponíveis"

  const heartRateComment = "Análise de frequência cardíaca não disponível para dados Polar básicos"

  const trainingLoadComment = activity.training_load
    ? `Carga de treino Polar: ${activity.training_load}`
    : "Carga de treino não disponível"

  return {
    user_id: activity.user_id,
    activity_id: activity.id,
    movement_efficiency: movementEfficiency,
    distance_per_minute: movementEfficiency,
    average_speed_kmh: avgSpeedKmh,
    pace_consistency: null,
    pace_distribution_beginning: null,
    pace_distribution_middle: null,
    pace_distribution_end: null,
    terrain_adaptation_score: null,
    fatigue_index: null,
    efficiency_comment: efficiencyComment,
    pace_comment: paceComment,
    heart_rate_comment: heartRateComment,
    effort_distribution_comment: trainingLoadComment,
    activity_source: 'polar'
  }
}