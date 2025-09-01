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

    // Fixed activity that needs recalculation
    const activity_id = '2be3e94d-7220-4e9b-8c91-ce0025291435'
    const user_id = 'fa155754-46c5-4f12-99e2-54a9673ff74f'

    console.log(`🔄 Fixing GPX activity precision for: ${activity_id}`)

    // Delete existing chart data to force recreation with full precision
    const { error: delError } = await supabase
      .from('activity_chart_data')
      .delete()
      .eq('activity_id', activity_id)
      .eq('activity_source', 'strava_gpx')

    if (delError) {
      console.error('Error deleting existing chart data:', delError)
    } else {
      console.log('✅ Deleted existing chart data')
    }

    // Delete existing segments to force recreation
    const { error: segError } = await supabase
      .from('activity_best_segments')
      .delete()
      .eq('activity_id', activity_id)

    if (segError) {
      console.error('Error deleting existing segments:', segError)
    } else {
      console.log('✅ Deleted existing best segments')
    }

    // Recalculate activity chart data with full precision
    const { data: chartResult, error: chartError } = await supabase.functions.invoke('calculate-activity-chart-data', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
        full_precision: true,
        internal_call: true,
      },
    })

    if (chartError) {
      console.error('❌ Error recalculating chart data:', chartError)
      throw new Error(`Chart calculation failed: ${chartError.message}`)
    }

    console.log('✅ Chart data recalculated with full precision:', chartResult)

    // Wait a bit for the chart data to be available
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Recalculate best 1km segments
    const { data: segmentsResult, error: segmentsError } = await supabase.functions.invoke('calculate-best-1km-segments', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
      },
    })

    if (segmentsError) {
      console.error('❌ Error recalculating segments:', segmentsError)
    } else {
      console.log('✅ Best segments recalculated:', segmentsResult)
    }

    // Verify the fix by checking the new data
    const { data: newChartData } = await supabase
      .from('activity_chart_data')
      .select('data_points_count, duration_seconds, total_distance_meters')
      .eq('activity_id', activity_id)
      .single()

    const { data: segmentCount } = await supabase
      .from('activity_best_segments')
      .select('id')
      .eq('activity_id', activity_id)

    console.log('📊 New data summary:', {
      data_points: newChartData?.data_points_count,
      duration_seconds: newChartData?.duration_seconds,
      total_distance_meters: newChartData?.total_distance_meters,
      segment_count: segmentCount?.length || 0
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'GPX activity precision fixed successfully',
      activity_id,
      before: {
        data_points: 2000,
        duration_seconds: 1999,
        segments: 6
      },
      after: {
        data_points: newChartData?.data_points_count,
        duration_seconds: newChartData?.duration_seconds,
        total_distance_meters: newChartData?.total_distance_meters,
        segment_count: segmentCount?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error fixing GPX activity precision:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to fix GPX activity precision', 
      details: (error as any)?.message ?? String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})