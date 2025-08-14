import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

type ActivitySource = 'garmin' | 'polar' | 'strava' | 'gpx' | 'zepp_gpx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface BuildBody {
  activity_id: string;
  activity_source?: ActivitySource; // opcional: auto-detecta se não vier
  version?: number; // default 1
  user_id?: string; // opcional – user será obtido via JWT
}

interface SeriesPoint {
  distance_km: number;
  heart_rate: number | null;
  pace_min_per_km: number | null;
  speed_meters_per_second: number | null;
  ts?: number | null; // epoch ms opcional
}

function sampleByDistance(points: SeriesPoint[], stepKm = 0.05): SeriesPoint[] {
  if (points.length === 0) return [];
  const sampled: SeriesPoint[] = [];
  let nextThreshold = 0;
  for (const p of points) {
    if (p.distance_km >= nextThreshold || sampled.length === 0) {
      sampled.push(p);
      nextThreshold = p.distance_km + stepKm;
    }
  }
  // garante último ponto
  if (sampled.length > 0 && points.length > 0) {
    const last = points[points.length - 1];
    const lastSampled = sampled[sampled.length - 1];
    if (Math.abs(last.distance_km - lastSampled.distance_km) > 0.001) {
      sampled.push(last);
    }
  }
  return sampled;
}

function calcPaceFromSpeed(speed: number | null | undefined): number | null {
  if (!speed || speed <= 0) return null;
  return (1000 / speed) / 60; // min/km
}

function zoneColorClass(idx: number): string {
  switch (idx) {
    case 0: return "bg-blue-500";
    case 1: return "bg-green-500";
    case 2: return "bg-yellow-500";
    case 3: return "bg-orange-500";
    default: return "bg-red-500";
  }
}

function calcZonesFromSeries(series: SeriesPoint[], userMaxHR?: number | null, profileBirthDate?: string | null) {
  if (!series || series.length === 0) return { zones: [], totalSeconds: 0, maxHRUsed: null as number | null };

  // Estimate theoretical max HR from age if available
  let theoreticalMaxHR: number | null = null;
  if (profileBirthDate) {
    const birthDate = new Date(profileBirthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear() -
      (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
    theoreticalMaxHR = 220 - age;
  }

  const dataMax = series.reduce((m, p) => (p.heart_rate && p.heart_rate > m ? p.heart_rate : m), 0);
  const maxHR = userMaxHR || theoreticalMaxHR || (dataMax > 0 ? dataMax : 190);

  // compute dt per point
  const dts: number[] = new Array(series.length).fill(1);
  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    const nxt = i < series.length - 1 ? series[i + 1] : null;
    if (cur?.ts != null && nxt?.ts != null) {
      const dt = Math.max(1, Math.round((nxt.ts - cur.ts) / 1000));
      dts[i] = dt;
    } else if (cur?.speed_meters_per_second && i < series.length - 1) {
      // estimate dt from distance delta when ts missing
      const dx = Math.max(0, (series[i + 1].distance_km - cur.distance_km) * 1000);
      const dt = cur.speed_meters_per_second > 0 ? Math.max(1, Math.round(dx / cur.speed_meters_per_second)) : 1;
      dts[i] = dt;
    } else {
      dts[i] = 1;
    }
  }
  const totalSeconds = dts.reduce((a, b) => a + b, 0);

  const zoneDefs = [
    { zone: 'Zona 1', label: 'Recuperação', minPercent: 0,  maxPercent: 60 },
    { zone: 'Zona 2', label: 'Aeróbica',    minPercent: 60, maxPercent: 70 },
    { zone: 'Zona 3', label: 'Limiar',      minPercent: 70, maxPercent: 80 },
    { zone: 'Zona 4', label: 'Anaeróbica',  minPercent: 80, maxPercent: 90 },
    { zone: 'Zona 5', label: 'Máxima',      minPercent: 90, maxPercent: 150 },
  ];

  const zones = zoneDefs.map((z, idx) => {
    const minHR = Math.round((z.minPercent / 100) * maxHR);
    const maxHRz = Math.round((z.maxPercent / 100) * maxHR);
    let seconds = 0;
    for (let i = 0; i < series.length; i++) {
      const hr = series[i].heart_rate ?? 0;
      const inZone = idx === zoneDefs.length - 1 ? hr >= minHR : hr >= minHR && hr < maxHRz;
      if (inZone) seconds += dts[i];
    }
    const percentage = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
    return {
      zone: z.zone,
      label: z.label,
      minHR,
      maxHR: maxHRz,
      timeInZone: seconds,
      percentage,
      color: zoneColorClass(idx),
    };
  });

  return { zones, totalSeconds, maxHRUsed: maxHR };
}

async function getUserIdFromJWT(req: Request): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("[build-activity-chart-cache] auth.getUser error:", error.message);
      return null;
    }
    return user?.id ?? null;
  } catch (e) {
    console.warn("[build-activity-chart-cache] getUserIdFromJWT failed:", e);
    return null;
  }
}

async function detectSource(admin: ReturnType<typeof createClient>, userId: string, activityId: string): Promise<ActivitySource | null> {
  // Try in order: garmin, polar, zepp_gpx, gpx, strava
  // garmin
  {
    const { count, error } = await admin
      .from("garmin_activity_details")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("activity_id", activityId);
    if (!error && (count ?? 0) > 0) return "garmin";
  }
  // polar
  {
    const { count, error } = await admin
      .from("polar_activity_details")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("activity_id", activityId);
    if (!error && (count ?? 0) > 0) return "polar";
  }
  // zepp_gpx (has user_id)
  {
    const { count, error } = await admin
      .from("zepp_gpx_activity_details")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("activity_id", activityId);
    if (!error && (count ?? 0) > 0) return "zepp_gpx";
  }
  // strava_gpx (check if activityId is in strava_gpx_activities, then find details)
  {
    const { data: stravaGpxActivity, error } = await admin
      .from("strava_gpx_activities")
      .select("activity_id")
      .eq("id", activityId)
      .maybeSingle();
    
    if (!error && stravaGpxActivity) {
      // Now check if there are details for this activity_id
      const { count, error: detailsError } = await admin
        .from("strava_gpx_activity_details")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", stravaGpxActivity.activity_id);
      if (!detailsError && (count ?? 0) > 0) return "gpx";
    }
  }
  // strava (id numérico)
  {
    const stravaId = Number(activityId);
    if (!Number.isNaN(stravaId)) {
      const { count, error } = await admin
        .from("strava_activity_details")
        .select("*", { count: "exact", head: true })
        .eq("strava_activity_id", stravaId);
      if (!error && (count ?? 0) > 0) return "strava";
    }
  }
  return null;
}

async function fetchAllPaged<T = any>(admin: ReturnType<typeof createClient>, table: string, select: string, filters: Record<string, any>, order?: { column: string, ascending: boolean }, pageSize = 1000): Promise<T[]> {
  let from = 0;
  const all: T[] = [];
  while (true) {
    let q = admin.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v);
    }
    if (order) q = q.order(order.column, { ascending: order.ascending });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data as T[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) as BuildBody;
    if (!body?.activity_id) {
      return new Response(JSON.stringify({ error: "Missing activity_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const version = body.version ?? 1;
    const jwtUserId = await getUserIdFromJWT(req);
    const userId = body.user_id ?? jwtUserId;
    if (!userId) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let source: ActivitySource | null = body.activity_source ?? null;
    if (!source) {
      source = await detectSource(supabaseAdmin, userId, body.activity_id);
      if (!source) {
        return new Response(JSON.stringify({ error: "Could not detect activity source" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    console.log("[build-activity-chart-cache] Start", { userId, activity_id: body.activity_id, source, version });

    // Mark or upsert pending first (so clients can see progress)
    {
      const { error: upErr } = await supabaseAdmin
        .from("activity_chart_cache")
        .upsert({
          user_id: userId,
          activity_source: source,
          activity_id: body.activity_id,
          version,
          build_status: "pending",
          built_at: new Date().toISOString(),
          series: [],
          zones: null,
          stats: null,
          error_message: null,
        }, { onConflict: "user_id,activity_source,activity_id,version" });
      if (upErr) console.warn("[build-activity-chart-cache] upsert pending error:", upErr.message);
    }

    // Fetch raw details and process
    let raw: any[] = [];
    if (source === "garmin") {
      raw = await fetchAllPaged(supabaseAdmin, "garmin_activity_details",
        "heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp",
        { user_id: userId, activity_id: body.activity_id },
        { column: "total_distance_in_meters", ascending: true }
      );
    } else if (source === "polar") {
      raw = await fetchAllPaged(supabaseAdmin, "polar_activity_details",
        "heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp",
        { user_id: userId, activity_id: body.activity_id },
        { column: "total_distance_in_meters", ascending: true }
      );
    } else if (source === "zepp_gpx") {
      raw = await fetchAllPaged(supabaseAdmin, "zepp_gpx_activity_details",
        "heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp",
        { user_id: userId, activity_id: body.activity_id },
        { column: "sample_timestamp", ascending: true }
      );
      // compute missing speeds
      raw.sort((a, b) => new Date(a.sample_timestamp).getTime() - new Date(b.sample_timestamp).getTime());
      for (let i = 1; i < raw.length; i++) {
        const prev = raw[i - 1];
        const cur = raw[i];
        const tPrev = new Date(prev.sample_timestamp).getTime();
        const tCur = new Date(cur.sample_timestamp).getTime();
        const dt = (tCur - tPrev) / 1000;
        const dPrev = Number(prev.total_distance_in_meters ?? 0);
        const dCur = Number(cur.total_distance_in_meters ?? 0);
        const dd = dCur - dPrev;
        if (!cur.speed_meters_per_second || cur.speed_meters_per_second <= 0) {
          cur.speed_meters_per_second = dt > 0 && dd >= 0 ? dd / dt : null;
        }
      }
    } else if (source === "gpx") {
      // First, get the correct activity_id from strava_gpx_activities table
      const { data: stravaGpxActivity, error: stravaGpxErr } = await supabaseAdmin
        .from('strava_gpx_activities')
        .select('activity_id')
        .eq('id', body.activity_id)
        .single();
      
      if (stravaGpxErr || !stravaGpxActivity) {
        throw new Error(`Could not find Strava GPX activity with id ${body.activity_id}`);
      }
      
      const actualActivityId = stravaGpxActivity.activity_id;
      console.log(`[build-activity-chart-cache] Using actual activity_id: ${actualActivityId} for Strava GPX`);
      
      raw = await fetchAllPaged(supabaseAdmin, "strava_gpx_activity_details",
        "heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp",
        { activity_id: actualActivityId },
        { column: "sample_timestamp", ascending: true }
      );
      // compute missing speeds
      raw.sort((a, b) => Number(a.sample_timestamp) - Number(b.sample_timestamp));
      for (let i = 1; i < raw.length; i++) {
        const prev = raw[i - 1];
        const cur = raw[i];
        const tPrev = Number(prev.sample_timestamp);
        const tCur = Number(cur.sample_timestamp);
        const dt = (tCur - tPrev) / 1000;
        const dPrev = Number(prev.total_distance_in_meters ?? 0);
        const dCur = Number(cur.total_distance_in_meters ?? 0);
        const dd = dCur - dPrev;
        if (!cur.speed_meters_per_second || cur.speed_meters_per_second <= 0) {
          cur.speed_meters_per_second = dt > 0 && dd >= 0 ? dd / dt : null;
        }
      }
    } else if (source === "strava") {
      const stravaId = Number(body.activity_id);
      raw = await fetchAllPaged(supabaseAdmin, "strava_activity_details",
        "distance, time_seconds, velocity_smooth, heartrate, time_index",
        { strava_activity_id: stravaId },
        { column: "time_index", ascending: true }
      );
    }

    console.log("[build-activity-chart-cache] raw length:", raw.length);

    // Normalize to SeriesPoint
    let points: SeriesPoint[] = [];
    if (source === "strava") {
      let prevDist = 0;
      let prevTime: number | null = null;
      for (const r of raw) {
        const v = typeof r.velocity_smooth === "number" ? r.velocity_smooth : 0;
        const t: number | null = typeof r.time_seconds === "number" ? r.time_seconds : null;
        let dMeters = typeof r.distance === "number" ? r.distance : prevDist;
        if (r.distance == null && prevTime != null && t != null) {
          const dt = Math.max(0, t - prevTime);
          dMeters = prevDist + v * dt;
        }
        prevDist = dMeters;
        if (t !== null) prevTime = t;

        const speed = v > 0 ? v : null;
        points.push({
          distance_km: (dMeters || 0) / 1000,
          heart_rate: typeof r.heartrate === "number" ? r.heartrate : null,
          pace_min_per_km: calcPaceFromSpeed(speed),
          speed_meters_per_second: speed,
          ts: t != null ? t * 1000 : null,
        });
      }
    } else {
      for (const r of raw) {
        const speed = (typeof r.speed_meters_per_second === "number" && r.speed_meters_per_second > 0)
          ? r.speed_meters_per_second : null;
        const dMeters = Number(r.total_distance_in_meters ?? 0);
        const ts = r.sample_timestamp != null
          ? (String(r.sample_timestamp).length > 10 ? Number(r.sample_timestamp) : Number(r.sample_timestamp) * 1000)
          : null;
        points.push({
          distance_km: dMeters / 1000,
          heart_rate: typeof r.heart_rate === "number" ? r.heart_rate : null,
          pace_min_per_km: calcPaceFromSpeed(speed),
          speed_meters_per_second: speed,
          ts,
        });
      }
    }

    // Filter/sort and cleanup
    points = points
      .filter(p => p.distance_km != null && p.distance_km >= 0)
      .sort((a, b) => a.distance_km - b.distance_km);

    // Keep only points with HR or speed to be useful
    const useful = points.filter(p => (p.heart_rate && p.heart_rate > 0) || (p.speed_meters_per_second && p.speed_meters_per_second > 0));
    const sampled = sampleByDistance(useful, 0.05); // a cada 50m

    // Fetch birth_date for zones
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("birth_date")
      .eq("user_id", userId)
      .maybeSingle();

    const { zones } = calcZonesFromSeries(sampled, null, profile?.birth_date ?? null);

    // Stats simples
    const distanceKm = sampled.length > 0 ? sampled[sampled.length - 1].distance_km : 0;
    const avgHr =
      sampled.length > 0
        ? Math.round(sampled.filter(p => p.heart_rate != null).reduce((s, p) => s + (p.heart_rate || 0), 0) /
            Math.max(1, sampled.filter(p => p.heart_rate != null).length))
        : null;
    const validPaces = sampled.map(p => p.pace_min_per_km).filter((v): v is number => typeof v === "number" && v > 0 && v < 20);
    const avgPace = validPaces.length > 0 ? Number((validPaces.reduce((a, b) => a + b, 0) / validPaces.length).toFixed(2)) : null;

    const payload = {
      series: sampled.map(({ ts, ...rest }) => rest), // não precisamos de ts no frontend
      zones,
      stats: { distance_km: distanceKm, avg_hr: avgHr, avg_pace_min_per_km: avgPace },
      build_status: "ready",
      built_at: new Date().toISOString(),
      error_message: null,
    };

    const { error: upErr2 } = await supabaseAdmin
      .from("activity_chart_cache")
      .upsert(
        {
          user_id: userId,
          activity_source: source,
          activity_id: body.activity_id,
          version,
          ...payload,
        },
        { onConflict: "user_id,activity_source,activity_id,version" }
      );
    if (upErr2) {
      console.error("[build-activity-chart-cache] upsert ready error:", upErr2.message);
      return new Response(JSON.stringify({ error: upErr2.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[build-activity-chart-cache] Done", {
      userId, source, activity_id: body.activity_id, series: sampled.length, zones: zones.length,
    });

    return new Response(JSON.stringify({ ok: true, source, series_points: sampled.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[build-activity-chart-cache] Unexpected error:", e?.message || e);
    // try to mark as error if we can parse inputs
    try {
      const body = (await req.json().catch(() => ({}))) as BuildBody;
      const userId = (await getUserIdFromJWT(req)) ?? body?.user_id ?? null;
      if (userId && body?.activity_id) {
        const source = (body?.activity_source as ActivitySource | undefined) ?? "garmin";
        await createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
          .from("activity_chart_cache")
          .upsert({
            user_id: userId,
            activity_source: source,
            activity_id: body.activity_id,
            version: body.version ?? 1,
            build_status: "error",
            error_message: String(e?.message || e),
            built_at: new Date().toISOString(),
          }, { onConflict: "user_id,activity_source,activity_id,version" });
      }
    } catch (_err) {
      // ignore
    }
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
