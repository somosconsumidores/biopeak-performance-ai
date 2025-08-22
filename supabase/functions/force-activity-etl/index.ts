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

    console.log('Force ETL processing for activity 20144806605')

    // Call the ETL function for the specific activity
    const { data: etlResult, error: etlError } = await supabase.functions.invoke('process-activity-data-etl', {
      body: { 
        user_id: 'a436be87-c299-4726-a658-f8c3a3587ed8',
        activity_id: '20144806605',
        activity_source: 'garmin'
      }
    })

    if (etlError) {
      console.error('ETL processing failed:', etlError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: etlError,
        step: 'ETL processing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('ETL processing completed:', etlResult)

    // Verify the results by checking each table
    const verificationResults = await Promise.allSettled([
      supabase.from('activity_chart_data')
        .select('data_points_count, created_at')
        .eq('user_id', 'a436be87-c299-4726-a658-f8c3a3587ed8')
        .eq('activity_id', '20144806605')
        .eq('activity_source', 'garmin'),
        
      supabase.from('activity_segments')
        .select('segment_number')
        .eq('user_id', 'a436be87-c299-4726-a658-f8c3a3587ed8')
        .eq('activity_id', '20144806605')
        .eq('activity_source', 'garmin'),
        
      supabase.from('activity_heart_rate_zones')
        .select('max_heart_rate, created_at')
        .eq('user_id', 'a436be87-c299-4726-a658-f8c3a3587ed8')
        .eq('activity_id', '20144806605')
        .eq('activity_source', 'garmin'),
        
      supabase.from('activity_coordinates')
        .select('total_points, created_at')
        .eq('user_id', 'a436be87-c299-4726-a658-f8c3a3587ed8')
        .eq('activity_id', '20144806605')
        .eq('activity_source', 'garmin'),
        
      supabase.from('activity_variation_analysis')
        .select('has_valid_data, created_at')
        .eq('user_id', 'a436be87-c299-4726-a658-f8c3a3587ed8')
        .eq('activity_id', '20144806605')
        .eq('activity_source', 'garmin')
    ])

    const results = {
      success: true,
      etl_result: etlResult,
      verification: {
        chart_data: verificationResults[0].status === 'fulfilled' ? verificationResults[0].value.data : null,
        segments: verificationResults[1].status === 'fulfilled' ? verificationResults[1].value.data : null,
        heart_rate_zones: verificationResults[2].status === 'fulfilled' ? verificationResults[2].value.data : null,
        coordinates: verificationResults[3].status === 'fulfilled' ? verificationResults[3].value.data : null,
        variation_analysis: verificationResults[4].status === 'fulfilled' ? verificationResults[4].value.data : null
      }
    }

    console.log('Verification results:', JSON.stringify(results, null, 2))

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Force ETL error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      step: 'General error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})