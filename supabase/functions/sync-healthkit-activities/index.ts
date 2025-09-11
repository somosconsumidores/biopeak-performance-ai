import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to calculate bounding box from coordinates
function calculateBoundingBox(coordinates: number[][]) {
  if (!coordinates || coordinates.length === 0) return null;
  
  let minLat = coordinates[0][0], maxLat = coordinates[0][0];
  let minLon = coordinates[0][1], maxLon = coordinates[0][1];
  
  for (const [lat, lon] of coordinates) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  
  return {
    southwest: { lat: minLat, lng: minLon },
    northeast: { lat: maxLat, lng: maxLon }
  };
}

// Helper function to calculate pace from speed
function calculatePace(speedMs: number): number | null {
  if (!speedMs || speedMs <= 0) return null;
  return 1000 / (speedMs * 60); // Convert m/s to min/km
}

// Helper function to sample large datasets
function sampleData<T>(data: T[], maxPoints: number = 5000): T[] {
  if (data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { workouts } = await req.json()

    if (!workouts || !Array.isArray(workouts)) {
      return new Response(JSON.stringify({ error: 'Invalid workouts data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let processedCount = 0
    const errors: string[] = []

    for (const workout of workouts) {
      try {
        // Validate workout data
        if (!workout.uuid || !workout.startTime || !workout.endTime) {
          errors.push(`Invalid workout data for ${workout.uuid || 'unknown'}: missing required fields`)
          continue
        }

        console.log(`Processing HealthKit workout: ${workout.uuid}, type: ${workout.activityType}, duration: ${workout.duration}s`)

        // Calculate derived metrics
        const durationSeconds = Math.round(workout.duration || 0)
        const distanceMeters = workout.distance || 0
        const averagePace = distanceMeters > 0 && durationSeconds > 0 ? 
          (durationSeconds / 60) / (distanceMeters / 1000) : null

        // Insert into healthkit_activities using BioPeak standard structure
        const { error: insertError } = await supabase
          .from('healthkit_activities')
          .upsert({
            user_id: user.id,
            healthkit_uuid: workout.uuid,
            activity_type: workout.activityType,
            start_time: workout.startTime,
            end_time: workout.endTime,
            duration_seconds: durationSeconds,
            distance_meters: distanceMeters,
            active_calories: Math.round(workout.energy || 0),
            average_heart_rate: workout.averageHeartRate,
            max_heart_rate: workout.maxHeartRate,
            device_name: workout.device || 'Apple Watch',
            source_name: workout.sourceName || 'HealthKit',
            activity_date: new Date(workout.startTime).toISOString().split('T')[0],
            raw_data: {
              locations: workout.locations,
              series: workout.series,
              averagePace: averagePace
            }
          }, {
            onConflict: 'user_id,healthkit_uuid'
          })

        if (insertError) {
          errors.push(`Error inserting workout ${workout.uuid}: ${insertError.message}`)
          continue
        }

        console.log(`✓ Inserted HealthKit activity: ${workout.uuid}`)

        // Process GPS coordinates if available with BioPeak standard format
        if (workout.locations && workout.locations.length > 0) {
          // Convert to BioPeak standard: [latitude, longitude] format
          const rawCoordinates = workout.locations.map((loc: any) => [loc.latitude, loc.longitude])
          
          // Sample large datasets for performance
          const coordinates = sampleData(rawCoordinates, 5000)
          const boundingBox = calculateBoundingBox(coordinates)
          
          console.log(`HealthKit GPS: Processing ${workout.locations.length} points, sampled to ${coordinates.length}`)
          
          const { error: coordError } = await supabase
            .from('activity_coordinates')
            .upsert({
              user_id: user.id,
              activity_id: workout.uuid,
              activity_source: 'healthkit',
              coordinates: coordinates,
              total_points: workout.locations.length,
              sampled_points: coordinates.length,
              starting_latitude: workout.locations[0].latitude,
              starting_longitude: workout.locations[0].longitude,
              bounding_box: boundingBox
            }, {
              onConflict: 'user_id,activity_id,activity_source'
            })

          if (coordError) {
            errors.push(`Error inserting coordinates for ${workout.uuid}: ${coordError.message}`)
          }
        }

        // Process time series data with BioPeak standard format
        if (workout.series && (workout.series.heartRate || workout.series.energy)) {
          const seriesData = []
          let cumulativeDistance = 0
          
          // Get all unique timestamps and merge data
          const allTimestamps = new Set()
          
          if (workout.series.heartRate) {
            workout.series.heartRate.forEach((hr: any) => allTimestamps.add(hr.timestamp))
          }
          if (workout.series.energy) {
            workout.series.energy.forEach((energy: any) => allTimestamps.add(energy.timestamp))
          }
          
          const sortedTimestamps = Array.from(allTimestamps).sort()
          
          // Create standardized time series data
          sortedTimestamps.forEach((timestamp: any, index: number) => {
            const hrData = workout.series.heartRate?.find((hr: any) => hr.timestamp === timestamp)
            const energyData = workout.series.energy?.find((e: any) => e.timestamp === timestamp)
            
            // Calculate derived metrics
            const timeElapsed = index > 0 ? (timestamp - sortedTimestamps[0]) / 1000 : 0 // seconds
            const avgSpeed = workout.distance && timeElapsed > 0 ? workout.distance / timeElapsed : null
            const pace = avgSpeed ? calculatePace(avgSpeed) : null
            
            // Estimate cumulative distance
            if (avgSpeed && index > 0) {
              const intervalTime = (timestamp - sortedTimestamps[index - 1]) / 1000
              cumulativeDistance += avgSpeed * intervalTime
            }
            
            const dataPoint: any = {
              timestamp: Math.floor(timestamp / 1000), // Convert to Unix seconds (BioPeak standard)
              elapsed_time: timeElapsed
            }
            
            if (hrData) {
              dataPoint.heart_rate = hrData.value
            }
            
            if (energyData) {
              dataPoint.energy = energyData.value
            }
            
            if (pace) {
              dataPoint.pace_min_km = pace
            }
            
            if (avgSpeed) {
              dataPoint.speed_ms = avgSpeed
            }
            
            if (cumulativeDistance > 0) {
              dataPoint.distance_meters = cumulativeDistance
            }
            
            seriesData.push(dataPoint)
          })
          
          // Sample large datasets for performance
          const finalSeriesData = sampleData(seriesData, 5000)
          
          console.log(`HealthKit Series: Processing ${seriesData.length} points, sampled to ${finalSeriesData.length}`)
          
          // Calculate summary statistics for zones/stats
          const heartRates = finalSeriesData.filter(d => d.heart_rate).map(d => d.heart_rate)
          const paces = finalSeriesData.filter(d => d.pace_min_km).map(d => d.pace_min_km)
          
          const stats = {
            avg_heart_rate: heartRates.length > 0 ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) : null,
            max_heart_rate: heartRates.length > 0 ? Math.max(...heartRates) : null,
            avg_pace_min_km: paces.length > 0 ? paces.reduce((a, b) => a + b, 0) / paces.length : null,
            total_distance_meters: cumulativeDistance > 0 ? cumulativeDistance : workout.distance,
            duration_seconds: workout.duration
          }
          
          // Insert into activity_chart_cache with BioPeak standard structure
          if (finalSeriesData.length > 0) {
            const { error: chartError } = await supabase
              .from('activity_chart_cache')
              .upsert({
                user_id: user.id,
                activity_id: workout.uuid,
                activity_source: 'healthkit',
                series: finalSeriesData,
                stats: stats,
                build_status: 'ready',
                built_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,activity_id,activity_source'
              })

            if (chartError) {
              errors.push(`Error inserting chart data for ${workout.uuid}: ${chartError.message}`)
            }
          }
        }

        processedCount++
        
      } catch (error) {
        errors.push(`Error processing workout ${workout.uuid}: ${error.message}`)
      }
    }

    // Update sync status with detailed metrics
    const syncStatus = errors.length === 0 ? 'completed' : 
                      errors.length < workouts.length ? 'partial' : 'failed'
    
    console.log(`HealthKit Sync Summary: ${processedCount}/${workouts.length} processed, status: ${syncStatus}`)
    
    await supabase
      .from('healthkit_sync_status')
      .upsert({
        user_id: user.id,
        last_sync_at: new Date().toISOString(),
        sync_status: syncStatus,
        activities_synced: processedCount,
        total_activities: workouts.length,
        error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null, // Limit error message length
        sync_metadata: {
          has_gps_data: workouts.some(w => w.locations && w.locations.length > 0),
          has_heart_rate: workouts.some(w => w.series?.heartRate),
          has_energy_data: workouts.some(w => w.series?.energy),
          activity_types: [...new Set(workouts.map(w => w.activityType))],
          date_range: {
            earliest: workouts.reduce((min, w) => w.startTime < min ? w.startTime : min, workouts[0]?.startTime),
            latest: workouts.reduce((max, w) => w.startTime > max ? w.startTime : max, workouts[0]?.startTime)
          }
        }
      }, {
        onConflict: 'user_id'
      })

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total: workouts.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('HealthKit sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})