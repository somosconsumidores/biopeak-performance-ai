import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Parse GPX 1.1
    const parser = new DOMParser()
    const xml = parser.parseFromString(gpxText, 'application/xml')
    if (!xml || xml.querySelector('parsererror')) {
      return new Response(JSON.stringify({ error: 'Invalid GPX XML' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nameNode = xml.querySelector('gpx > trk > name') || xml.querySelector('trk > name')
    const activityName = nameInput || nameNode?.textContent || 'Atividade GPX'

    const trkpts = Array.from(xml.getElementsByTagName('trkpt'))
    if (trkpts.length < 2) {
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

    for (const el of trkpts) {
      const lat = parseFloat(el.getAttribute('lat') || '0')
      const lon = parseFloat(el.getAttribute('lon') || '0')
      const ele = el.getElementsByTagName('ele')?.[0]?.textContent ? parseFloat(el.getElementsByTagName('ele')[0].textContent as string) : undefined
      const timeStr = el.getElementsByTagName('time')?.[0]?.textContent || undefined

      // HR can be in gpxtpx:hr or hr (handle namespace too)
      let hr: number | undefined
      let hrNode = el.getElementsByTagName('gpxtpx:hr')[0] || el.getElementsByTagName('hr')[0]
      if (!hrNode && (el as any).getElementsByTagNameNS) {
        try {
          hrNode = (el as any).getElementsByTagNameNS('http://www.garmin.com/xmlschemas/TrackPointExtension/v1', 'hr')[0]
        } catch (_) {
          // ignore namespace lookup failures
        }
      }
      if (hrNode && hrNode.textContent) {
        const v = parseInt(hrNode.textContent)
        if (!isNaN(v)) {
          hr = v
          hrSum += v
          hrCount += 1
          if (v > hrMax) hrMax = v
        }
      }

      // Segment distance and elevation
      let dSeg = 0
      if (lastLat !== null && lastLon !== null) {
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

      lastLat = lat
      lastLon = lon
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
        name: activityName,
        activity_type: activityType || 'RUNNING',
        start_time: startTimeIso,
        duration_in_seconds: durationSec,
        distance_in_meters: Math.round(totalDistance),
        average_heart_rate: avgHr,
        max_heart_rate: hrMax || null,
        total_elevation_gain_in_meters: Math.round(totalGain),
        total_elevation_loss_in_meters: Math.round(totalLoss),
        average_speed_mps: avgSpeed,
        average_pace_min_km: avgPace,
      })
      .select('activity_id')
      .single()

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
    return new Response(JSON.stringify({ error: 'Internal server error', details: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})