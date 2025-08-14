import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityRecord {
  user_id: string
  activity_id: string
  source_activity: string
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

    console.log('🚀 Starting statistics metrics population...')

    // Fetch all unique activities from all detail tables
    const activities: ActivityRecord[] = []

    // Process all tables in parallel to avoid timeout issues
    const [garminResult, polarResult, stravaResult, stravaGpxResult, zeppGpxResult] = await Promise.allSettled([
      // Garmin activities
      supabase
        .from('garmin_activity_details')
        .select('user_id, activity_id')
        .order('created_at', { ascending: false }),
      
      // Polar activities  
      supabase
        .from('polar_activity_details')
        .select('user_id, activity_id')
        .order('created_at', { ascending: false }),
      
      // Strava activities - correct column name
      supabase
        .from('strava_activity_details')
        .select('user_id, strava_activity_id')
        .order('created_at', { ascending: false }),
      
      // Strava GPX activities
      supabase
        .from('strava_gpx_activity_details')
        .select('user_id, activity_id')
        .order('created_at', { ascending: false }),
      
      // Zepp GPX activities
      supabase
        .from('zepp_gpx_activity_details')
        .select('user_id, activity_id')
        .order('created_at', { ascending: false })
    ])

    // Process Garmin activities
    if (garminResult.status === 'fulfilled' && garminResult.value.data) {
      const uniqueGarmin = new Set()
      garminResult.value.data.forEach(activity => {
        const key = `${activity.user_id}-${activity.activity_id}`
        if (!uniqueGarmin.has(key)) {
          uniqueGarmin.add(key)
          activities.push({
            user_id: activity.user_id,
            activity_id: activity.activity_id,
            source_activity: 'garmin'
          })
        }
      })
      console.log(`✅ Found ${garminResult.value.data.length} Garmin activities`)
    } else if (garminResult.status === 'rejected') {
      console.error('❌ Error fetching Garmin activities:', garminResult.reason)
    }

    // Process Polar activities
    if (polarResult.status === 'fulfilled' && polarResult.value.data) {
      const uniquePolar = new Set()
      polarResult.value.data.forEach(activity => {
        const key = `${activity.user_id}-${activity.activity_id}`
        if (!uniquePolar.has(key)) {
          uniquePolar.add(key)
          activities.push({
            user_id: activity.user_id,
            activity_id: activity.activity_id,
            source_activity: 'polar'
          })
        }
      })
      console.log(`✅ Found ${polarResult.value.data.length} Polar activities`)
    } else if (polarResult.status === 'rejected') {
      console.error('❌ Error fetching Polar activities:', polarResult.reason)
    }

    // Process Strava activities
    if (stravaResult.status === 'fulfilled' && stravaResult.value.data) {
      const uniqueStrava = new Set()
      stravaResult.value.data.forEach(activity => {
        const key = `${activity.user_id}-${activity.strava_activity_id}`
        if (!uniqueStrava.has(key)) {
          uniqueStrava.add(key)
          activities.push({
            user_id: activity.user_id,
            activity_id: activity.strava_activity_id,
            source_activity: 'strava'
          })
        }
      })
      console.log(`✅ Found ${stravaResult.value.data.length} Strava activities`)
    } else if (stravaResult.status === 'rejected') {
      console.error('❌ Error fetching Strava activities:', stravaResult.reason)
    }

    // Process Strava GPX activities
    if (stravaGpxResult.status === 'fulfilled' && stravaGpxResult.value.data) {
      const uniqueStravaGpx = new Set()
      stravaGpxResult.value.data.forEach(activity => {
        const key = `${activity.user_id}-${activity.activity_id}`
        if (!uniqueStravaGpx.has(key)) {
          uniqueStravaGpx.add(key)
          activities.push({
            user_id: activity.user_id,
            activity_id: activity.activity_id,
            source_activity: 'strava gpx'
          })
        }
      })
      console.log(`✅ Found ${stravaGpxResult.value.data.length} Strava GPX activities`)
    } else if (stravaGpxResult.status === 'rejected') {
      console.error('❌ Error fetching Strava GPX activities:', stravaGpxResult.reason)
    }

    // Process Zepp GPX activities
    if (zeppGpxResult.status === 'fulfilled' && zeppGpxResult.value.data) {
      const uniqueZeppGpx = new Set()
      zeppGpxResult.value.data.forEach(activity => {
        const key = `${activity.user_id}-${activity.activity_id}`
        if (!uniqueZeppGpx.has(key)) {
          uniqueZeppGpx.add(key)
          activities.push({
            user_id: activity.user_id,
            activity_id: activity.activity_id,
            source_activity: 'zepp gpx'
          })
        }
      })
      console.log(`✅ Found ${zeppGpxResult.value.data.length} Zepp GPX activities`)
    } else if (zeppGpxResult.status === 'rejected') {
      console.error('❌ Error fetching Zepp GPX activities:', zeppGpxResult.reason)
    }

    console.log(`📊 Found ${activities.length} unique activities to process`)

    // Check which activities already have statistics
    const existingStats = new Set()
    const { data: existing } = await supabase
      .from('statistics_metrics')
      .select('user_id, activity_id, source_activity')

    if (existing) {
      existing.forEach(stat => {
        existingStats.add(`${stat.user_id}-${stat.activity_id}-${stat.source_activity}`)
      })
    }

    // Filter out activities that already have statistics
    const toProcess = activities.filter(activity => {
      const key = `${activity.user_id}-${activity.activity_id}-${activity.source_activity}`
      return !existingStats.has(key)
    })

    console.log(`⚡ Processing ${toProcess.length} new activities (${activities.length - toProcess.length} already processed)`)

    // Process in batches of 10
    const batchSize = 10
    let processed = 0
    let errors = 0

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize)
      
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toProcess.length / batchSize)} (${batch.length} activities)`)

      // Process batch in parallel
      const promises = batch.map(async (activity) => {
        try {
          const { error } = await supabase.functions.invoke('calculate-statistics-metrics', {
            body: {
              activity_id: activity.activity_id,
              user_id: activity.user_id,
              source_activity: activity.source_activity
            }
          })

          if (error) {
            console.error(`❌ Error processing ${activity.source_activity} activity ${activity.activity_id}:`, error)
            return { success: false, error }
          }

          return { success: true }
        } catch (err) {
          console.error(`❌ Exception processing ${activity.source_activity} activity ${activity.activity_id}:`, err)
          return { success: false, error: err }
        }
      })

      const results = await Promise.all(promises)
      
      const batchProcessed = results.filter(r => r.success).length
      const batchErrors = results.filter(r => !r.success).length
      
      processed += batchProcessed
      errors += batchErrors

      console.log(`✅ Batch completed: ${batchProcessed} success, ${batchErrors} errors`)
      
      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`🎉 Population completed! Processed: ${processed}, Errors: ${errors}, Total: ${toProcess.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Statistics metrics population completed',
        stats: {
          total_activities_found: activities.length,
          already_processed: activities.length - toProcess.length,
          newly_processed: processed,
          errors: errors,
          total_processed: toProcess.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error in populate-statistics-metrics:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})