// Supabase Edge Function: classify-workouts-from-series
// Deterministic classifier based solely on activity_chart_data
// - Filters by user_id and/or activity_id from request body
// - Computes aggregated metrics from series_data
// - Classifies using simple heuristics
// - Upserts results into public.workout_classification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helpers
const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function mean(arr: number[]): number | null {
  if (!arr?.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number | null {
  if (!arr || arr.length < 2) return null;
  const m = mean(arr);
  if (m === null) return null;
  const variance = arr.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function coefficientOfVariation(arr: number[]): number | null {
  const m = mean(arr);
  const s = stddev(arr);
  if (m === null || s === null || m === 0) return null;
  return s / m;
}

function toPaceFromSpeed(speed_ms: number | null | undefined): number | null {
  if (!isFiniteNumber(speed_ms) || speed_ms <= 0) return null;
  return 1000 / (speed_ms * 60); // min/km
}

function clampFloat(n: number | null, digits = 3): number | null {
  if (!isFiniteNumber(n as number)) return null;
  return parseFloat((n as number).toFixed(digits));
}

// Extractors for multiple possible field names
function getDistanceMeters(p: any): number | null {
  const v = p?.distance_m ?? p?.distanceMeters ?? p?.distance ?? null;
  return isFiniteNumber(v) ? v : null;
}
function getTimeSeconds(p: any): number | null {
  const v = p?.time_s ?? p?.time ?? p?.elapsed_s ?? p?.elapsed_time ?? null;
  return isFiniteNumber(v) ? v : null;
}
function getSpeedMs(p: any): number | null {
  const v = p?.speed_ms ?? p?.speed_meters_per_second ?? p?.velocity_smooth ?? p?.speed ?? null;
  return isFiniteNumber(v) ? v : null;
}
function getPaceMinKm(p: any): number | null {
  const v = p?.pace_min_km ?? p?.paceMinKm ?? null;
  if (isFiniteNumber(v) && v > 0) return v;
  const s = getSpeedMs(p);
  return toPaceFromSpeed(s);
}
function getHeartRate(p: any): number | null {
  const v = p?.heart_rate ?? p?.heartrate ?? p?.hr ?? null;
  return isFiniteNumber(v) ? v : null;
}

function classify(metrics: {
  dist_km: number | null;
  dur_min: number | null;
  avg_pace: number | null; // min/km
  cv_pace: number | null;
  avg_hr: number | null;
  cv_hr: number | null;
}): string {
  const { dist_km, dur_min, avg_pace, cv_pace, avg_hr, cv_hr } = metrics;
  const avg_speed_ms = isFiniteNumber(avg_pace as number) && (avg_pace as number) > 0 ? 1000 / ((avg_pace as number) * 60) : null;

  // Walk / invalid
  if ((isFiniteNumber(avg_pace as number) && (avg_pace as number) > 11) || (isFiniteNumber(avg_speed_ms) && (avg_speed_ms as number) < 1.5) || (isFiniteNumber(avg_hr as number) && (avg_hr as number) < 90)) {
    return "walk_or_invalid";
  }

  // Long run
  if (isFiniteNumber(dist_km as number) && (dist_km as number) > 14 && isFiniteNumber(cv_pace as number) && (cv_pace as number) < 0.10) {
    const hrOk = !isFiniteNumber(avg_hr as number) || ((avg_hr as number) >= 100 && (avg_hr as number) <= 160);
    if (hrOk) return "long_run";
  }

  // Interval / Fartlek
  if (isFiniteNumber(cv_pace as number) && (cv_pace as number) > 0.20 && isFiniteNumber(dur_min as number) && (dur_min as number) < 70) {
    return "interval_or_fartlek";
  }

  // Tempo run
  if (
    isFiniteNumber(dist_km as number) && (dist_km as number) >= 5 && (dist_km as number) <= 12 &&
    isFiniteNumber(cv_pace as number) && (cv_pace as number) < 0.10 &&
    isFiniteNumber(avg_hr as number) && (avg_hr as number) >= 150 && (avg_hr as number) <= 180
  ) {
    return "tempo_run";
  }

  // Easy run
  if (
    isFiniteNumber(dist_km as number) && (dist_km as number) >= 3 && (dist_km as number) <= 12 &&
    isFiniteNumber(avg_pace as number) && (avg_pace as number) > 6.0 &&
    isFiniteNumber(cv_hr as number) && (cv_hr as number) < 0.08
  ) {
    return "easy_run";
  }

  // Recovery run
  if (
    isFiniteNumber(dist_km as number) && (dist_km as number) < 6 &&
    isFiniteNumber(avg_pace as number) && (avg_pace as number) > 7.0 &&
    isFiniteNumber(avg_hr as number) && (avg_hr as number) < 130
  ) {
    return "recovery_run";
  }

  return "unclassified";
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return new Response(JSON.stringify({ success: false, error: "Missing Supabase env vars" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey ?? anonKey);

    const body = await req.json().catch(() => ({}));
    const user_id: string | null = body?.user_id ?? null;
    const activity_id_input: string | string[] | null = body?.activity_id ?? null;

    if (!user_id && !activity_id_input) {
      return new Response(JSON.stringify({ success: true, processed: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("activity_chart_data")
      .select("user_id, activity_id, series_data, duration_seconds")
      .order("created_at", { ascending: false });

    if (user_id) query = query.eq("user_id", user_id);

    if (activity_id_input) {
      if (Array.isArray(activity_id_input)) {
        if (activity_id_input.length === 0) {
          return new Response(JSON.stringify({ success: true, processed: 0, results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        query = query.in("activity_id", activity_id_input);
      } else {
        query = query.eq("activity_id", activity_id_input);
      }
    }

    const { data: rows, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ success: false, error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: Array<{ user_id: string; activity_id: string; type: string; metrics: any }> = [];

    for (const row of rows ?? []) {
      const series: any[] = Array.isArray(row.series_data) ? row.series_data : [];

      const distances = series.map(getDistanceMeters).filter((v): v is number => isFiniteNumber(v) && v >= 0);
      const times = series.map(getTimeSeconds).filter((v): v is number => isFiniteNumber(v) && v >= 0);
      const speeds = series.map(getSpeedMs).filter((v): v is number => isFiniteNumber(v) && v > 0);

      const pacesRaw = series.map(getPaceMinKm).filter((v): v is number => isFiniteNumber(v) && v > 0);
      const paces = pacesRaw.filter((p) => p > 0 && p < 20); // filter outliers

      const hrs = series.map(getHeartRate).filter((v): v is number => isFiniteNumber(v) && v > 0);

      // dist_km / dur_min
      let dist_km: number | null = null;
      if (distances.length) dist_km = Math.max(...distances) / 1000;
      else if (times.length && speeds.length) dist_km = (Math.max(...times) * (mean(speeds) ?? 0)) / 1000;

      let dur_min: number | null = null;
      if (times.length) dur_min = Math.max(...times) / 60;
      else if (distances.length && speeds.length) dur_min = (Math.max(...distances) / (mean(speeds) ?? 0)) / 60;

      // Aggregates
      const avg_pace = clampFloat(mean(paces), 2);
      const cv_pace = clampFloat(coefficientOfVariation(paces), 3);
      const avg_hr = mean(hrs);
      const cv_hr = clampFloat(coefficientOfVariation(hrs), 3);

      const metrics = {
        dist_km: clampFloat(dist_km, 2),
        dur_min: clampFloat(dur_min, 1),
        avg_pace: avg_pace,
        cv_pace: cv_pace,
        avg_hr: avg_hr !== null ? Math.round(avg_hr) : null,
        cv_hr: cv_hr,
      };

      const type = classify(metrics);

      // Upsert result
      const upsertPayload = [{
        user_id: row.user_id,
        activity_id: row.activity_id,
        detected_workout_type: type,
        metrics: metrics,
        updated_at: new Date().toISOString(),
      }];

      const { error: upsertError } = await supabase
        .from("workout_classification")
        .upsert(upsertPayload, { onConflict: "user_id,activity_id" });

      if (upsertError) {
        // If RLS blocks (e.g., mismatched user), skip but report
        results.push({ user_id: row.user_id, activity_id: row.activity_id, type: "error", metrics: { message: upsertError.message } });
        continue;
      }

      results.push({ user_id: row.user_id, activity_id: row.activity_id, type, metrics });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
