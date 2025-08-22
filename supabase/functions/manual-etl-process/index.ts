import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { user_id, activity_id, activity_source } = await req.json()
    
    console.log(`Manual ETL processing for activity ${activity_id} (${activity_source}) for user ${user_id}`)

    // Call the existing ETL function
    const { data, error } = await supabase.functions.invoke('process-activity-data-etl', {
      body: { user_id, activity_id, activity_source }
    })

    if (error) {
      console.error('ETL processing error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify the processed data exists
    const [chartData, segments, hrZones, coordinates, variation] = await Promise.all([
      supabase.from('activity_chart_data')
        .select('data_points_count')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)
        .eq('activity_source', activity_source)
        .single(),
      
      supabase.from('activity_segments')
        .select('segment_number')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)
        .eq('activity_source', activity_source),
        
      supabase.from('activity_heart_rate_zones')
        .select('max_heart_rate')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)
        .eq('activity_source', activity_source)
        .single(),
        
      supabase.from('activity_coordinates')
        .select('total_points')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)
        .eq('activity_source', activity_source)
        .single(),
        
      supabase.from('activity_variation_analysis')
        .select('has_valid_data')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)
        .eq('activity_source', activity_source)
        .single()
    ])

    const result = {
      success: true,
      etl_response: data,
      processed_data: {
        chart_data: chartData.data,
        segments: segments.data?.length || 0,
        heart_rate_zones: hrZones.data,
        coordinates: coordinates.data,
        variation_analysis: variation.data
      }
    }

    console.log('Manual ETL processing completed successfully:', result)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Manual ETL error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})