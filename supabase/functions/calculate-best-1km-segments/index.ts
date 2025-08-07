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
  console.log(`📊 Processing ${points.length} GPS points for best 1km segment`);
  
  if (points.length < 10) {
    console.log('❌ Insufficient GPS points for analysis (need at least 10 points)');
    return null;
  }

  // Sort points by time to ensure correct order
  points.sort((a, b) => a.time - b.time);
  
  let bestSegment = null;
  let bestPace = Infinity;
  let segmentsAnalyzed = 0;
  let validSegmentsFound = 0;

  // Improved tolerance - much stricter for 1km accuracy (±1%)
  const minDistance = segmentDistance * 0.99; // 990m minimum
  const maxDistance = segmentDistance * 1.01; // 1010m maximum
  
  console.log(`🔍 Searching for best ${segmentDistance}m segment (${minDistance.toFixed(0)}m-${maxDistance.toFixed(0)}m tolerance)`);
  console.log(`📍 Data range: ${points[0]?.distance?.toFixed(0)}m to ${points[points.length-1]?.distance?.toFixed(0)}m`);

  // Multiple analysis approaches
  const segments = [];
  
  // Approach 1: Optimized sliding window with stricter tolerance
  for (let i = 0; i < points.length - 1; i++) {
    const startPoint = points[i];
    
    if (!startPoint.distance || !startPoint.time) continue;
    
    // Binary search approach for finding end point more efficiently
    let left = i + 1;
    let right = points.length - 1;
    let bestEndIndex = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const endPoint = points[mid];
      
      if (!endPoint.distance || !endPoint.time) {
        left = mid + 1;
        continue;
      }
      
      const distance = endPoint.distance - startPoint.distance;
      
      if (distance >= minDistance && distance <= maxDistance) {
        bestEndIndex = mid;
        break;
      } else if (distance < minDistance) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // If binary search found a candidate, also check nearby points for better precision
    if (bestEndIndex !== -1) {
      const checkPoints = [];
      for (let k = Math.max(bestEndIndex - 5, i + 1); k <= Math.min(bestEndIndex + 5, points.length - 1); k++) {
        checkPoints.push(k);
      }
      
      for (const j of checkPoints) {
        const endPoint = points[j];
        
        if (!endPoint.distance || !endPoint.time) continue;
        
        const distance = endPoint.distance - startPoint.distance;
        const duration = endPoint.time - startPoint.time;
        
        if (distance >= minDistance && distance <= maxDistance && duration > 0) {
          const pace = (duration / 60) / (distance / 1000);
          segmentsAnalyzed++;
          
          const segment = {
            startTime: startPoint.time,
            endTime: endPoint.time,
            startDistance: startPoint.distance,
            endDistance: endPoint.distance,
            distance: distance,
            durationSec: duration,
            paceMinPerKm: pace,
            startIndex: i,
            endIndex: j
          };
          
          segments.push(segment);
          
          if (pace < bestPace) {
            bestPace = pace;
            bestSegment = segment;
            validSegmentsFound++;
            
            const startTimeStr = new Date(startPoint.time * 1000).toISOString().slice(11, 19);
            const endTimeStr = new Date(endPoint.time * 1000).toISOString().slice(11, 19);
            console.log(`🏃 New best segment #${validSegmentsFound}: ${distance.toFixed(1)}m in ${(duration/60).toFixed(2)}min (${pace.toFixed(2)} min/km) [${startTimeStr}-${endTimeStr}]`);
          }
        }
      }
    }
    
    // Skip ahead to avoid overlapping segments (optimization)
    if (bestEndIndex !== -1) {
      i = bestEndIndex - 10; // Small overlap to not miss potential better segments
    }
  }
  
  console.log(`📈 Analyzed ${segmentsAnalyzed} potential segments, found ${validSegmentsFound} valid 1km segments`);
  
  // Additional analysis: Look for lap-like patterns (consecutive segments with similar paces)
  if (segments.length > 0) {
    console.log(`🔍 Additional analysis of ${segments.length} total segments:`);
    
    // Sort segments by pace to see the fastest ones
    const sortedSegments = [...segments].sort((a, b) => a.paceMinPerKm - b.paceMinPerKm);
    const topSegments = sortedSegments.slice(0, Math.min(5, sortedSegments.length));
    
    console.log(`🏆 Top ${topSegments.length} fastest segments:`);
    topSegments.forEach((seg, idx) => {
      const startTimeStr = new Date(seg.startTime * 1000).toISOString().slice(11, 19);
      const endTimeStr = new Date(seg.endTime * 1000).toISOString().slice(11, 19);
      console.log(`  ${idx + 1}. ${seg.distance.toFixed(1)}m in ${(seg.durationSec/60).toFixed(2)}min (${seg.paceMinPerKm.toFixed(2)} min/km) [${startTimeStr}-${endTimeStr}]`);
    });
    
    // Cross-validation: Check if we missed any obvious patterns
    const paceVariation = sortedSegments.length > 1 ? 
      ((sortedSegments[sortedSegments.length-1].paceMinPerKm - sortedSegments[0].paceMinPerKm) / sortedSegments[0].paceMinPerKm * 100) : 0;
    console.log(`📊 Pace variation across segments: ${paceVariation.toFixed(1)}%`);
    
    if (paceVariation > 50) {
      console.log(`⚠️ High pace variation detected - activity may have intervals or varying terrain`);
    }
  }
  
  if (bestSegment) {
    const startTime = new Date(bestSegment.startTime * 1000).toISOString();
    const endTime = new Date(bestSegment.endTime * 1000).toISOString();
    console.log(`✅ FINAL BEST SEGMENT: ${bestSegment.distance.toFixed(1)}m in ${(bestSegment.durationSec/60).toFixed(2)}min (${bestSegment.paceMinPerKm.toFixed(2)} min/km)`);
    console.log(`⏱️ Period: ${startTime.slice(11, 19)} UTC - ${endTime.slice(11, 19)} UTC`);
    console.log(`📍 Distance: ${bestSegment.startDistance.toFixed(1)}m → ${bestSegment.endDistance.toFixed(1)}m`);
    console.log(`🎯 Accuracy: ${((bestSegment.distance / segmentDistance) * 100).toFixed(2)}% of target distance`);
    
    return {
      ...bestSegment,
      paceMinPerKm: Number(bestSegment.paceMinPerKm.toFixed(3)),
      durationSec: Number(bestSegment.durationSec.toFixed(1)),
      distance: Number(bestSegment.distance.toFixed(1))
    };
  } else {
    console.log('❌ No valid 1km segment found in the activity');
    return null;
  }
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