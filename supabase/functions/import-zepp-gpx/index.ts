import { corsHeaders } from '../_shared/cors.ts';

// Haversine distance formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client for user authentication
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.50.4');
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    
    // Client with service role for database operations
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await userSupabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Parse request body
    const { file_path, activity_type = 'RUNNING', name } = await req.json();

    if (!file_path) {
      throw new Error('file_path is required');
    }

    console.log(`Processing Zepp GPX file: ${file_path} for user: ${user.id}`);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await serviceSupabase.storage
      .from('gpx')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Failed to download GPX file: ${downloadError.message}`);
    }

    // Parse GPX content
    const gpxContent = await fileData.text();
    console.log(`GPX content length: ${gpxContent.length}`);

    // Parse XML using a simple parser approach for GPX
    const { XMLParser } = await import('https://cdn.skypack.dev/fast-xml-parser@4.2.5');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    const gpxData = parser.parse(gpxContent);
    console.log('Parsed GPX data structure:', Object.keys(gpxData));

    // Extract track points
    const tracks = gpxData.gpx?.trk || [];
    const trackArray = Array.isArray(tracks) ? tracks : [tracks];
    
    let allTrackPoints: any[] = [];
    
    for (const track of trackArray) {
      const segments = track.trkseg || [];
      const segmentArray = Array.isArray(segments) ? segments : [segments];
      
      for (const segment of segmentArray) {
        const points = segment.trkpt || [];
        const pointArray = Array.isArray(points) ? points : [points];
        allTrackPoints = allTrackPoints.concat(pointArray);
      }
    }

    console.log(`Found ${allTrackPoints.length} track points`);

    if (allTrackPoints.length === 0) {
      throw new Error('No track points found in GPX file');
    }

    // Calculate activity metrics
    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let heartRateSum = 0;
    let heartRateCount = 0;
    let maxHeartRate = 0;
    let speedSum = 0;
    let speedCount = 0;
    let maxSpeed = 0;

    const startTime = allTrackPoints[0]?.time;
    const endTime = allTrackPoints[allTrackPoints.length - 1]?.time;
    
    let startTimeMs = 0;
    let endTimeMs = 0;
    
    if (startTime) {
      startTimeMs = new Date(startTime).getTime();
    }
    if (endTime) {
      endTimeMs = new Date(endTime).getTime();
    }

    const duration = endTimeMs > startTimeMs ? Math.round((endTimeMs - startTimeMs) / 1000) : 0;

    // Precompute per-point values for efficient insertion
    const timestamps: (number | null)[] = [];
    const cumulativeDistances: number[] = [];
    const speeds: (number | null)[] = [];
    const durations: (number | null)[] = [];

    let cumulative = 0;
    for (let i = 0; i < allTrackPoints.length; i++) {
      const point = allTrackPoints[i];
      const lat = parseFloat(point['@_lat']);
      const lon = parseFloat(point['@_lon']);
      const elevation = point.ele ? parseFloat(point.ele) : null;
      const heartRate = point.extensions?.['ns3:TrackPointExtension']?.['ns3:hr']
        ? parseInt(point.extensions['ns3:TrackPointExtension']['ns3:hr'])
        : null;
      const ts = point.time ? new Date(point.time).getTime() : null;
      timestamps.push(ts);

      // Calculate distance and speed relative to previous point
      let speed: number | null = null;
      if (i > 0) {
        const prevPoint = allTrackPoints[i - 1];
        const prevLat = parseFloat(prevPoint['@_lat']);
        const prevLon = parseFloat(prevPoint['@_lon']);
        const segmentDistance = haversineDistance(prevLat, prevLon, lat, lon);
        cumulative += segmentDistance;
        totalDistance += segmentDistance;

        const prevTs = timestamps[i - 1];
        if (ts && prevTs) {
          const timeDiff = (ts - prevTs) / 1000;
          if (timeDiff > 0) {
            speed = segmentDistance / timeDiff;
            speedSum += speed;
            speedCount++;
            maxSpeed = Math.max(maxSpeed, speed);
          }
        }
      } else {
        cumulative = 0;
      }

      // Process elevation
      if (elevation !== null) {
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);
        if (i > 0) {
          const prevElevation = allTrackPoints[i - 1].ele ? parseFloat(allTrackPoints[i - 1].ele) : null;
          if (prevElevation !== null) {
            const elevationChange = elevation - prevElevation;
            if (elevationChange > 0) {
              elevationGain += elevationChange;
            } else {
              elevationLoss += Math.abs(elevationChange);
            }
          }
        }
      }

      // Process heart rate
      if (heartRate) {
        heartRateSum += heartRate;
        heartRateCount++;
        maxHeartRate = Math.max(maxHeartRate, heartRate);
      }

      // Store arrays
      speeds.push(speed);
      cumulativeDistances.push(cumulative);
      durations.push(ts && startTimeMs ? Math.round((ts - startTimeMs) / 1000) : null);
    }

    // Calculate averages
    const averageSpeed = speedCount > 0 ? speedSum / speedCount : 0;
    const averageHeartRate = heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : null;
    const averagePace = averageSpeed > 0 ? 1000 / (averageSpeed * 60) : null; // min/km

    // Estimate calories (rough calculation)
    const calories = duration > 0 ? Math.round((duration / 60) * 10 * (averageHeartRate || 150) / 150) : null;

    // Generate unique activity ID
    const activityId = `zepp_gpx_${user.id}_${Date.now()}`;

    // Prepare activity data
    const activityData = {
      user_id: user.id,
      activity_id: activityId,
      name: name || 'Atividade Zepp GPX',
      activity_type: activity_type,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      distance_in_meters: Math.round(totalDistance),
      duration_in_seconds: duration,
      calories: calories,
      elevation_gain_meters: Math.round(elevationGain),
      elevation_loss_meters: Math.round(elevationLoss),
      average_speed_ms: averageSpeed,
      max_speed_ms: maxSpeed,
      average_heart_rate: averageHeartRate,
      max_heart_rate: maxHeartRate > 0 ? maxHeartRate : null,
      average_pace_min_km: averagePace
    };

    console.log('Activity data:', activityData);

    // Insert activity into database
    const { data: insertedActivity, error: activityError } = await serviceSupabase
      .from('zepp_gpx_activities')
      .insert(activityData)
      .select()
      .single();

    if (activityError) {
      throw new Error(`Failed to insert activity: ${activityError.message}`);
    }

    console.log(`Activity inserted with ID: ${insertedActivity.id}`);

    // Insert track points in batches with adaptive retries
    const INITIAL_BATCH_SIZE = 200;
    let insertedPoints = 0;

    async function insertChunk(points: any[], attempt = 1): Promise<void> {
      if (points.length === 0) return;
      try {
        const { error } = await serviceSupabase
          .from('zepp_gpx_activity_details')
          .insert(points);

        if (error) {
          const msg = (error as any).message || '';
          const code = (error as any).code || '';
          const isTimeout = code === '57014' || msg.toLowerCase().includes('statement timeout');
          if (isTimeout && points.length > 25) {
            const mid = Math.floor(points.length / 2);
            console.warn(`Timeout on insert of ${points.length} rows. Splitting into ${mid} + ${points.length - mid}`);
            await insertChunk(points.slice(0, mid), attempt + 1);
            await insertChunk(points.slice(mid), attempt + 1);
            return;
          }
          throw error;
        }

        insertedPoints += points.length;
        console.log(`Inserted ${insertedPoints}/${allTrackPoints.length} track points`);
      } catch (e) {
        console.error('Insert chunk failed:', e);
        throw new Error(`Failed to insert activity details: ${(e as any).message || e}`);
      }
    }

    for (let i = 0; i < allTrackPoints.length; i += INITIAL_BATCH_SIZE) {
      const batch = allTrackPoints.slice(i, i + INITIAL_BATCH_SIZE).map((point, index) => {
        const idx = i + index;
        const lat = parseFloat(point['@_lat']);
        const lon = parseFloat(point['@_lon']);
        const elevation = point.ele ? parseFloat(point.ele) : null;
        const heartRate = point.extensions?.['ns3:TrackPointExtension']?.['ns3:hr']
          ? parseInt(point.extensions['ns3:TrackPointExtension']['ns3:hr'])
          : null;

        return {
          user_id: user.id,
          activity_id: activityId,
          sample_timestamp: timestamps[idx],
          heart_rate: heartRate,
          speed_meters_per_second: speeds[idx],
          latitude_in_degree: lat,
          longitude_in_degree: lon,
          elevation_in_meters: elevation,
          total_distance_in_meters: cumulativeDistances[idx],
          duration_in_seconds: durations[idx]
        };
      });
      console.log(`Inserting batch ${(i / INITIAL_BATCH_SIZE) + 1} with ${batch.length} points`);
      await insertChunk(batch);
    }

    // Build activity_chart_data for this activity
    try {
      await serviceSupabase.functions.invoke('calculate-activity-chart-data', {
        body: {
          activity_id: String(activityId),
          user_id: user.id,
          activity_source: 'zepp_gpx',
          internal_call: true,
        },
      });
      console.log('Activity chart data calculated (Zepp GPX)');
    } catch (e) {
      console.error('Failed to calculate activity chart data (Zepp GPX):', e);
    }

    // Calculate performance metrics for the activity
    try {
      const { error: metricsError } = await serviceSupabase.functions.invoke('calculate-gpx-performance-metrics', {
        body: {
          activity_id: activityId,
          user_id: user.id
        }
      });

      if (metricsError) {
        console.error('Failed to calculate performance metrics:', metricsError);
      } else {
        console.log('Performance metrics calculated successfully');
      }
    } catch (metricsError) {
      console.error('Error calculating performance metrics:', metricsError);
    }

    // Calculate statistics metrics
    try {
      await serviceSupabase.functions.invoke('calculate-statistics-metrics', {
        body: {
          activity_id: activityId,
          user_id: user.id,
          source_activity: 'Zepp GPX'
        }
      });
    } catch (statsError) {
      console.error('Error calculating statistics metrics:', statsError);
      // Don't fail the main operation if stats calculation fails
    }

    const response = {
      success: true,
      activity_id: activityId,
      activity: insertedActivity,
      metrics: {
        distance_in_meters: Math.round(totalDistance),
        duration_in_seconds: duration,
        elevation_gain_meters: Math.round(elevationGain),
        elevation_loss_meters: Math.round(elevationLoss),
        average_heart_rate: averageHeartRate,
        max_heart_rate: maxHeartRate > 0 ? maxHeartRate : null,
        track_points: allTrackPoints.length,
        calories: calories
      }
    };

    console.log('Import completed successfully:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Zepp GPX import error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});