import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Source = 'garmin' | 'strava' | 'polar' | 'strava_gpx' | 'zepp_gpx' | 'healthkit' | 'biopeak_app'

interface CalcBody {
  user_id?: string
  activity_id: string
  activity_source: Source
  internal_call?: boolean
  full_precision?: boolean
}

function paceFromSpeed(speed?: number | null): number | null {
  if (!speed || speed <= 0) return null
  return 1000 / (speed * 60) // min/km
}

function safeAvg(nums: (number | null | undefined)[]): number | null {
  const arr = nums.filter((n): n is number => typeof n === 'number' && isFinite(n))
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// LTTB downsampling for large datasets
function lttbDownsample(data: any[], threshold: number): any[] {
  if (data.length <= threshold || threshold <= 2) return data;

  const sampled: any[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  
  sampled.push(data[0]);
  
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    
    let avgX = 0, avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
      avgX += j;
      avgY += data[j].pace_min_km || data[j].hr || 0;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;
    
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    
    const pointA = sampled[sampled.length - 1];
    const pointAX = sampled.length - 1;
    const pointAY = pointA.pace_min_km || pointA.hr || 0;
    
    let maxArea = -1;
    let maxAreaPoint: any = data[rangeOffs];
    
    for (let j = rangeOffs; j < rangeTo && j < data.length; j++) {
      const pointY = data[j].pace_min_km || data[j].hr || 0;
      const area = Math.abs((pointAX - avgX) * (pointY - pointAY) - (pointAX - j) * (avgY - pointAY));
      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = data[j];
      }
    }
    
    sampled.push(maxAreaPoint);
  }
  
  sampled.push(data[data.length - 1]);
  
  return sampled;
}

// Fetch all rows in pages to bypass the 1000-row default limit
async function fetchAllPaged<T = any>(client: any, table: string, select: string, filters: Record<string, any>, order?: { column: string; ascending: boolean }, pageSize = 1000): Promise<T[]> {
  let from = 0;
  const all: T[] = [];
  while (true) {
    let q = client.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v as any);
    }
    if (order) q = q.order(order.column, { ascending: order.ascending });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
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

    const body = (await req.json()) as CalcBody
    const { user_id, activity_id, activity_source, full_precision } = body

    if (!activity_id || !activity_source) {
      return new Response(JSON.stringify({ error: 'activity_id and activity_source are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve user_id if not provided using multiple fallbacks
    async function resolveUserId(): Promise<string> {
      const provided = (user_id && typeof user_id === 'string' && user_id.trim().length > 0) ? user_id.trim() : null
      if (provided) return provided

      // 1) Try unified all_activities first (covers most sources reliably)
      {
        const { data, error } = await supabase
          .from('all_activities')
          .select('user_id')
          .eq('activity_source', activity_source)
          .eq('activity_id', activity_id)
          .limit(1)
        if (!error && data && data.length > 0 && data[0]?.user_id) return data[0].user_id
      }

      // 2) Try details tables per source
      let query
      switch (activity_source) {
        case 'garmin':
          query = supabase.from('garmin_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'strava':
          query = supabase.from('strava_activity_details').select('user_id').eq('strava_activity_id', Number(activity_id)).limit(1)
          break
        case 'polar':
          query = supabase.from('polar_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'strava_gpx':
          query = supabase.from('strava_gpx_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'zepp_gpx':
          query = supabase.from('zepp_gpx_activity_details').select('user_id').eq('activity_id', activity_id).limit(1)
          break
        case 'healthkit':
          query = supabase.from('healthkit_activities').select('user_id').eq('healthkit_uuid', activity_id).limit(1)
          break
      }
      if (query) {
        const { data, error } = await query
        if (!error && data && data.length > 0 && data[0]?.user_id) return data[0].user_id
      }

      // 3) Try summary tables as a final fallback
      const summaryLookups: Array<{ table: string; column: string; value: any }> = []
      if (activity_source === 'garmin') summaryLookups.push({ table: 'garmin_activities', column: 'activity_id', value: activity_id })
      if (activity_source === 'polar') summaryLookups.push({ table: 'polar_activities', column: 'activity_id', value: activity_id })
      if (activity_source === 'strava') summaryLookups.push({ table: 'strava_activities', column: 'strava_activity_id', value: Number(activity_id) })
      if (activity_source === 'healthkit') summaryLookups.push({ table: 'healthkit_activities', column: 'healthkit_uuid', value: activity_id })
      if (activity_source === 'biopeak_app') summaryLookups.push({ table: 'training_sessions', column: 'id', value: activity_id })
      for (const s of summaryLookups) {
        const { data, error } = await supabase.from(s.table).select('user_id').eq(s.column, s.value).limit(1)
        if (!error && data && data.length > 0 && data[0]?.user_id) return data[0].user_id
      }

      throw new Error(`Unable to resolve user_id for activity ${activity_source}:${activity_id}`)
    }

    const uid = await resolveUserId()

    // Fetch samples per source (paged to get ALL points)
    let rows: any[] = []
    if (activity_source === 'garmin') {
      rows = await fetchAllPaged(
        supabase,
        'garmin_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, timer_duration_in_seconds, moving_duration_in_seconds, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'strava') {
      rows = await fetchAllPaged(
        supabase,
        'strava_activity_details',
        'time_seconds, distance, heartrate, velocity_smooth',
        { user_id: uid, strava_activity_id: Number(activity_id) },
        { column: 'time_seconds', ascending: true }
      )
    } else if (activity_source === 'polar') {
      rows = await fetchAllPaged(
        supabase,
        'polar_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, duration_in_seconds, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'strava_gpx') {
      rows = await fetchAllPaged(
        supabase,
        'strava_gpx_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'zepp_gpx') {
      rows = await fetchAllPaged(
        supabase,
        'zepp_gpx_activity_details',
        'sample_timestamp, total_distance_in_meters, heart_rate, speed_meters_per_second, duration_in_seconds, latitude_in_degree, longitude_in_degree',
        { user_id: uid, activity_id },
        { column: 'sample_timestamp', ascending: true }
      )
    } else if (activity_source === 'healthkit') {
      // HealthKit data structure is different - stored in healthkit_activities with raw_data JSONB
      const { data: healthkitActivity, error } = await supabase
        .from('healthkit_activities')
        .select('raw_data, start_time, duration_seconds, distance_meters, average_heart_rate, max_heart_rate')
        .eq('user_id', uid)
        .eq('healthkit_uuid', activity_id)
        .maybeSingle()
      
      if (error) throw error
      if (!healthkitActivity?.raw_data?.series) {
        return new Response(JSON.stringify({ success: false, message: 'No HealthKit series data found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Extract data from HealthKit series
      const heartRateData = healthkitActivity.raw_data.series.heartRate || []
      const energyData = healthkitActivity.raw_data.series.energy || []
      const distanceData = healthkitActivity.raw_data.series.distances || healthkitActivity.raw_data.distances || []
      const locationSamples = healthkitActivity.raw_data.locationSamples || healthkitActivity.raw_data.locations || []
      
      // Use energy data as primary temporal base (usually more data points)
      const primaryData = energyData.length > 0 ? energyData : heartRateData
      const activityStartTime = new Date(healthkitActivity.start_time).getTime() / 1000
      const totalDistance = healthkitActivity.distance_meters || 0
      const totalDuration = healthkitActivity.duration_seconds || 1
      
      if (primaryData.length === 0 && distanceData.length === 0 && locationSamples.length === 0) {
        return new Response(JSON.stringify({ success: false, message: 'No HealthKit temporal data found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Helper function to interpolate heart rate data to match primary timestamps
      const interpolateHeartRate = (targetTimestamp: number): number | null => {
        if (heartRateData.length === 0) return null
        
        const targetTime = new Date(targetTimestamp * 1000)
        let closest = heartRateData[0]
        let minDiff = Math.abs(new Date(closest.timestamp).getTime() - targetTime.getTime())
        
        for (const hr of heartRateData) {
          const diff = Math.abs(new Date(hr.timestamp).getTime() - targetTime.getTime())
          if (diff < minDiff) {
            minDiff = diff
            closest = hr
          }
        }
        
        // Only use if within 30 seconds
        return minDiff <= 30000 ? closest.value : null
      }

      // Check if we have actual distance samples from HealthKit
      const hasDistanceData = distanceData.length > 0
      const hasGpsData = locationSamples.length > 1
      
      console.log(`[HealthKit] Activity ${activity_id}: distanceData=${distanceData.length}, gpsData=${locationSamples.length}, energyData=${energyData.length}, hrData=${heartRateData.length}`)
      
      // Calculate average speed from total distance/duration (the reliable source)
      const avgSpeed = totalDuration > 0 ? totalDistance / totalDuration : 0
      
      if (hasDistanceData) {
        // CASE 1: Use actual distance samples for accurate pace calculation
        console.log(`[HealthKit] Using ${distanceData.length} distance samples for pace calculation`)
        
        let cumulativeDistance = 0
        rows = distanceData.map((distPoint: any, index: number) => {
          const timestamp = new Date(distPoint.timestamp || distPoint.startDate).getTime() / 1000
          const relativeTime = timestamp - activityStartTime
          
          // Handle cumulative vs incremental distance values
          const distValue = distPoint.value ?? distPoint.quantity ?? 0
          
          // If values look incremental (each is small), accumulate them
          // If values look cumulative (monotonically increasing), use directly
          if (index === 0 || distValue < cumulativeDistance) {
            cumulativeDistance += distValue
          } else {
            cumulativeDistance = distValue
          }
          
          // Calculate instantaneous speed from consecutive distance points
          let speed = avgSpeed
          if (index > 0) {
            const prevDist = rows[index - 1]?.total_distance_in_meters ?? 0
            const prevTime = rows[index - 1]?.sample_timestamp ?? activityStartTime
            const deltaD = cumulativeDistance - prevDist
            const deltaT = timestamp - prevTime
            if (deltaT > 0 && deltaD >= 0) {
              speed = deltaD / deltaT
              // Sanity check: speed should be reasonable (between 0.5 and 10 m/s for running)
              if (speed < 0.5 || speed > 10) speed = avgSpeed
            }
          }
          
          return {
            sample_timestamp: timestamp,
            timer_duration_in_seconds: relativeTime,
            heart_rate: interpolateHeartRate(timestamp),
            total_distance_in_meters: cumulativeDistance,
            speed_meters_per_second: speed,
          }
        }).filter((row: any) => row.sample_timestamp && row.timer_duration_in_seconds >= 0)
        
      } else if (hasGpsData) {
        // CASE 2: Calculate speed from GPS coordinates using Haversine formula
        console.log(`[HealthKit] Using ${locationSamples.length} GPS points for pace calculation`)
        
        const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
          const R = 6371000 // Earth radius in meters
          const toRad = (deg: number) => deg * Math.PI / 180
          const dLat = toRad(lat2 - lat1)
          const dLon = toRad(lon2 - lon1)
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLon/2) * Math.sin(dLon/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          return R * c
        }
        
        let cumulativeDistance = 0
        rows = locationSamples.map((loc: any, index: number) => {
          const timestamp = new Date(loc.timestamp).getTime() / 1000
          const relativeTime = timestamp - activityStartTime
          const lat = loc.latitude ?? loc.lat
          const lon = loc.longitude ?? loc.lon ?? loc.lng
          
          let speed = avgSpeed
          if (index > 0) {
            const prevLoc = locationSamples[index - 1]
            const prevLat = prevLoc.latitude ?? prevLoc.lat
            const prevLon = prevLoc.longitude ?? prevLoc.lon ?? prevLoc.lng
            const prevTimestamp = new Date(prevLoc.timestamp).getTime() / 1000
            
            const deltaD = haversineDistance(prevLat, prevLon, lat, lon)
            const deltaT = timestamp - prevTimestamp
            
            cumulativeDistance += deltaD
            
            if (deltaT > 0 && deltaD >= 0) {
              speed = deltaD / deltaT
              // Sanity check
              if (speed < 0.3 || speed > 12) speed = avgSpeed
            }
          }
          
          return {
            sample_timestamp: timestamp,
            timer_duration_in_seconds: relativeTime,
            heart_rate: interpolateHeartRate(timestamp),
            total_distance_in_meters: cumulativeDistance,
            speed_meters_per_second: speed,
            latitude_in_degree: lat,
            longitude_in_degree: lon,
          }
        }).filter((row: any) => row.sample_timestamp && row.timer_duration_in_seconds >= 0)
        
        // Scale cumulative distance to match reported total (GPS can be noisy)
        if (cumulativeDistance > 0 && totalDistance > 0) {
          const scaleFactor = totalDistance / cumulativeDistance
          rows = rows.map((row: any) => ({
            ...row,
            total_distance_in_meters: row.total_distance_in_meters * scaleFactor
          }))
        }
        
      } else {
        // CASE 3: No distance/GPS data - use LINEAR INTERPOLATION with average speed
        // This is the correct approach when we only have energy/HR data
        console.log(`[HealthKit] No distance/GPS data. Using linear interpolation with avgSpeed=${avgSpeed.toFixed(3)} m/s (pace: ${paceFromSpeed(avgSpeed)?.toFixed(2)} min/km)`)
        
        rows = primaryData.map((point: any, index: number) => {
          const timestamp = new Date(point.timestamp).getTime() / 1000
          const relativeTime = timestamp - activityStartTime
          
          // Linear interpolation of distance based on time progress
          const progressRatio = Math.min(1, Math.max(0, relativeTime / totalDuration))
          const interpolatedDistance = totalDistance * progressRatio
          
          // Get heart rate - either from energy data's interpolation or direct HR value
          let heartRate: number | null = null
          if (energyData.length > 0) {
            heartRate = interpolateHeartRate(timestamp)
          } else if (heartRateData.length > 0 && point.value) {
            heartRate = point.value
          }
          
          return {
            sample_timestamp: timestamp,
            timer_duration_in_seconds: relativeTime,
            heart_rate: heartRate,
            total_distance_in_meters: interpolatedDistance,
            speed_meters_per_second: avgSpeed, // Constant average speed
          }
        }).filter((row: any) => row.sample_timestamp && row.timer_duration_in_seconds >= 0)
      }
      
      // If we have very few points from distance/GPS, supplement with heart rate data
      if (rows.length < 20 && heartRateData.length > rows.length) {
        console.log(`[HealthKit] Supplementing ${rows.length} points with ${heartRateData.length} HR data points`)
        
        const additionalRows = heartRateData.map((hr: any) => {
          const timestamp = new Date(hr.timestamp).getTime() / 1000
          const relativeTime = timestamp - activityStartTime
          
          if (relativeTime < 0 || relativeTime > totalDuration) return null
          
          // Check if we already have a point close to this timestamp
          const hasNearbyPoint = rows.some((r: any) => Math.abs(r.sample_timestamp - timestamp) < 5)
          if (hasNearbyPoint) return null
          
          // Linear interpolation for distance
          const progressRatio = Math.min(1, relativeTime / totalDuration)
          const interpolatedDistance = totalDistance * progressRatio
          
          return {
            sample_timestamp: timestamp,
            timer_duration_in_seconds: relativeTime,
            heart_rate: hr.value,
            total_distance_in_meters: interpolatedDistance,
            speed_meters_per_second: avgSpeed,
          }
        }).filter(Boolean)
        
        // Merge and sort by time
        rows = [...rows, ...additionalRows].sort((a: any, b: any) => a.sample_timestamp - b.sample_timestamp)
      }
      
      console.log(`[HealthKit] Final row count: ${rows.length}, totalDistance: ${totalDistance}m, avgSpeed: ${avgSpeed.toFixed(3)} m/s`)
    } else if (activity_source === 'biopeak_app') {
      // Fetch performance snapshots for BioPeak App activities
      const { data: snapshots, error } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('session_id', activity_id)
        .order('snapshot_at_duration_seconds', { ascending: true })
      
      if (error) throw error
      
      if (!snapshots || snapshots.length === 0) {
        return new Response(JSON.stringify({ success: false, message: 'No BioPeak performance snapshots found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Transform snapshots into normalized format
      rows = snapshots.map(s => ({
        sample_timestamp: new Date(s.snapshot_time).getTime() / 1000,
        timer_duration_in_seconds: s.snapshot_at_duration_seconds,
        total_distance_in_meters: s.snapshot_at_distance_meters,
        speed_meters_per_second: s.current_speed_ms,
        heart_rate: s.current_heart_rate,
        latitude_in_degree: s.latitude,
        longitude_in_degree: s.longitude
      }))
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No detail rows found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build normalized series
    type SeriesPoint = { time_s: number; distance_m: number | null; hr: number | null; speed_ms: number | null; pace_min_km: number | null }
    let series: SeriesPoint[] = []

    const toEpochSeconds = (v: any): number | null => {
      if (v == null) return null
      if (typeof v === 'number' && isFinite(v)) return v > 1e10 ? v / 1000 : v // ms or s
      if (typeof v === 'string') {
        const ms = new Date(v).getTime()
        return isFinite(ms) ? ms / 1000 : null
      }
      if (v instanceof Date) {
        const ms = v.getTime()
        return isFinite(ms) ? ms / 1000 : null
      }
      return null
    }

    const baseTsSec = toEpochSeconds(rows[0]?.sample_timestamp)

    let timeS = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]

      // Prefer explicit time fields when available
      const t =
        r.time_seconds ??
        r.duration_in_seconds ??
        r.timer_duration_in_seconds ??
        r.moving_duration_in_seconds ??
        null

      if (typeof t === 'number' && isFinite(t)) {
        timeS = t
      } else {
        // For GPX-like sources, use real timestamps when present (prevents inflated speeds)
        const tsSec = toEpochSeconds(r.sample_timestamp)
        if (tsSec != null && baseTsSec != null) {
          timeS = Math.max(0, tsSec - baseTsSec)
        } else {
          timeS = i // fallback to index as seconds
        }
      }

      const speed = r.speed_meters_per_second ?? r.velocity_smooth ?? null
      const hr = r.heart_rate ?? r.heartrate ?? null
      const dist = r.total_distance_in_meters ?? r.distance ?? null

      series.push({
        time_s: timeS,
        distance_m: typeof dist === 'number' ? dist : null,
        hr: typeof hr === 'number' ? hr : null,
        speed_ms: typeof speed === 'number' ? speed : null,
        pace_min_km: paceFromSpeed(typeof speed === 'number' ? speed : null),
      })
    }

    // Fill missing per-point speed/pace using distance/time deltas (important for GPX sources)
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1]
      const cur = series[i]
      const dt = (cur.time_s ?? 0) - (prev.time_s ?? 0)
      if ((!cur.speed_ms || cur.speed_ms <= 0) && typeof cur.distance_m === 'number' && typeof prev.distance_m === 'number' && dt > 0) {
        const dd = cur.distance_m - prev.distance_m
        if (dd >= 0) {
          const sp = dd / dt
          cur.speed_ms = sp
          cur.pace_min_km = paceFromSpeed(sp)
        }
      }
      // If pace exists but speed missing, derive speed
      if ((cur.pace_min_km && cur.pace_min_km > 0) && (!cur.speed_ms || cur.speed_ms <= 0)) {
        cur.speed_ms = 1000 / (cur.pace_min_km * 60)
      }
      // If speed exists but pace missing, derive pace
      if ((cur.speed_ms && cur.speed_ms > 0) && (!cur.pace_min_km || cur.pace_min_km <= 0)) {
        cur.pace_min_km = paceFromSpeed(cur.speed_ms)
      }
    }

    // Derive stats
    const duration_seconds = Math.max(...series.map(s => s.time_s || 0))
    const total_distance_meters = (() => {
      const vals = series.map(s => s.distance_m).filter((v): v is number => typeof v === 'number')
      if (vals.length > 0) return Math.max(...vals)
      // fallback: estimate from speeds (assume 1s sampling)
      const sum = series.map(s => s.speed_ms || 0).reduce((a, b) => a + b, 0)
      return sum
    })()

    const avg_speed_ms = (() => {
      const v = safeAvg(series.map(s => s.speed_ms))
      if (v == null || v <= 0) {
        if (duration_seconds > 0 && total_distance_meters && total_distance_meters > 0) {
          return total_distance_meters / duration_seconds
        }
        return null
      }
      return v
    })()

    const avg_pace_min_km = (() => {
      if (avg_speed_ms && avg_speed_ms > 0) return paceFromSpeed(avg_speed_ms)
      if (duration_seconds > 0 && total_distance_meters && total_distance_meters > 0) {
        return (duration_seconds / 60) / (total_distance_meters / 1000)
      }
      return null
    })()

    const avg_heart_rate = (() => {
      const v = safeAvg(series.map(s => s.hr))
      return v == null ? null : Math.round(v)
    })()
    const max_heart_rate = (() => {
      const vals = series.map(s => s.hr).filter((v): v is number => typeof v === 'number')
      return vals.length ? Math.max(...vals) : null
    })()

    // Apply full precision logic
    if (full_precision !== true && series.length > 2000) {
      // Default sampling: keep every Nth point to stay around 2000 points
      const step = Math.ceil(series.length / 2000);
      const sampled: SeriesPoint[] = [];
      for (let i = 0; i < series.length; i += step) {
        sampled.push(series[i]);
      }
      // Always include last point
      if (sampled[sampled.length - 1] !== series[series.length - 1]) {
        sampled.push(series[series.length - 1]);
      }
      series = sampled;
    } else if (full_precision === true && series.length > 10000) {
      // Safety net: if too many points even with full precision, apply LTTB
      console.warn(`[calculate-activity-chart-data] Large dataset (${series.length} points), applying LTTB to 5000 points`);
      series = lttbDownsample(series, 5000);
    }

    const data_points_count = series.length

    // Upsert (manual upsert to avoid relying on unique constraint)
    const { data: existing, error: selErr } = await supabase
      .from('activity_chart_data')
      .select('id')
      .eq('user_id', uid)
      .eq('activity_source', activity_source)
      .eq('activity_id', activity_id)
      .maybeSingle()
    if (selErr) throw selErr

    const payload = {
      user_id: uid,
      activity_id,
      activity_source,
      series_data: series,
      data_points_count,
      duration_seconds: duration_seconds || null,
      total_distance_meters: total_distance_meters || null,
      avg_speed_ms: avg_speed_ms || null,
      avg_pace_min_km: avg_pace_min_km || null,
      avg_heart_rate: avg_heart_rate || null,
      max_heart_rate: max_heart_rate || null,
    }

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('activity_chart_data')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updErr) throw updErr
    } else {
      const { error: insErr } = await supabase
        .from('activity_chart_data')
        .insert(payload)
      if (insErr) throw insErr
    }

    // Build and upsert GPS coordinates when available
    const coordPairs = rows
      .map((r: any) => {
        const lat = r.latitude_in_degree ?? r.latitude ?? null
        const lon = r.longitude_in_degree ?? r.longitude ?? null
        return (typeof lat === 'number' && isFinite(lat) && typeof lon === 'number' && isFinite(lon))
          ? [lat, lon] as [number, number]
          : null
      })
      .filter((p: any): p is [number, number] => Array.isArray(p))

    if (coordPairs.length > 0) {
      const total_points = coordPairs.length
      // Downsample coordinates to ~2000 points if needed
      let sampled = coordPairs
      if (coordPairs.length > 2000) {
        const step = Math.ceil(coordPairs.length / 2000)
        sampled = []
        for (let i = 0; i < coordPairs.length; i += step) sampled.push(coordPairs[i])
        if (sampled[sampled.length - 1] !== coordPairs[coordPairs.length - 1]) sampled.push(coordPairs[coordPairs.length - 1])
      }

      const lats = sampled.map(c => c[0])
      const lons = sampled.map(c => c[1])
      const bounds: [[number, number],[number, number]] = [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      ]

      // Upsert into activity_coordinates (handles race conditions and avoids missing columns)
      const coordPayload = {
        user_id: uid,
        activity_id,
        activity_source,
        coordinates: sampled,
        total_points,
        sampled_points: sampled.length,
        starting_latitude: sampled[0]?.[0] ?? null,
        starting_longitude: sampled[0]?.[1] ?? null,
        bounding_box: bounds,
      }

      const { error: upsertCoordErr } = await supabase
        .from('activity_coordinates')
        .upsert(coordPayload, { onConflict: 'user_id,activity_source,activity_id' })
      if (upsertCoordErr) throw upsertCoordErr
      
    }

    // Automatically invoke additional analytics functions for complete analysis
    console.log(`[calculate-activity-chart-data] Invoking additional analytics for ${activity_source}:${activity_id}`)
    
    try {
      // Calculate best 1km segments
      const segmentsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-best-1km-segments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({
          activity_id,
          user_id: uid,
          activity_source
        })
      })
      
      if (!segmentsResponse.ok) {
        console.warn(`[calculate-activity-chart-data] Failed to calculate best segments: ${segmentsResponse.status}`)
      } else {
        console.log(`[calculate-activity-chart-data] ✅ Best 1km segments calculated`)
      }
    } catch (segErr) {
      console.warn(`[calculate-activity-chart-data] Error invoking best segments:`, segErr)
    }
    
    try {
      // Calculate statistics metrics
      const statsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-statistics-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({
          activity_id,
          user_id: uid,
          activity_source
        })
      })
      
      if (!statsResponse.ok) {
        console.warn(`[calculate-activity-chart-data] Failed to calculate statistics: ${statsResponse.status}`)
      } else {
        console.log(`[calculate-activity-chart-data] ✅ Statistics metrics calculated`)
      }
    } catch (statsErr) {
      console.warn(`[calculate-activity-chart-data] Error invoking statistics:`, statsErr)
    }

    return new Response(
      JSON.stringify({ success: true, user_id: uid, activity_id, activity_source, points: series.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (e) {
    console.error('[calculate-activity-chart-data] error', e)
    return new Response(JSON.stringify({ success: false, error: (e as any)?.message || String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
