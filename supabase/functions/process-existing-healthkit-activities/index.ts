import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id } = await req.json()
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('🔄 Processing existing HealthKit activities for user:', user_id)

    // Get all healthkit activities for the user
    const { data: activities, error: fetchError } = await supabaseClient
      .from('healthkit_activities')
      .select('healthkit_uuid, user_id')
      .eq('user_id', user_id)

    if (fetchError) {
      console.error('Error fetching activities:', fetchError)
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log(`📊 Found ${activities?.length || 0} activities to process`)

    let processed = 0
    let errors = 0

    // Process each activity
    for (const activity of activities || []) {
      try {
        console.log(`📈 Processing activity: ${activity.healthkit_uuid}`)
        
        // Call the chart calculation function for each activity
        const { error: chartError } = await supabaseClient.functions.invoke(
          'calculate-activity-chart-data',
          {
            body: {
              user_id: activity.user_id,
              activity_id: activity.healthkit_uuid,
              activity_source: 'healthkit'
            }
          }
        )

        if (chartError) {
          console.error(`❌ Error processing activity ${activity.healthkit_uuid}:`, chartError)
          errors++
        } else {
          console.log(`✅ Successfully processed activity: ${activity.healthkit_uuid}`)
          processed++
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`❌ Exception processing activity ${activity.healthkit_uuid}:`, error)
        errors++
      }
    }

    console.log(`🏁 Processing completed. Processed: ${processed}, Errors: ${errors}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing completed. Processed: ${processed}, Errors: ${errors}`,
        processed,
        errors,
        total: activities?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})