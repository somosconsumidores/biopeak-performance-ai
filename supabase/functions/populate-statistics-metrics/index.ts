import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityRecord {
  user_id: string
  activity_id: string | number // Allow both string and number for different sources
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

    console.log('🚀 Starting statistics metrics population for Strava activities...')

    // Fetch all unique Strava activities that have details
    const activities: ActivityRecord[] = []

    // Get unique Strava activities that have details using DISTINCT
    console.log('📊 Fetching unique Strava activities with details...')
    const { data: stravaActivities, error: stravaError } = await supabase
      .rpc('get_unique_strava_activities_with_details')

    if (stravaError) {
      console.error('❌ Error fetching Strava activities:', stravaError)
      throw new Error(`Failed to fetch Strava activities: ${stravaError.message}`)
    }

    if (stravaActivities && stravaActivities.length > 0) {
      stravaActivities.forEach(activity => {
        activities.push({
          user_id: activity.user_id,
          activity_id: activity.strava_activity_id, // Keep as number for Strava
          source_activity: 'strava'
        })
      })
      console.log(`✅ Found ${stravaActivities.length} unique Strava activities with details`)
    } else {
      console.log('ℹ️ No Strava activities with details found')
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
          console.log(`🔄 Processing ${activity.source_activity} activity ${activity.activity_id} for user ${activity.user_id}`)
          
          const { data, error } = await supabase.functions.invoke('calculate-statistics-metrics', {
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

          if (data && !data.success) {
            console.error(`❌ Calculate function returned error for ${activity.source_activity} activity ${activity.activity_id}:`, data.error)
            return { success: false, error: data.error }
          }

          console.log(`✅ Successfully processed ${activity.source_activity} activity ${activity.activity_id}`)
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