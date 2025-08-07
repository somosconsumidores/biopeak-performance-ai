import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityPoint {
  lat: number;
  lon: number;
  time: number; // Unix timestamp
  distance: number; // Total distance in meters
}

function haversine(coord1: [number, number], coord2: [number, number]): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;

  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

function getBestMovingSegment(points: ActivityPoint[], segmentDistance = 1000) {
  let bestPace = Infinity;
  let bestSegment = null;

  for (let start = 0; start < points.length; start++) {
    let totalDistance = 0;
    const segmentStart = points[start];
    let segmentEnd = null;

    for (let end = start + 1; end < points.length; end++) {
      const p1 = points[end - 1];
      const p2 = points[end];
      totalDistance += haversine([p1.lat, p1.lon], [p2.lat, p2.lon]);

      if (totalDistance >= segmentDistance) {
        segmentEnd = points[end];
        break;
      }
    }

    if (segmentEnd) {
      const durationSec = segmentEnd.time - segmentStart.time;
      const pace = (durationSec / 60) / (segmentDistance / 1000); // min/km

      if (pace < bestPace && pace > 0) {
        bestPace = pace;
        bestSegment = {
          startTime: segmentStart.time,
          endTime: segmentEnd.time,
          startDistance: segmentStart.distance,
          endDistance: segmentEnd.distance,
          durationSec: durationSec,
          paceMinPerKm: pace
        };
      }
    }
  }

  if (!bestSegment) return null;

  return {
    ...bestSegment,
    paceMinPerKm: Number(bestSegment.paceMinPerKm.toFixed(2)),
    durationSec: Number(bestSegment.durationSec.toFixed(2))
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { activity_id, user_id } = await req.json()
    
    if (!activity_id || !user_id) {
      throw new Error('Missing required parameters: activity_id and user_id')
    }

    console.log('🔄 Calculating best 1km segment for activity:', activity_id, 'user:', user_id)

    // Get activity basic info
    const { data: activity, error: activityError } = await supabase
      .from('garmin_activities')
      .select('activity_date, distance_in_meters')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .single()

    if (activityError) {
      console.error('❌ Activity not found:', activityError)
      throw new Error(`Activity not found: ${activityError.message}`)
    }

    // Skip if activity is less than 1km
    if (!activity.distance_in_meters || activity.distance_in_meters < 1000) {
      console.log('⏭️ Skipping activity - less than 1km distance')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Activity skipped - less than 1km distance',
          best_segment: null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Get activity details with GPS data
    const { data: activityDetails, error: detailsError } = await supabase
      .from('garmin_activity_details')
      .select('samples, latitude_in_degree, longitude_in_degree, start_time_in_seconds, total_distance_in_meters')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .order('start_time_in_seconds', { ascending: true })

    if (detailsError || !activityDetails?.length) {
      console.error('❌ Activity details not found:', detailsError)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Activity details not found - cannot calculate segment',
          best_segment: null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log(`📊 Found ${activityDetails.length} activity detail records`)

    // Extract and process GPS points from each detail record
    const allPoints: ActivityPoint[] = []
    
    for (const detail of activityDetails) {
      let gpsPoint = null
      
      // Try to get data from samples object (most common format)
      if (detail.samples && typeof detail.samples === 'object') {
        const sample = detail.samples
        if (sample.latitudeInDegree != null && sample.longitudeInDegree != null && 
            sample.startTimeInSeconds != null && sample.totalDistanceInMeters != null) {
          gpsPoint = {
            lat: Number(sample.latitudeInDegree),
            lon: Number(sample.longitudeInDegree),
            time: Number(sample.startTimeInSeconds),
            distance: Number(sample.totalDistanceInMeters)
          }
        }
      }
      
      // Fallback to direct columns if samples don't work
      if (!gpsPoint && detail.latitude_in_degree != null && detail.longitude_in_degree != null && 
          detail.start_time_in_seconds != null && detail.total_distance_in_meters != null) {
        gpsPoint = {
          lat: Number(detail.latitude_in_degree),
          lon: Number(detail.longitude_in_degree),
          time: Number(detail.start_time_in_seconds),
          distance: Number(detail.total_distance_in_meters)
        }
      }
      
      // Validate the GPS point
      if (gpsPoint && 
          !isNaN(gpsPoint.lat) && !isNaN(gpsPoint.lon) && 
          !isNaN(gpsPoint.time) && !isNaN(gpsPoint.distance) &&
          Math.abs(gpsPoint.lat) <= 90 && Math.abs(gpsPoint.lon) <= 180) {
        allPoints.push(gpsPoint)
      }
    }

    console.log(`📍 Extracted ${allPoints.length} valid GPS points`)

    if (allPoints.length < 10) {
      console.log('⚠️ Insufficient GPS data - need at least 10 points for analysis')
      return new Response(
        JSON.stringify({
          success: true,
          message: `Insufficient GPS data for 1km segment analysis - only ${allPoints.length} valid points found`,
          best_segment: null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Sort points by time to ensure correct order
    allPoints.sort((a, b) => a.time - b.time)
    
    console.log(`📊 Processing ${allPoints.length} GPS points for 1km segment analysis`)
    console.log(`🏃 Distance range: ${allPoints[0]?.distance?.toFixed(2)}m to ${allPoints[allPoints.length-1]?.distance?.toFixed(2)}m`)
    console.log(`⏰ Time range: ${Math.round((allPoints[allPoints.length-1]?.time - allPoints[0]?.time) / 60)} minutes`)

    // Calculate best 1km segment
    const bestSegment = getBestMovingSegment(allPoints, 1000)

    if (!bestSegment) {
      console.log('⚠️ No valid 1km segment found')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No valid 1km segment found in the activity data',
          best_segment: null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Save to database
    const { data: savedSegment, error: saveError } = await supabase
      .from('activity_best_segments')
      .upsert({
        user_id,
        activity_id,
        activity_date: activity.activity_date,
        best_1km_pace_min_km: bestSegment.paceMinPerKm,
        segment_start_distance_meters: bestSegment.startDistance,
        segment_end_distance_meters: bestSegment.endDistance,
        segment_duration_seconds: bestSegment.durationSec
      }, {
        onConflict: 'user_id,activity_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (saveError) {
      console.error('❌ Error saving best segment:', saveError)
      throw new Error(`Failed to save segment: ${saveError.message}`)
    }

    console.log('✅ Best 1km segment calculated and saved successfully')
    console.log(`🏃 Best pace: ${bestSegment.paceMinPerKm} min/km`)

    return new Response(
      JSON.stringify({
        success: true,
        best_segment: savedSegment,
        message: `Best 1km pace: ${bestSegment.paceMinPerKm} min/km`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Error in calculate-best-1km-segments:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})