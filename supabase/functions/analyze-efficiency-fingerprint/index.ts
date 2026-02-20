import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DataPoint {
  distance_meters: number;
  speed_ms: number;
  heart_rate: number;
  power_watts?: number;
  elevation?: number;
  pace_min_km?: number;
}

interface Segment {
  segment_number: number;
  start_distance_m: number;
  end_distance_m: number;
  avg_pace_min_km: number;
  avg_hr: number;
  avg_power: number | null;
  avg_speed_ms: number;
  efficiency_score: number;
  hr_efficiency_delta: number | null;
  label: 'green' | 'yellow' | 'red';
  point_count: number;
}

function speedToPace(speedMs: number): number {
  if (speedMs <= 0) return 99;
  return 1000 / speedMs / 60; // min/km
}

function computeSegments(points: DataPoint[]): Segment[] {
  const SEGMENT_DISTANCE = 250; // meters
  const segments: Segment[] = [];
  let segStart = 0;
  let segPoints: DataPoint[] = [];
  let segNumber = 1;

  for (const p of points) {
    segPoints.push(p);
    if (p.distance_meters - (segments.length > 0 ? segments[segments.length - 1].end_distance_m : 0) >= SEGMENT_DISTANCE && segPoints.length >= 3) {
      const startDist = segments.length > 0 ? segments[segments.length - 1].end_distance_m : 0;
      const endDist = p.distance_meters;
      
      const avgSpeed = segPoints.reduce((s, pt) => s + pt.speed_ms, 0) / segPoints.length;
      const avgHr = segPoints.reduce((s, pt) => s + pt.heart_rate, 0) / segPoints.length;
      const powerPoints = segPoints.filter(pt => pt.power_watts && pt.power_watts > 0);
      const avgPower = powerPoints.length > 0 ? powerPoints.reduce((s, pt) => s + (pt.power_watts || 0), 0) / powerPoints.length : null;
      
      // Efficiency score: with power use speed/power, without use speed/hr
      let rawEff: number;
      if (avgPower && avgPower > 0) {
        rawEff = (avgSpeed / avgPower) * 1000;
      } else {
        rawEff = (avgSpeed / avgHr) * 1000;
      }

      // hr_efficiency_delta: compare to previous segment
      let hrDelta: number | null = null;
      if (segments.length > 0) {
        const prev = segments[segments.length - 1];
        const prevEff = avgPower && prev.avg_power
          ? (prev.avg_speed_ms / prev.avg_power!) * 1000
          : (prev.avg_speed_ms / prev.avg_hr) * 1000;
        hrDelta = prevEff > 0 ? ((rawEff - prevEff) / prevEff) * 100 : 0;
      }

      segments.push({
        segment_number: segNumber++,
        start_distance_m: Math.round(startDist),
        end_distance_m: Math.round(endDist),
        avg_pace_min_km: Math.round(speedToPace(avgSpeed) * 100) / 100,
        avg_hr: Math.round(avgHr),
        avg_power: avgPower ? Math.round(avgPower) : null,
        avg_speed_ms: Math.round(avgSpeed * 100) / 100,
        efficiency_score: Math.round(rawEff * 100) / 100,
        hr_efficiency_delta: hrDelta !== null ? Math.round(hrDelta * 10) / 10 : null,
        label: 'green', // placeholder, normalize later
        point_count: segPoints.length,
      });
      segPoints = [];
    }
  }

  // Process remaining points as last segment if enough
  if (segPoints.length >= 3 && segments.length > 0) {
    const startDist = segments[segments.length - 1].end_distance_m;
    const endDist = segPoints[segPoints.length - 1].distance_meters;
    if (endDist - startDist > 50) {
      const avgSpeed = segPoints.reduce((s, pt) => s + pt.speed_ms, 0) / segPoints.length;
      const avgHr = segPoints.reduce((s, pt) => s + pt.heart_rate, 0) / segPoints.length;
      const powerPoints = segPoints.filter(pt => pt.power_watts && pt.power_watts > 0);
      const avgPower = powerPoints.length > 0 ? powerPoints.reduce((s, pt) => s + (pt.power_watts || 0), 0) / powerPoints.length : null;
      let rawEff = avgPower && avgPower > 0 ? (avgSpeed / avgPower) * 1000 : (avgSpeed / avgHr) * 1000;
      
      const prev = segments[segments.length - 1];
      const prevEff = avgPower && prev.avg_power ? (prev.avg_speed_ms / prev.avg_power!) * 1000 : (prev.avg_speed_ms / prev.avg_hr) * 1000;
      const hrDelta = prevEff > 0 ? ((rawEff - prevEff) / prevEff) * 100 : 0;

      segments.push({
        segment_number: segNumber,
        start_distance_m: Math.round(startDist),
        end_distance_m: Math.round(endDist),
        avg_pace_min_km: Math.round(speedToPace(avgSpeed) * 100) / 100,
        avg_hr: Math.round(avgHr),
        avg_power: avgPower ? Math.round(avgPower) : null,
        avg_speed_ms: Math.round(avgSpeed * 100) / 100,
        efficiency_score: Math.round(rawEff * 100) / 100,
        hr_efficiency_delta: Math.round(hrDelta * 10) / 10,
        label: 'green',
        point_count: segPoints.length,
      });
    }
  }

  // Normalize scores to 0-100 and assign labels
  if (segments.length > 0) {
    const scores = segments.map(s => s.efficiency_score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;

    for (const seg of segments) {
      seg.efficiency_score = Math.round(((seg.efficiency_score - minScore) / range) * 100);
      seg.label = seg.efficiency_score >= 70 ? 'green' : seg.efficiency_score >= 40 ? 'yellow' : 'red';
    }
  }

  return segments;
}

function generateAlerts(segments: Segment[]): { distance_km: string; description: string; severity: 'warning' | 'danger' }[] {
  const alerts: { distance_km: string; description: string; severity: 'warning' | 'danger' }[] = [];
  if (segments.length < 3) return alerts;

  // Moving average window of 3
  for (let i = 3; i < segments.length; i++) {
    const movingAvg = (segments[i - 1].efficiency_score + segments[i - 2].efficiency_score + segments[i - 3].efficiency_score) / 3;
    const drop = ((movingAvg - segments[i].efficiency_score) / movingAvg) * 100;
    
    if (drop > 15) {
      alerts.push({
        distance_km: (segments[i].start_distance_m / 1000).toFixed(1),
        description: `Queda de eficiência de ${Math.round(drop)}% no km ${(segments[i].start_distance_m / 1000).toFixed(1)}`,
        severity: drop > 25 ? 'danger' : 'warning'
      });
    }
  }

  // HR rising without speed gain
  for (let i = 1; i < segments.length; i++) {
    const hrChange = ((segments[i].avg_hr - segments[i - 1].avg_hr) / segments[i - 1].avg_hr) * 100;
    const speedChange = ((segments[i].avg_speed_ms - segments[i - 1].avg_speed_ms) / segments[i - 1].avg_speed_ms) * 100;
    
    if (hrChange > 8 && speedChange < 2) {
      alerts.push({
        distance_km: (segments[i].start_distance_m / 1000).toFixed(1),
        description: `FC subiu ${Math.round(hrChange)}% sem ganho de velocidade no km ${(segments[i].start_distance_m / 1000).toFixed(1)}`,
        severity: hrChange > 12 ? 'danger' : 'warning'
      });
    }
  }

  // Power drop (if available)
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].avg_power && segments[i - 1].avg_power) {
      const powerDrop = ((segments[i - 1].avg_power! - segments[i].avg_power!) / segments[i - 1].avg_power!) * 100;
      if (powerDrop > 15) {
        alerts.push({
          distance_km: (segments[i].start_distance_m / 1000).toFixed(1),
          description: `Queda de potência de ${Math.round(powerDrop)}% no km ${(segments[i].start_distance_m / 1000).toFixed(1)}`,
          severity: 'warning'
        });
      }
    }
  }

  // Deduplicate and limit
  const unique = alerts.filter((a, i, arr) => arr.findIndex(b => b.distance_km === a.distance_km) === i);
  return unique.slice(0, 8);
}

function generateRecommendations(segments: Segment[], alerts: any[]): { icon: string; title: string; description: string }[] {
  const recs: { icon: string; title: string; description: string }[] = [];
  
  // Check for late-race efficiency drops
  const lastThird = segments.slice(Math.floor(segments.length * 0.66));
  const firstThird = segments.slice(0, Math.floor(segments.length * 0.33));
  
  const avgFirst = firstThird.length > 0 ? firstThird.reduce((s, seg) => s + seg.efficiency_score, 0) / firstThird.length : 50;
  const avgLast = lastThird.length > 0 ? lastThird.reduce((s, seg) => s + seg.efficiency_score, 0) / lastThird.length : 50;
  
  if (avgFirst - avgLast > 20) {
    recs.push({
      icon: '🔋',
      title: 'Trabalho de resistência muscular',
      description: `Sua eficiência caiu ${Math.round(avgFirst - avgLast)}% no terço final. Inclua treinos de tempo run e força excêntrica (agachamentos excêntricos, lunges) para melhorar a resistência à fadiga.`
    });
  }

  // HR drift detection
  const hrDriftAlerts = alerts.filter((a: any) => a.description.includes('FC subiu'));
  if (hrDriftAlerts.length >= 2) {
    recs.push({
      icon: '❤️',
      title: 'Controle de drift cardíaco',
      description: 'Múltiplos pontos de drift de FC detectados. Trabalhe em corridas aeróbicas longas na Z2 para melhorar a economia cardíaca e reduzir o drift.'
    });
  }

  // Power inconsistency
  const hasPower = segments.some(s => s.avg_power !== null);
  if (hasPower) {
    const powerSegs = segments.filter(s => s.avg_power !== null);
    const avgPow = powerSegs.reduce((s, seg) => s + seg.avg_power!, 0) / powerSegs.length;
    const stdDev = Math.sqrt(powerSegs.reduce((s, seg) => s + Math.pow(seg.avg_power! - avgPow, 2), 0) / powerSegs.length);
    const cv = (stdDev / avgPow) * 100;
    if (cv > 15) {
      recs.push({
        icon: '⚡',
        title: 'Estabilidade de potência',
        description: `Variação de potência de ${Math.round(cv)}% entre segmentos. Treinos de cadência constante (90rpm+) e progressive runs ajudam a estabilizar a saída.`
      });
    }
  }

  // General efficiency recommendation
  const overallScore = segments.reduce((s, seg) => s + seg.efficiency_score, 0) / segments.length;
  if (overallScore < 50 && recs.length < 3) {
    recs.push({
      icon: '🎯',
      title: 'Foco na economia de corrida',
      description: 'Score geral abaixo de 50. Priorize treinos de técnica de corrida (drills A/B/C), strides de 100m e corridas em ritmo controlado na Z2.'
    });
  }

  return recs.slice(0, 3);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Auth client to verify user
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Service client for writes
    const sb = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: `Bearer ${serviceKey}` } }
    });

    const { activity_id } = await req.json();
    if (!activity_id) throw new Error('activity_id required');

    // Check cache first
    const { data: cached } = await sb
      .from('efficiency_fingerprint')
      .select('*')
      .eq('activity_id', activity_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch series_data
    const { data: chartData, error: chartError } = await sb
      .from('activity_chart_data')
      .select('series_data')
      .eq('activity_id', activity_id)
      .maybeSingle();

    if (chartError || !chartData) {
      throw new Error('Activity chart data not found');
    }

    const seriesData = chartData.series_data as any[];
    if (!seriesData || !Array.isArray(seriesData)) {
      throw new Error('Invalid series_data format');
    }

    // Filter valid points
    const validPoints: DataPoint[] = seriesData
      .filter((p: any) => {
        const speed = p.speed_ms || 0;
        const hr = p.heart_rate || p.hr || 0;
        const dist = p.distance_meters || p.distance_m || 0;
        return speed > 0.5 && hr > 30 && dist > 0;
      })
      .map((p: any) => ({
        distance_meters: p.distance_meters || p.distance_m || 0,
        speed_ms: p.speed_ms || 0,
        heart_rate: p.heart_rate || p.hr || 0,
        power_watts: p.power_watts || null,
        elevation: p.elevation || p.elevation_m || null,
      }));

    if (validPoints.length < 10) {
      return new Response(JSON.stringify({ segments: [], alerts: [], recommendations: [], overall_score: 0, insufficient_data: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Compute segments
    const segments = computeSegments(validPoints);
    if (segments.length < 2) {
      return new Response(JSON.stringify({ segments: [], alerts: [], recommendations: [], overall_score: 0, insufficient_data: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate alerts and recommendations
    const alerts = generateAlerts(segments);
    const recommendations = generateRecommendations(segments, alerts);

    // Calculate overall score (weighted: later segments count more)
    let totalWeight = 0;
    let weightedSum = 0;
    for (let i = 0; i < segments.length; i++) {
      const weight = 1 + (i / segments.length); // 1.0 to ~2.0
      weightedSum += segments[i].efficiency_score * weight;
      totalWeight += weight;
    }
    const overallScore = Math.round(weightedSum / totalWeight);

    // Upsert result
    const result = {
      user_id: user.id,
      activity_id,
      segments,
      alerts,
      recommendations,
      overall_score: overallScore,
      computed_at: new Date().toISOString(),
    };

    const { error: upsertError } = await sb
      .from('efficiency_fingerprint')
      .upsert(result, { onConflict: 'activity_id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    return new Response(JSON.stringify({ ...result, id: null, created_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Efficiency fingerprint error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
