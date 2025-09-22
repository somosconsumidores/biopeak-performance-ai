const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthKitDataPoint {
  timestamp: string;
  endTimestamp?: string;
  value: number;
}

function paceFromSpeed(speed?: number | null): number | null {
  if (!speed || speed <= 0) return null;
  return (1000 / speed) / 60;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activity_id } = await req.json();
    
    if (!activity_id) {
      return new Response(JSON.stringify({ error: 'activity_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch HealthKit activity
    const { data: healthkitActivity, error: healthkitError } = await supabase
      .from('healthkit_activities')
      .select('*')
      .eq('healthkit_uuid', activity_id)
      .single();

    if (healthkitError || !healthkitActivity) {
      return new Response(JSON.stringify({ error: 'HealthKit activity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 Processing HealthKit activity:', {
      activity_id,
      duration: healthkitActivity.duration_seconds,
      distance: healthkitActivity.distance_meters,
      energyCount: healthkitActivity.raw_data?.series?.energy?.length || 0,
      heartRateCount: healthkitActivity.raw_data?.series?.heartRate?.length || 0
    });

    const heartRateData: HealthKitDataPoint[] = healthkitActivity.raw_data?.series?.heartRate || [];
    const energyData: HealthKitDataPoint[] = healthkitActivity.raw_data?.series?.energy || [];
    
    if (energyData.length === 0) {
      return new Response(JSON.stringify({ error: 'No energy data found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const activityStartTime = new Date(healthkitActivity.start_time).getTime() / 1000;
    const totalDistance = healthkitActivity.distance_meters;
    const totalDuration = healthkitActivity.duration_seconds;

    // Helper function to interpolate heart rate
    const interpolateHeartRate = (targetTimestamp: number): number | null => {
      if (heartRateData.length === 0) return null;
      
      const targetTime = new Date(targetTimestamp * 1000);
      let closest = heartRateData[0];
      let minDiff = Math.abs(new Date(closest.timestamp).getTime() - targetTime.getTime());
      
      for (const hr of heartRateData) {
        const diff = Math.abs(new Date(hr.timestamp).getTime() - targetTime.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closest = hr;
        }
      }
      
      return minDiff <= 30000 ? closest.value : null;
    };

    // Calculate normalized energy values for speed variation
    const energyValues = energyData.map(e => e.value);
    const maxEnergy = Math.max(...energyValues);
    const minEnergy = Math.min(...energyValues);
    const energyRange = maxEnergy - minEnergy;
    const baseSpeed = totalDistance / totalDuration;

    console.log('🔍 Energy analysis:', {
      energyCount: energyData.length,
      minEnergy,
      maxEnergy,
      energyRange,
      baseSpeed
    });

    // Process energy data to create realistic pace variation
    let cumulativeDistance = 0;
    const processedData = [];

    for (let i = 0; i < energyData.length; i++) {
      const energyPoint = energyData[i];
      const timestamp = new Date(energyPoint.timestamp).getTime() / 1000;
      const endTimestamp = energyPoint.endTimestamp 
        ? new Date(energyPoint.endTimestamp).getTime() / 1000 
        : timestamp + (totalDuration / energyData.length);
      
      const duration = Math.max(0.1, endTimestamp - timestamp);
      const relativeTime = timestamp - activityStartTime;

      // Create speed variation based on energy expenditure
      let speedMultiplier = 1.0;
      if (energyRange > 0) {
        const normalizedEnergy = (energyPoint.value - minEnergy) / energyRange;
        // More energy = faster pace (0.6x to 1.6x of base speed)
        speedMultiplier = 0.6 + (normalizedEnergy * 1.0);
      }

      const speed = Math.max(0.5, Math.min(8, baseSpeed * speedMultiplier));
      const segmentDistance = speed * duration;
      cumulativeDistance = Math.min(cumulativeDistance + segmentDistance, totalDistance);

      processedData.push({
        distance_km: cumulativeDistance / 1000,
        pace_min_km: paceFromSpeed(speed),
        speed_ms: speed,
        heart_rate: interpolateHeartRate(timestamp),
        timestamp: relativeTime,
        energy_value: energyPoint.value,
        speed_multiplier: speedMultiplier
      });
    }

    console.log('🔍 Processed data stats:', {
      dataPoints: processedData.length,
      paceRange: {
        min: Math.min(...processedData.map(d => d.pace_min_km).filter(Boolean)),
        max: Math.max(...processedData.map(d => d.pace_min_km).filter(Boolean)),
        unique: new Set(processedData.map(d => d.pace_min_km).filter(Boolean)).size
      },
      speedRange: {
        min: Math.min(...processedData.map(d => d.speed_ms)),
        max: Math.max(...processedData.map(d => d.speed_ms))
      }
    });

    // Insert into activity_chart_data
    const { error: insertError } = await supabase
      .from('activity_chart_data')
      .insert({
        user_id: healthkitActivity.user_id,
        activity_id,
        activity_source: 'healthkit',
        series_data: processedData,
        data_points_count: processedData.length,
        total_distance_meters: totalDistance,
        duration_seconds: totalDuration,
        avg_pace_min_km: processedData.reduce((sum, d) => sum + (d.pace_min_km || 0), 0) / processedData.filter(d => d.pace_min_km).length,
        avg_heart_rate: Math.round(processedData.reduce((sum, d) => sum + (d.heart_rate || 0), 0) / processedData.filter(d => d.heart_rate).length),
        max_heart_rate: Math.max(...processedData.map(d => d.heart_rate).filter(Boolean)),
        avg_speed_ms: processedData.reduce((sum, d) => sum + d.speed_ms, 0) / processedData.length
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dataPoints: processedData.length,
      paceVariation: {
        min: Math.min(...processedData.map(d => d.pace_min_km).filter(Boolean)),
        max: Math.max(...processedData.map(d => d.pace_min_km).filter(Boolean)),
        unique: new Set(processedData.map(d => d.pace_min_km).filter(Boolean)).size
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in debug function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});