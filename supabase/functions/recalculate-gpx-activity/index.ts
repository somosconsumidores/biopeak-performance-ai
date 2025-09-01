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

    const body = await req.json()
    const { activity_id, user_id } = body

    if (!activity_id || !user_id) {
      return new Response(JSON.stringify({ error: 'activity_id and user_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`🔄 Recalculating GPX activity: ${activity_id}`)

    // Delete existing chart data to force recreation
    const { error: delError } = await supabase
      .from('activity_chart_data')
      .delete()
      .eq('activity_id', activity_id)
      .eq('activity_source', 'strava_gpx')

    if (delError) {
      console.error('Error deleting existing chart data:', delError)
    }

    // Delete existing segments to force recreation
    const { error: segError } = await supabase
      .from('activity_best_segments')
      .delete()
      .eq('activity_id', activity_id)

    if (segError) {
      console.error('Error deleting existing segments:', segError)
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
      console.error('Error recalculating chart data:', chartError)
      return new Response(JSON.stringify({ error: 'Failed to recalculate chart data', details: chartError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('✅ Chart data recalculated:', chartResult)

    // Recalculate best 1km segments
    const { data: segmentsResult, error: segmentsError } = await supabase.functions.invoke('calculate-best-1km-segments', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
      },
    })

    if (segmentsError) {
      console.error('Error recalculating segments:', segmentsError)
    } else {
      console.log('✅ Best segments recalculated:', segmentsResult)
    }

    // Recalculate statistics metrics
    const { data: statsResult, error: statsError } = await supabase.functions.invoke('calculate-statistics-metrics', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
      },
    })

    if (statsError) {
      console.error('Error recalculating statistics:', statsError)
    } else {
      console.log('✅ Statistics recalculated:', statsResult)
    }

    return new Response(JSON.stringify({
      success: true,
      activity_id,
      results: {
        chart_data: chartResult,
        segments: segmentsResult,
        statistics: statsResult,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error recalculating GPX activity:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: (error as any)?.message ?? String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})