import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const filePath = body?.file_path as string | undefined
    const activityType = body?.activity_type as string | undefined
    const nameInput = body?.name as string | undefined

    console.log('[import-strava-gpx] request', { userId: user.id, filePath, activityType, hasName: !!nameInput });
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'file_path is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download GPX from Storage
    const { data: gpxBlob, error: downloadError } = await service.storage.from('gpx').download(filePath)
    if (downloadError || !gpxBlob) {
      return new Response(JSON.stringify({ error: 'Failed to download GPX file', details: downloadError?.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gpxText = await gpxBlob.text()
    console.log('[import-strava-gpx] downloaded GPX', { bytes: (gpxBlob as any).size ?? gpxText.length });
    // Parse GPX 1.1 using fast-xml-parser (DOMParser not available in Edge runtime)
    const fxp = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    let gpxObj: any
    try {
      gpxObj = fxp.parse(gpxText)
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Invalid GPX XML' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gpxRoot = gpxObj?.gpx ?? gpxObj
    const trk = Array.isArray(gpxRoot?.trk) ? gpxRoot.trk[0] : gpxRoot?.trk
    const activityName = nameInput || trk?.name || 'Atividade GPX'

    const trksegs = trk?.trkseg
      ? (Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg])
      : []

    const trkptsArr: any[] = trksegs.flatMap((seg: any) => {
      const pts = seg?.trkpt
        ? (Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt])
        : []
      return pts
    })

    console.log('[import-strava-gpx] parsed trkpts', { count: trkptsArr.length });
    if (trkptsArr.length < 2) {
      return new Response(JSON.stringify({ error: 'GPX must contain at least 2 track points' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    type Sample = { lat: number, lon: number, ele?: number, time?: string, hr?: number, dist?: number, speed?: number }
    const samples: Sample[] = []

    let totalDistance = 0
    let totalGain = 0
    let totalLoss = 0
    let lastLat: number | null = null
    let lastLon: number | null = null
    let lastEle: number | null = null
    let minTime: number | null = null
    let maxTime: number | null = null
    let lastTs: number | null = null
    let hrSum = 0
    let hrCount = 0
    let hrMax = 0

    for (const el of trkptsArr) {
      const lat = parseFloat(String(el.lat ?? el.latitude ?? el.attributes?.lat ?? 0))
      const lon = parseFloat(String(el.lon ?? el.longitude ?? el.attributes?.lon ?? 0))
      const eleVal = (el.ele ?? el.elevation ?? el['ele'])
      const ele = typeof eleVal !== 'undefined' ? parseFloat(String(eleVal)) : undefined
      const timeStr: string | undefined = (el.time ?? el.timestamp ?? el['time']) || undefined

      // HR from Garmin TrackPointExtension or plain hr
      let hr: number | undefined
      const extensions = (el.extensions ?? el.extension ?? {}) as any
      const tpx = (extensions['gpxtpx:TrackPointExtension'] ?? extensions['TrackPointExtension'] ?? el['gpxtpx:TrackPointExtension'] ?? {}) as any
      let hrRaw: any = (tpx?.['gpxtpx:hr'] ?? tpx?.hr ?? el['gpxtpx:hr'] ?? el.hr)
      if (Array.isArray(hrRaw)) hrRaw = hrRaw[0]
      if (hrRaw !== undefined && hrRaw !== null) {
        const v = parseInt(String(hrRaw))
        if (!isNaN(v)) {
          hr = v
          hrSum += v
          hrCount += 1
          if (v > hrMax) hrMax = v
        }
      }

      // Segment distance and elevation
      let dSeg = 0
      if (lastLat !== null && lastLon !== null && !isNaN(lat) && !isNaN(lon)) {
        dSeg = haversineDistance(lastLat, lastLon, lat, lon)
        totalDistance += dSeg
      }
      if (ele !== undefined && lastEle !== null) {
        const delta = ele - lastEle
        if (delta > 0) totalGain += delta
        else totalLoss += Math.abs(delta)
      }

      // Time bounds
      let ts: number | null = null
      if (timeStr) {
        const parsed = new Date(timeStr).getTime()
        if (!isNaN(parsed)) {
          ts = parsed
          if (minTime === null || parsed < minTime) minTime = parsed
          if (maxTime === null || parsed > maxTime) maxTime = parsed
        }
      }

      // Save sample with cumulative distance
      samples.push({ lat, lon, ele, time: timeStr || undefined, hr, dist: totalDistance })

      lastLat = isNaN(lat) ? lastLat : lat
      lastLon = isNaN(lon) ? lastLon : lon
      if (ele !== undefined) lastEle = ele
      lastTs = ts ?? lastTs
    }

    const durationSec = maxTime && minTime ? Math.max(1, Math.round((maxTime - minTime) / 1000)) : null
    const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : null
    const avgSpeed = durationSec && totalDistance > 0 ? totalDistance / durationSec : null
    const avgPace = avgSpeed && avgSpeed > 0 ? (1000 / avgSpeed) / 60 : null // min/km

    const startTimeIso = minTime ? new Date(minTime).toISOString() : null
    const endTimeIso = maxTime ? new Date(maxTime).toISOString() : null

    // Insert summary
    const activityId = crypto.randomUUID()
    const { data: summaryInsert, error: summaryError } = await service
      .from('strava_gpx_activities')
      .insert({
        user_id: user.id,
        activity_id: activityId,
        source: 'STRAVA_GPX',
        name: activityName,
        activity_type: activityType || 'RUNNING',
        start_time: startTimeIso,
        end_time: endTimeIso,
        duration_in_seconds: durationSec,
        distance_in_meters: Math.round(totalDistance),
        average_heart_rate: avgHr,
        max_heart_rate: hrMax || null,
        total_elevation_gain_in_meters: Math.round(totalGain),
        total_elevation_loss_in_meters: Math.round(totalLoss),
        average_speed_in_meters_per_second: avgSpeed,
        average_pace_in_minutes_per_kilometer: avgPace,
        file_path: filePath,
      })
      .select('activity_id')
      .single()

    console.log('[import-strava-gpx] summary saved', { activity_id: activityId });

    if (summaryError || !summaryInsert) {
      return new Response(JSON.stringify({ error: 'Failed to save summary', details: summaryError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert details (trackpoints)
    const detailRows = samples.map((s) => ({
      user_id: user.id,
      activity_id: summaryInsert.activity_id,
      sample_timestamp: s.time ?? null,
      latitude_in_degree: s.lat,
      longitude_in_degree: s.lon,
      elevation_in_meters: s.ele ?? null,
      heart_rate: s.hr ?? null,
      total_distance_in_meters: s.dist ?? null,
      speed_meters_per_second: s.speed ?? null,
    }))

    // Batch insert to avoid payload limits
    for (let i = 0; i < detailRows.length; i += 1000) {
      const chunk = detailRows.slice(i, i + 1000)
      const { error: detErr } = await service
        .from('strava_gpx_activity_details')
        .insert(chunk)
      if (detErr) {
        return new Response(JSON.stringify({ error: 'Failed to save details', details: detErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    console.log('[import-strava-gpx] details inserted', { rows: detailRows.length });

    // Calculate statistics metrics
    try {
      await service.functions.invoke('calculate-statistics-metrics', {
        body: {
          activity_id: summaryInsert.activity_id,
          user_id: user.id,
          source_activity: 'Strava GPX'
        }
      });
    } catch (statsError) {
      console.error('Error calculating statistics metrics:', statsError);
      // Don't fail the main operation if stats calculation fails
    }

    // Trigger ETL to precompute optimized tables for frontend consumption
    try {
      const etl = await service.functions.invoke('process-activity-data-etl', {
        body: {
          user_id: user.id,
          activity_id: summaryInsert.activity_id,
          activity_source: 'strava_gpx'
        }
      });
      if (etl.error || etl.data?.success === false) {
        console.error('[import-strava-gpx] ETL error:', etl.error || etl.data);
      } else {
        console.log('[import-strava-gpx] ETL triggered for activity', summaryInsert.activity_id);
      }
    } catch (e) {
      console.error('[import-strava-gpx] Failed to trigger ETL:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      activity_id: summaryInsert.activity_id,
      metrics: {
        duration_in_seconds: durationSec,
        distance_in_meters: Math.round(totalDistance),
        average_heart_rate: avgHr,
        max_heart_rate: hrMax || null,
        elevation_gain_m: Math.round(totalGain),
        elevation_loss_m: Math.round(totalLoss),
        average_speed_ms: avgSpeed,
        average_pace_min_km: avgPace
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[import-strava-gpx] error', error)
    return new Response(JSON.stringify({ error: 'Internal server error', details: (error as any)?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})