import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { user_id } = body

    console.log(`[reprocess-healthkit-activities] Starting reprocessing${user_id ? ` for user ${user_id}` : ' for all users'}`)

    // Get all HealthKit activities that need reprocessing
    let query = supabase
      .from('healthkit_activities')
      .select('user_id, healthkit_uuid')
      .order('created_at', { ascending: true })

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    const { data: activities, error: fetchError } = await query
    if (fetchError) throw fetchError

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No HealthKit activities found to reprocess',
        processed: 0,
        errors: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`[reprocess-healthkit-activities] Found ${activities.length} HealthKit activities to process`)

    const errors: string[] = []
    let processed = 0

    // Process activities in batches to avoid overwhelming the system
    const batchSize = 10
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (activity) => {
        try {
          console.log(`[reprocess-healthkit-activities] Processing ${activity.healthkit_uuid} for user ${activity.user_id}`)
          
          // Call the calculate-activity-chart-data function
          const { error: calcError } = await supabase.functions.invoke('calculate-activity-chart-data', {
            body: {
              user_id: activity.user_id,
              activity_id: activity.healthkit_uuid,
              activity_source: 'healthkit',
              internal_call: true
            }
          })

          if (calcError) {
            console.error(`[reprocess-healthkit-activities] Error processing ${activity.healthkit_uuid}:`, calcError)
            errors.push(`${activity.healthkit_uuid}: ${calcError.message}`)
          } else {
            processed++
            console.log(`[reprocess-healthkit-activities] Successfully processed ${activity.healthkit_uuid}`)
          }
        } catch (error) {
          console.error(`[reprocess-healthkit-activities] Exception processing ${activity.healthkit_uuid}:`, error)
          errors.push(`${activity.healthkit_uuid}: ${error.message}`)
        }
      })

      // Wait for the current batch to complete
      await Promise.all(batchPromises)
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < activities.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log(`[reprocess-healthkit-activities] Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activities.length / batchSize)}. Processed: ${processed}, Errors: ${errors.length}`)
    }

    const result = {
      success: true,
      message: `Reprocessing completed. Processed ${processed}/${activities.length} activities.`,
      total_activities: activities.length,
      processed,
      errors: errors.length,
      error_details: errors.slice(0, 10) // Include first 10 errors for debugging
    }

    console.log(`[reprocess-healthkit-activities] Final result:`, result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[reprocess-healthkit-activities] Fatal error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      processed: 0,
      errors: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})