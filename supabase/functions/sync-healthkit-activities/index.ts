import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        // Insert into healthkit_activities using existing table structure
        const { error: insertError } = await supabase
          .from('healthkit_activities')
          .upsert({
            user_id: user.id,
            healthkit_uuid: workout.uuid,
            activity_type: workout.activityType,
            start_time: workout.startTime,
            end_time: workout.endTime,
            duration_seconds: Math.round(workout.duration || 0),
            distance_meters: workout.distance || 0,
            active_calories: Math.round(workout.energy || 0),
            average_heart_rate: workout.averageHeartRate,
            max_heart_rate: workout.maxHeartRate,
            device_name: workout.device || 'Apple Watch',
            source_name: workout.sourceName || 'HealthKit',
            activity_date: new Date(workout.startTime).toISOString().split('T')[0],
            raw_data: {
              locations: workout.locations,
              series: workout.series
            }
          }, {
            onConflict: 'user_id,healthkit_uuid'
          })

        if (insertError) {
          errors.push(`Error inserting workout ${workout.uuid}: ${insertError.message}`)
          continue
        }

        // Process GPS coordinates if available
        if (workout.locations && workout.locations.length > 0) {
          const coordinates = workout.locations.map((loc: any) => [loc.longitude, loc.latitude])
          
          const { error: coordError } = await supabase
            .from('activity_coordinates')
            .upsert({
              user_id: user.id,
              activity_id: workout.uuid,
              activity_source: 'healthkit',
              coordinates: coordinates,
              total_points: workout.locations.length,
              sampled_points: workout.locations.length,
              starting_latitude: workout.locations[0].latitude,
              starting_longitude: workout.locations[0].longitude
            }, {
              onConflict: 'user_id,activity_id,activity_source'
            })

          if (coordError) {
            errors.push(`Error inserting coordinates for ${workout.uuid}: ${coordError.message}`)
          }
        }

        // Process time series data for chart cache
        if (workout.series && (workout.series.heartRate || workout.series.energy)) {
          const seriesData = []
          
          // Process heart rate data
          if (workout.series.heartRate) {
            for (const hr of workout.series.heartRate) {
              seriesData.push({
                timestamp: hr.timestamp,
                heart_rate: hr.value,
                type: 'heart_rate'
              })
            }
          }

          // Process energy data
          if (workout.series.energy) {
            for (const energy of workout.series.energy) {
              seriesData.push({
                timestamp: energy.timestamp,
                energy: energy.value,
                type: 'energy'
              })
            }
          }

          // Insert into activity_chart_cache
          if (seriesData.length > 0) {
            const { error: chartError } = await supabase
              .from('activity_chart_cache')
              .upsert({
                user_id: user.id,
                activity_id: workout.uuid,
                activity_source: 'healthkit',
                series: seriesData,
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

    // Update sync status
    await supabase
      .from('healthkit_sync_status')
      .upsert({
        user_id: user.id,
        last_sync_at: new Date().toISOString(),
        sync_status: errors.length > 0 ? 'partial' : 'completed',
        activities_synced: processedCount,
        total_activities: workouts.length,
        error_message: errors.length > 0 ? errors.join('; ') : null
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