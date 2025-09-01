import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.3.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const { activity_id, user_id } = body

    if (!activity_id || !user_id) {
      return new Response(JSON.stringify({ error: 'activity_id and user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`🔧 Repairing GPX activity: ${activity_id} for user: ${user_id}`)

    // Get activity summary to find GPX file path
    const { data: activity, error: activityError } = await service
      .from('strava_gpx_activities')
      .select('file_path, activity_id')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .single()

    if (activityError || !activity) {
      console.error('Activity not found:', activityError)
      return new Response(JSON.stringify({ error: 'Activity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`📂 Found activity with file_path: ${activity.file_path}`)

    // Download GPX from Storage
    const { data: gpxBlob, error: downloadError } = await service.storage
      .from('gpx')
      .download(activity.file_path)

    if (downloadError || !gpxBlob) {
      console.error('Failed to download GPX:', downloadError)
      return new Response(JSON.stringify({ error: 'Failed to download GPX file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gpxText = await gpxBlob.text()
    console.log(`📊 GPX file size: ${gpxText.length} chars`)

    // Parse GPX to regenerate all trackpoints
    const fxp = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    let gpxObj: any
    try {
      gpxObj = fxp.parse(gpxText)
    } catch (e) {
      console.error('GPX parse error:', e)
      return new Response(JSON.stringify({ error: 'Invalid GPX' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gpxRoot = gpxObj?.gpx ?? gpxObj
    const trk = Array.isArray(gpxRoot?.trk) ? gpxRoot.trk[0] : gpxRoot?.trk
    const trksegs = trk?.trkseg ? (Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg]) : []
    const trkptsArr: any[] = trksegs.flatMap((seg: any) => {
      const pts = seg?.trkpt ? (Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt]) : []
      return pts
    })

    console.log(`📍 Found ${trkptsArr.length} trackpoints in GPX`)

    if (trkptsArr.length < 2) {
      return new Response(JSON.stringify({ error: 'GPX has insufficient trackpoints' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete existing truncated details
    const { error: deleteError } = await service
      .from('strava_gpx_activity_details')
      .delete()
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)

    if (deleteError) {
      console.error('Failed to delete existing details:', deleteError)
    } else {
      console.log('✅ Deleted existing truncated activity details')
    }

    // Rebuild all trackpoint details with full precision
    type Sample = { lat: number, lon: number, ele?: number, time?: string, hr?: number, dist?: number }
    const samples: Sample[] = []

    let totalDistance = 0
    let lastLat: number | null = null
    let lastLon: number | null = null

    for (const el of trkptsArr) {
      const lat = parseFloat(String(el.lat ?? el.latitude ?? el.attributes?.lat ?? 0))
      const lon = parseFloat(String(el.lon ?? el.longitude ?? el.attributes?.lon ?? 0))
      const eleVal = (el.ele ?? el.elevation ?? el['ele'])
      const ele = typeof eleVal !== 'undefined' ? parseFloat(String(eleVal)) : undefined
      const timeStr: string | undefined = (el.time ?? el.timestamp ?? el['time']) || undefined

      // HR from extensions
      let hr: number | undefined
      const extensions = (el.extensions ?? el.extension ?? {}) as any
      const tpx = (extensions['gpxtpx:TrackPointExtension'] ?? extensions['TrackPointExtension'] ?? el['gpxtpx:TrackPointExtension'] ?? {}) as any
      let hrRaw: any = (tpx?.['gpxtpx:hr'] ?? tpx?.hr ?? el['gpxtpx:hr'] ?? el.hr)
      if (Array.isArray(hrRaw)) hrRaw = hrRaw[0]
      if (hrRaw !== undefined && hrRaw !== null) {
        const v = parseInt(String(hrRaw))
        if (!isNaN(v)) hr = v
      }

      // Calculate cumulative distance
      if (lastLat !== null && lastLon !== null && !isNaN(lat) && !isNaN(lon)) {
        const dSeg = haversineDistance(lastLat, lastLon, lat, lon)
        totalDistance += dSeg
      }

      samples.push({ lat, lon, ele, time: timeStr, hr, dist: totalDistance })

      lastLat = isNaN(lat) ? lastLat : lat
      lastLon = isNaN(lon) ? lastLon : lon
    }

    console.log(`🔄 Rebuilding ${samples.length} trackpoint details`)

    // Insert all trackpoints in batches (no triggers = no interruption)
    const detailRows = samples.map((s) => ({
      user_id,
      activity_id,
      sample_timestamp: s.time ?? null,
      latitude_in_degree: s.lat,
      longitude_in_degree: s.lon,
      elevation_in_meters: s.ele ?? null,
      heart_rate: s.hr ?? null,
      total_distance_in_meters: s.dist ?? null,
      speed_meters_per_second: null, // Will be calculated in chart processing
    }))

    for (let i = 0; i < detailRows.length; i += 1000) {
      const chunk = detailRows.slice(i, i + 1000)
      const { error: insertError } = await service
        .from('strava_gpx_activity_details')
        .insert(chunk)

      if (insertError) {
        console.error(`Failed to insert chunk ${i}-${i + chunk.length}:`, insertError)
        return new Response(JSON.stringify({ error: 'Failed to rebuild trackpoints' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    console.log(`✅ Inserted ${detailRows.length} trackpoint details`)

    // Delete existing chart data and segments to force recreation
    await Promise.all([
      service.from('activity_chart_data').delete().eq('activity_id', activity_id).eq('activity_source', 'strava_gpx'),
      service.from('activity_best_segments').delete().eq('activity_id', activity_id)
    ])

    console.log('✅ Cleared existing chart data and segments')

    // Rebuild chart data with full precision
    const { data: chartResult, error: chartError } = await service.functions.invoke('calculate-activity-chart-data', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
        full_precision: true,
        internal_call: true,
      },
    })

    if (chartError) {
      console.error('Chart rebuild failed:', chartError)
    } else {
      console.log('✅ Chart data rebuilt with full precision')
    }

    // Rebuild best 1km segments
    const { data: segmentsResult, error: segmentsError } = await service.functions.invoke('calculate-best-1km-segments', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
      },
    })

    if (segmentsError) {
      console.error('Segments rebuild failed:', segmentsError)
    } else {
      console.log('✅ Best segments rebuilt')
    }

    // Recalculate variation analysis
    const { data: statsResult, error: statsError } = await service.functions.invoke('calculate-statistics-metrics', {
      body: {
        activity_id,
        user_id,
        activity_source: 'strava_gpx',
      },
    })

    if (statsError) {
      console.error('Stats rebuild failed:', statsError)
    } else {
      console.log('✅ Statistics rebuilt')
    }

    // Verify results
    const { data: newChartData } = await service
      .from('activity_chart_data')
      .select('data_points_count, total_distance_meters, duration_seconds')
      .eq('activity_id', activity_id)
      .eq('activity_source', 'strava_gpx')
      .single()

    const { data: segmentCount } = await service
      .from('activity_best_segments')
      .select('id')
      .eq('activity_id', activity_id)

    console.log('📊 Repair results:', {
      original_trackpoints: trkptsArr.length,
      rebuilt_details: detailRows.length,
      chart_data_points: newChartData?.data_points_count,
      chart_distance_m: newChartData?.total_distance_meters,
      km_segments: segmentCount?.length || 0
    })

    return new Response(JSON.stringify({
      success: true,
      activity_id,
      repair_summary: {
        original_trackpoints: trkptsArr.length,
        rebuilt_details: detailRows.length,
        chart_data_points: newChartData?.data_points_count,
        chart_distance_meters: newChartData?.total_distance_meters,
        km_segments: segmentCount?.length || 0
      },
      results: {
        chart_data: chartResult,
        segments: segmentsResult,
        statistics: statsResult,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Repair failed:', error)
    return new Response(JSON.stringify({ 
      error: 'Repair failed', 
      details: (error as any)?.message ?? String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})