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

    // Garmin activities
    const { data: garminActivities } = await supabase
      .from('garmin_activity_details')
      .select('user_id, activity_id')
      .limit(1000)

    if (garminActivities) {
      const uniqueGarmin = new Set()
      garminActivities.forEach(activity => {
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
    }

    // Polar activities
    const { data: polarActivities } = await supabase
      .from('polar_activity_details')
      .select('user_id, activity_id')
      .limit(1000)

    if (polarActivities) {
      const uniquePolar = new Set()
      polarActivities.forEach(activity => {
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
    }

    // Strava activities
    const { data: stravaActivities } = await supabase
      .from('strava_activity_details')
      .select('user_id, strava_activity_id')
      .limit(1000)

    if (stravaActivities) {
      const uniqueStrava = new Set()
      stravaActivities.forEach(activity => {
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
    }

    // Strava GPX activities
    const { data: stravaGpxActivities } = await supabase
      .from('strava_gpx_activity_details')
      .select('user_id, activity_id')
      .limit(1000)

    if (stravaGpxActivities) {
      const uniqueStravaGpx = new Set()
      stravaGpxActivities.forEach(activity => {
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
    }

    // Zepp GPX activities
    const { data: zeppGpxActivities } = await supabase
      .from('zepp_gpx_activity_details')
      .select('user_id, activity_id')
      .limit(1000)

    if (zeppGpxActivities) {
      const uniqueZeppGpx = new Set()
      zeppGpxActivities.forEach(activity => {
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