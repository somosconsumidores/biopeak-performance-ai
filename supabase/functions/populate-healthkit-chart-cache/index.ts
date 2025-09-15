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

    console.log('🏥 Populating HealthKit chart cache for user:', user_id)

    // Get all healthkit activities for the user that don't have chart cache
    const { data: activities, error: fetchError } = await supabaseClient
      .from('healthkit_activities')
      .select(`
        healthkit_uuid,
        user_id,
        duration_seconds,
        distance_meters,
        average_heart_rate,
        max_heart_rate,
        pace_min_per_km,
        active_calories,
        activity_type,
        start_time
      `)
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

    console.log(`📊 Found ${activities?.length || 0} HealthKit activities`)

    let inserted = 0
    let skipped = 0

    // Create chart cache entries
    for (const activity of activities || []) {
      try {
        // Check if chart cache already exists
        const { data: existing } = await supabaseClient
          .from('activity_chart_cache')
          .select('id')
          .eq('user_id', activity.user_id)
          .eq('activity_id', activity.healthkit_uuid)
          .eq('activity_source', 'healthkit')
          .single()

        if (existing) {
          skipped++
          continue
        }

        // Create basic stats object
        const stats = {
          duration_seconds: activity.duration_seconds,
          distance_meters: activity.distance_meters,
          avg_heart_rate: activity.average_heart_rate,
          max_heart_rate: activity.max_heart_rate,
          pace_min_km: activity.pace_min_per_km,
          calories: activity.active_calories,
          activity_type: activity.activity_type,
          source: 'healthkit'
        }

        // Insert chart cache entry
        const { error: insertError } = await supabaseClient
          .from('activity_chart_cache')
          .insert({
            user_id: activity.user_id,
            activity_id: activity.healthkit_uuid,
            activity_source: 'healthkit',
            series: [],
            stats: stats,
            build_status: 'ready',
            built_at: new Date().toISOString()
          })

        if (insertError) {
          console.error(`❌ Error inserting chart cache for ${activity.healthkit_uuid}:`, insertError)
        } else {
          console.log(`✅ Created chart cache for activity: ${activity.healthkit_uuid}`)
          inserted++
        }

      } catch (error) {
        console.error(`❌ Exception processing activity ${activity.healthkit_uuid}:`, error)
      }
    }

    console.log(`🏁 Chart cache population completed. Inserted: ${inserted}, Skipped: ${skipped}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Chart cache population completed. Inserted: ${inserted}, Skipped: ${skipped}`,
        inserted,
        skipped,
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