import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StravaPerformanceMetrics {
  user_id: string
  activity_id: string
  movement_efficiency: number | null
  pace_consistency: number | null
  pace_distribution_beginning: number | null
  pace_distribution_middle: number | null
  pace_distribution_end: number | null
  terrain_adaptation_score: number | null
  fatigue_index: number | null
  efficiency_comment: string
  pace_comment: string
  heart_rate_comment: string
  effort_distribution_comment: string
  activity_source: string
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

    // Get Strava activity data - activity_id can be either UUID or strava_activity_id
    let activityQuery = supabase.from('strava_activities').select('*').eq('user_id', user_id)
    
    // Check if activity_id is a UUID (our internal ID) or a number (Strava ID)
    if (activity_id.includes('-')) {
      // It's a UUID, query by our internal id
      activityQuery = activityQuery.eq('id', activity_id)
    } else {
      // It's a Strava activity ID number
      activityQuery = activityQuery.eq('strava_activity_id', parseInt(activity_id))
    }

    const { data: activity, error: activityError } = await activityQuery.single()

    if (activityError) {
      console.error('❌ Strava activity not found:', activityError)
      throw new Error(`Strava activity not found: ${activityError.message}`)
    }

    // Get activity details from strava_activity_details using the actual Strava activity ID
    const { data: details, error: detailsError } = await supabase
      .from('strava_activity_details')
      .select('*')
      .eq('strava_activity_id', activity.strava_activity_id)
      .order('time_seconds', { ascending: true })

    if (detailsError) {
      console.error('❌ Error fetching Strava activity details:', detailsError)
      // Don't throw error if no details found, just proceed with basic metrics
      if (detailsError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch activity details: ${detailsError.message}`)
      } else {
        console.log('⚠️ No activity details found, will calculate basic metrics only')
      }
    }

    console.log(`📊 Processing ${details?.length || 0} detail records for Strava activity`)

    // Calculate performance metrics
    console.log('📈 Starting metrics calculation...')
    const metrics = calculateStravaPerformanceMetrics(activity, details || [])
    console.log('📈 Metrics calculation completed:', JSON.stringify(metrics, null, 2))

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
      console.error('❌ Metrics data being saved:', JSON.stringify(metrics, null, 2))
      throw new Error(`Failed to save metrics: ${saveError.message}`)
    }

    console.log('✅ Strava performance metrics calculated and saved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        metrics: savedMetrics,
        message: 'Strava performance metrics calculated successfully',
        details_count: details?.length || 0
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

function calculateStravaPerformanceMetrics(activity: any, details: any[]): StravaPerformanceMetrics {
  console.log(`🔍 Analyzing Strava activity: ${activity.name} (${details.length} data points)`)

  // Basic calculations from activity summary
  const durationMinutes = activity.moving_time / 60
  const distanceKm = activity.distance / 1000
  const avgSpeedMs = activity.average_speed
  const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / 60) / avgSpeedMs : null

  // 1. Movement Efficiency: distance per minute
  const movementEfficiency = durationMinutes > 0 ? distanceKm / durationMinutes : null

  // 2. Pace Consistency (using activity details if available)
  let paceConsistency = null
  let paceDistributionBeginning = null
  let paceDistributionMiddle = null
  let paceDistributionEnd = null
  let fatigueIndex = null
  let terrainAdaptationScore = null

  if (details && details.length > 10) {
    // Calculate pace consistency using speed variations
    const speeds = details.filter(d => d.speed_ms > 0).map(d => d.speed_ms)
    if (speeds.length > 5) {
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
      const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length
      const stdDev = Math.sqrt(variance)
      paceConsistency = avgSpeed > 0 ? stdDev / avgSpeed : null // Coefficient of variation
    }

    // Calculate pace distribution by thirds
    const third = Math.floor(details.length / 3)
    const beginningDetails = details.slice(0, third)
    const middleDetails = details.slice(third, third * 2)
    const endDetails = details.slice(third * 2)

    const calculateAvgPace = (segment: any[]) => {
      const validSpeeds = segment.filter(d => d.speed_ms > 0).map(d => d.speed_ms)
      if (validSpeeds.length === 0) return null
      const avgSpeed = validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length
      return avgSpeed > 0 ? (1000 / 60) / avgSpeed : null // Convert to min/km
    }

    paceDistributionBeginning = calculateAvgPace(beginningDetails)
    paceDistributionMiddle = calculateAvgPace(middleDetails)
    paceDistributionEnd = calculateAvgPace(endDetails)

    // Calculate fatigue index (pace degradation)
    if (paceDistributionBeginning && paceDistributionEnd) {
      fatigueIndex = ((paceDistributionEnd - paceDistributionBeginning) / paceDistributionBeginning) * 100
    }

    // Calculate terrain adaptation score based on elevation changes
    const elevationChanges = details.filter(d => d.elevation_m !== null).map(d => d.elevation_m)
    if (elevationChanges.length > 5) {
      const elevationGain = elevationChanges.reduce((gain, curr, i) => {
        if (i === 0) return 0
        const diff = curr - elevationChanges[i - 1]
        return gain + (diff > 0 ? diff : 0)
      }, 0)
      
      // Score based on speed maintenance during elevation changes
      terrainAdaptationScore = elevationGain > 10 ? Math.max(0, 100 - (elevationGain * 0.1)) : 100
    }
  }

  // Generate comments based on calculations
  const efficiencyComment = movementEfficiency 
    ? `Eficiência de movimento: ${movementEfficiency.toFixed(2)} km/min`
    : "Dados insuficientes para calcular eficiência"

  const paceComment = avgPaceMinKm
    ? `Pace médio: ${avgPaceMinKm.toFixed(2)} min/km${paceConsistency ? ` (consistência: ${(paceConsistency * 100).toFixed(1)}%)` : ''}`
    : "Dados de pace indisponíveis"

  const heartRateComment = "Análise sem dados de frequência cardíaca"

  const effortComment = paceDistributionBeginning && paceDistributionMiddle && paceDistributionEnd
    ? `Distribuição do pace - Início: ${paceDistributionBeginning.toFixed(2)} min/km, Meio: ${paceDistributionMiddle.toFixed(2)} min/km, Fim: ${paceDistributionEnd.toFixed(2)} min/km`
    : "Dados insuficientes para análise de distribuição"

  return {
    user_id: activity.user_id,
    activity_id: activity.id, // Use our internal UUID for consistency
    movement_efficiency: movementEfficiency,
    pace_consistency: paceConsistency,
    pace_distribution_beginning: paceDistributionBeginning,
    pace_distribution_middle: paceDistributionMiddle,
    pace_distribution_end: paceDistributionEnd,
    terrain_adaptation_score: terrainAdaptationScore,
    fatigue_index: fatigueIndex,
    efficiency_comment: efficiencyComment,
    pace_comment: paceComment,
    heart_rate_comment: heartRateComment,
    effort_distribution_comment: effortComment,
    activity_source: 'strava'
  }
}