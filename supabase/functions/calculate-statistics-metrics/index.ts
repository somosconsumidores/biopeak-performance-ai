import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StatisticsMetrics {
  user_id: string
  activity_id: string
  source_activity: string
  total_distance_km?: number
  total_time_minutes?: number
  average_pace_min_km?: number
  average_heart_rate?: number
  max_heart_rate?: number
  heart_rate_std_dev?: number
  pace_std_dev?: number
  heart_rate_cv_percent?: number
  pace_cv_percent?: number
}

interface ActivityDetail {
  heart_rate?: number
  speed_meters_per_second?: number
  time_seconds?: number
  time_index?: number
  sample_timestamp?: any
  total_distance_in_meters?: number
  velocity?: number
  pace?: number
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

    const { activity_id, user_id, source_activity } = await req.json()

    if (!activity_id || !user_id || !source_activity) {
      throw new Error('Missing required parameters: activity_id, user_id, source_activity')
    }

    // For Strava, ensure activity_id is treated as number for database queries
    const processedActivityId = source_activity.toLowerCase() === 'strava' ? Number(activity_id) : activity_id

    console.log(`🔢 Calculating statistics for activity ${activity_id}, user ${user_id}, source ${source_activity}`)

    // Fetch activity details based on source
    console.log(`📊 Fetching activity details for ${source_activity} activity ${processedActivityId}`)
    const { details, summaryDistance, summaryDuration } = await fetchActivityDetails(supabase, processedActivityId, user_id, source_activity)
    
    if (!details || details.length === 0) {
      console.log(`⚠️ No details found for activity ${activity_id}`)
      return new Response(
        JSON.stringify({ error: 'No activity details found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Processing ${details.length} detail records`)

    // Calculate statistics
    const metrics = calculateStatistics(processedActivityId.toString(), user_id, source_activity, details, summaryDistance, summaryDuration)

    // Upsert metrics to database
    const { error: upsertError } = await supabase
      .from('statistics_metrics')
      .upsert(metrics, {
        onConflict: 'user_id,activity_id,source_activity'
      })

    if (upsertError) {
      console.error('Error upserting statistics metrics:', upsertError)
      throw upsertError
    }

    console.log(`✅ Statistics calculated and saved for activity ${activity_id}`)

    return new Response(
      JSON.stringify({ success: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in calculate-statistics-metrics:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function fetchActivityDetails(
  supabase: any,
  activity_id: string | number,
  user_id: string,
  source_activity: string
): Promise<{ details: ActivityDetail[], summaryDistance?: number, summaryDuration?: number }> {
  let tableName: string
  let activityIdField = 'activity_id'
  let summaryTable: string | null = null
  
  switch (source_activity.toLowerCase()) {
    case 'garmin':
      tableName = 'garmin_activity_details'
      summaryTable = 'garmin_activities'
      break
    case 'strava':
      tableName = 'strava_activity_details'
      summaryTable = 'strava_activities'
      break
    case 'strava gpx':
      tableName = 'strava_gpx_activity_details'
      summaryTable = 'strava_gpx_activities'
      break
    case 'zepp gpx':
      tableName = 'zepp_gpx_activity_details'
      summaryTable = 'zepp_gpx_activities'
      break
    case 'zepp':
      tableName = 'zepp_activity_details'
      summaryTable = 'zepp_activities'
      break
    case 'polar':
      tableName = 'polar_activity_details'
      summaryTable = 'polar_activities'
      break
    default:
      throw new Error(`Unknown source activity: ${source_activity}`)
  }

  // Get summary data first (distance and duration from main activity)
  let summaryDistance: number | undefined
  let summaryDuration: number | undefined
  
  if (summaryTable) {
    console.log(`📋 Fetching summary data from ${summaryTable} for activity ${activity_id}`)
    
    // Build query based on source - avoid reassignment
    let summaryData, summaryError
    
    if (source_activity.toLowerCase() === 'strava') {
      console.log(`🎯 Using Strava fields: distance, elapsed_time for activity ${activity_id}`)
      const result = await supabase
        .from(summaryTable)
        .select('distance, elapsed_time')
        .eq('user_id', user_id)
        .eq('strava_activity_id', Number(activity_id))
        .single()
      summaryData = result.data
      summaryError = result.error
    } else {
      console.log(`🎯 Using standard fields: distance_in_meters, duration_in_seconds for activity ${activity_id}`)
      const result = await supabase
        .from(summaryTable)
        .select('distance_in_meters, duration_in_seconds')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)
        .single()
      summaryData = result.data
      summaryError = result.error
    }
    
    if (summaryError) {
      console.error(`❌ Error fetching summary data:`, summaryError)
      throw summaryError
    }
    
    if (summaryData) {
      if (source_activity.toLowerCase() === 'strava') {
        // Strava uses 'distance' (in meters) and 'elapsed_time' (in seconds)
        summaryDistance = summaryData.distance
        summaryDuration = summaryData.elapsed_time
        console.log(`📏 Strava summary: distance=${summaryDistance}m, duration=${summaryDuration}s`)
      } else {
        summaryDistance = summaryData.distance_in_meters
        summaryDuration = summaryData.duration_in_seconds
        console.log(`📏 Summary: distance=${summaryDistance}m, duration=${summaryDuration}s`)
      }
    } else {
      console.log(`⚠️ No summary data found for activity ${activity_id}`)
    }
  }

  // For Strava activities, the activity_id is already the strava_activity_id
  if (source_activity.toLowerCase() === 'strava') {
    activityIdField = 'strava_activity_id'
  }

  console.log(`📋 Fetching details from ${tableName} where ${activityIdField} = ${activity_id}`)
  
  // Ensure correct type for activity_id in details query
  const activityIdValue = source_activity.toLowerCase() === 'strava' ? Number(activity_id) : activity_id
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq(activityIdField, activityIdValue)
    .eq('user_id', user_id)
    .order('sample_timestamp', { ascending: true })

  if (error) {
    console.error(`❌ Error fetching ${tableName} details:`, error)
    throw error
  }

  console.log(`📊 Found ${data?.length || 0} detail records`)
  return { 
    details: data || [], 
    summaryDistance, 
    summaryDuration 
  }
}

function calculateStatistics(
  activity_id: string,
  user_id: string,
  source_activity: string,
  details: ActivityDetail[],
  summaryDistance?: number,
  summaryDuration?: number
): StatisticsMetrics {
  const metrics: StatisticsMetrics = {
    user_id,
    activity_id,
    source_activity
  }

  // Filter valid data points
  const validHeartRates = details
    .map(d => d.heart_rate)
    .filter(hr => hr != null && hr > 0 && hr < 250) as number[]

  const validSpeeds = details
    .map(d => {
      // Handle different speed/pace fields across sources
      if (d.speed_meters_per_second != null) return d.speed_meters_per_second
      if (d.velocity != null) return d.velocity
      if (d.pace != null && d.pace > 0) return 1000 / (d.pace * 60) // convert pace to speed
      return null
    })
    .filter(speed => speed != null && speed > 0) as number[]

  // Use summary data first, then calculate from details
  // Distance: prioritize summary distance, then last detail point, then estimation
  if (summaryDistance != null && summaryDistance > 0) {
    metrics.total_distance_km = summaryDistance / 1000
  } else {
    const lastPoint = details[details.length - 1]
    if (lastPoint?.total_distance_in_meters != null) {
      metrics.total_distance_km = lastPoint.total_distance_in_meters / 1000
    } else if (validSpeeds.length > 0) {
      // Calculate time first for estimation
      const timePoints = details.map((d, index) => {
        if (d.time_seconds != null) return d.time_seconds
        if (d.time_index != null) return d.time_index
        if (d.sample_timestamp != null) {
          const timestamp = new Date(d.sample_timestamp).getTime()
          if (!isNaN(timestamp)) {
            return Math.floor(timestamp / 1000)
          }
        }
        return index // fallback to index
      })

      let totalTimeMinutes: number | undefined
      if (timePoints.length > 1) {
        const startTime = Math.min(...timePoints)
        const endTime = Math.max(...timePoints)
        totalTimeMinutes = (endTime - startTime) / 60
      }

      if (totalTimeMinutes) {
        // Estimate distance from average speed
        const avgSpeed = validSpeeds.reduce((sum, speed) => sum + speed, 0) / validSpeeds.length
        metrics.total_distance_km = (avgSpeed * totalTimeMinutes * 60) / 1000
      }
    }
  }

  // Duration: prioritize summary duration, then calculate from details
  if (summaryDuration != null && summaryDuration > 0) {
    metrics.total_time_minutes = summaryDuration / 60
  } else {
    const timePoints = details.map((d, index) => {
      if (d.time_seconds != null) return d.time_seconds
      if (d.time_index != null) return d.time_index
      if (d.sample_timestamp != null) {
        const timestamp = new Date(d.sample_timestamp).getTime()
        if (!isNaN(timestamp)) {
          return Math.floor(timestamp / 1000)
        }
      }
      return index // fallback to index
    })

    if (timePoints.length > 1) {
      const startTime = Math.min(...timePoints)
      const endTime = Math.max(...timePoints)
      metrics.total_time_minutes = (endTime - startTime) / 60
    }
  }

  // Calculate average pace
  if (metrics.total_distance_km && metrics.total_time_minutes && metrics.total_distance_km > 0) {
    metrics.average_pace_min_km = metrics.total_time_minutes / metrics.total_distance_km
  }

  // Heart rate statistics
  if (validHeartRates.length > 0) {
    metrics.average_heart_rate = validHeartRates.reduce((sum, hr) => sum + hr, 0) / validHeartRates.length
    metrics.max_heart_rate = Math.max(...validHeartRates)
    
    // Standard deviation
    const hrMean = metrics.average_heart_rate
    const hrVariance = validHeartRates.reduce((sum, hr) => sum + Math.pow(hr - hrMean, 2), 0) / validHeartRates.length
    metrics.heart_rate_std_dev = Math.sqrt(hrVariance)
    
    // Coefficient of variation
    if (metrics.average_heart_rate > 0) {
      metrics.heart_rate_cv_percent = (metrics.heart_rate_std_dev / metrics.average_heart_rate) * 100
    }
  }

  // Pace statistics (from speed data)
  if (validSpeeds.length > 0) {
    const paces = validSpeeds
      .filter(speed => speed > 0)
      .map(speed => 1000 / (speed * 60)) // convert m/s to min/km

    if (paces.length > 0) {
      const paceMean = paces.reduce((sum, pace) => sum + pace, 0) / paces.length
      const paceVariance = paces.reduce((sum, pace) => sum + Math.pow(pace - paceMean, 2), 0) / paces.length
      metrics.pace_std_dev = Math.sqrt(paceVariance)
      
      // Coefficient of variation for pace
      if (metrics.average_pace_min_km && metrics.average_pace_min_km > 0) {
        metrics.pace_cv_percent = (metrics.pace_std_dev / metrics.average_pace_min_km) * 100
      }
    }
  }

  // Round numeric values
  Object.keys(metrics).forEach(key => {
    const value = (metrics as any)[key]
    if (typeof value === 'number' && !isNaN(value)) {
      (metrics as any)[key] = Math.round(value * 100) / 100
    }
  })

  return metrics
}