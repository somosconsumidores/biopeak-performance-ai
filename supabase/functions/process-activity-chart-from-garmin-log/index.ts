// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";
import { corsHeaders } from "../_shared/cors.ts";

// Helper types
type SeriesPoint = {
  t?: number | null;
  distance_m?: number | null;
  speed_ms?: number | null;
  pace_min_km?: number | null;
  heart_rate?: number | null;
  power_watts?: number | null;
  elevation_m?: number | null;
};

function paceFromSpeed(speed?: number | null): number | null {
  if (!speed || speed <= 0) return null;
  return 1000 / (speed * 60);
}

function safeAvg(nums: (number | null | undefined)[]): number | null {
  const vals = nums.filter((n): n is number => typeof n === "number" && isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function safeMax(nums: (number | null | undefined)[]): number | null {
  const vals = nums.filter((n): n is number => typeof n === "number" && isFinite(n));
  if (!vals.length) return null;
  return Math.max(...vals);
}

function toKm(m?: number | null) {
  return (m ?? 0) / 1000;
}

// Robust extraction of samples from Garmin webhook payloads with different shapes
function extractSamples(payload: any): SeriesPoint[] {
  // 1) Direct samples array of objects
  const tryFields = (obj: any, keys: string[]): any => {
    for (const k of keys) if (obj && obj[k] !== undefined) return obj[k];
    return undefined;
  };

  const normalizeSample = (s: any): SeriesPoint => {
    const speed = tryFields(s, [
      "speed_meters_per_second",
      "speedMetersPerSecond",
      "speed_ms",
      "velocity_smooth",
      "speed",
    ]);
    const dist = tryFields(s, [
      "total_distance_in_meters",
      "totalDistanceInMeters",
      "distance_m",
      "distance",
    ]);
    const hr = tryFields(s, ["heart_rate", "heartRate", "heartrate", "hr"]);
    const pow = tryFields(s, ["power_in_watts", "power", "powerInWatts", "watts"]);
    const ele = tryFields(s, ["elevation_in_meters", "elevation", "elevationInMeters", "altitude"]);
    const ts = tryFields(s, ["sample_timestamp", "ts", "t", "timestamp", "offsetInSeconds"]);

    const speedNum = typeof speed === "number" ? speed : (speed ? Number(speed) : null);
    const distNum = typeof dist === "number" ? dist : (dist ? Number(dist) : null);
    const hrNum = typeof hr === "number" ? hr : (hr ? Number(hr) : null);
    const powNum = typeof pow === "number" ? pow : (pow ? Number(pow) : null);
    const eleNum = typeof ele === "number" ? ele : (ele ? Number(ele) : null);
    const tsNum = typeof ts === "number" ? ts : (ts ? Number(ts) : null);

    return {
      t: Number.isFinite(tsNum) ? tsNum : null,
      distance_m: Number.isFinite(distNum) ? distNum : null,
      speed_ms: Number.isFinite(speedNum) ? speedNum : null,
      pace_min_km: paceFromSpeed(Number.isFinite(speedNum) ? speedNum : null),
      heart_rate: Number.isFinite(hrNum) ? hrNum : null,
      power_watts: Number.isFinite(powNum) ? powNum : null,
      elevation_m: Number.isFinite(eleNum) ? eleNum : null,
    } as SeriesPoint;
  };

  if (Array.isArray(payload?.samples)) {
    return payload.samples.map(normalizeSample);
  }

  // 2) samples as object of arrays -> zip
  const sampleObj = payload?.samples;
  if (sampleObj && typeof sampleObj === "object" && !Array.isArray(sampleObj)) {
    const keys = [
      "speed_meters_per_second",
      "speedMetersPerSecond",
      "speed_ms",
      "velocity_smooth",
      "speed",
      "total_distance_in_meters",
      "totalDistanceInMeters",
      "distance_m",
      "distance",
      "heart_rate",
      "heartRate",
      "heartrate",
      "hr",
      "power_in_watts",
      "power",
      "powerInWatts",
      "watts",
      "elevation_in_meters",
      "elevation",
      "elevationInMeters",
      "altitude",
      "sample_timestamp",
      "ts",
      "t",
      "timestamp",
      "offsetInSeconds",
    ];
    const arrays: Record<string, any[]> = {};
    let maxLen = 0;
    for (const k of keys) {
      if (Array.isArray(sampleObj[k])) {
        arrays[k] = sampleObj[k];
        maxLen = Math.max(maxLen, sampleObj[k].length);
      }
    }
    if (maxLen > 0) {
      const out: SeriesPoint[] = [];
      for (let i = 0; i < maxLen; i++) {
        const s: any = {};
        for (const [k, arr] of Object.entries(arrays)) s[k] = arr[i];
        out.push(normalizeSample(s));
      }
      return out;
    }
  }

  // 3) activityDetails structure (arrays per metric)
  const d = payload?.activityDetails || payload?.activity_detail || payload?.details;
  if (d && typeof d === "object") {
    const arrays: Record<string, any[]> = {};
    let maxLen = 0;
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v)) { arrays[k] = v as any[]; maxLen = Math.max(maxLen, (v as any[]).length); }
    }
    if (maxLen > 0) {
      const out: SeriesPoint[] = [];
      for (let i = 0; i < maxLen; i++) {
        const s: any = {
          speed: arrays["speed"]?.[i] ?? arrays["speedMetersPerSecond"]?.[i],
          distance: arrays["distance"]?.[i] ?? arrays["totalDistanceInMeters"]?.[i],
          heartRate: arrays["heartRate"]?.[i] ?? arrays["heartrate"]?.[i],
          power: arrays["power"]?.[i] ?? arrays["powerInWatts"]?.[i],
          elevation: arrays["elevation"]?.[i] ?? arrays["elevationInMeters"]?.[i],
          timestamp: arrays["timestamp"]?.[i] ?? arrays["offsetInSeconds"]?.[i],
        };
        out.push(normalizeSample(s));
      }
      return out;
    }
  }

  // Nothing found
  return [];
}

// Distance-anchored sampling: ensure anchors at each km and cap to ~2000 points
function distanceAnchoredSample(series: SeriesPoint[], cap = 2000): SeriesPoint[] {
  if (!series.length) return [];

  // sort by distance when available, else by t
  const sorted = [...series].sort((a, b) => {
    const ad = a.distance_m ?? -1, bd = b.distance_m ?? -1;
    if (ad !== -1 && bd !== -1) return ad - bd;
    const at = a.t ?? 0, bt = b.t ?? 0; return at - bt;
  });

  // compute filled cumulative distance if missing by monotonic fill
  let lastDist = 0;
  for (const p of sorted) {
    if (p.distance_m == null || !isFinite(p.distance_m)) {
      p.distance_m = lastDist; // keep previous
    } else {
      lastDist = p.distance_m;
    }
  }

  const totalDist = sorted[sorted.length - 1].distance_m || 0;
  const totalKm = Math.max(1, Math.floor(totalDist / 1000));

  const anchors: SeriesPoint[] = [];
  let kmIdx = 1;
  let cursor = 0;
  while (kmIdx <= totalKm && cursor < sorted.length) {
    const target = kmIdx * 1000;
    // find first point with distance >= target
    while (cursor < sorted.length && (sorted[cursor].distance_m ?? 0) < target) cursor++;
    if (cursor < sorted.length) anchors.push(sorted[cursor]);
    kmIdx++;
  }

  // Always include first & last
  if (sorted.length) {
    anchors.unshift(sorted[0]);
    anchors.push(sorted[sorted.length - 1]);
  }

  // If still above cap, thin uniformly
  const unique = dedupeByIndex(anchors);
  if (unique.length <= cap) return unique;

  const step = Math.ceil(unique.length / cap);
  const sampled: SeriesPoint[] = [];
  for (let i = 0; i < unique.length; i += step) sampled.push(unique[i]);
  if (sampled[sampled.length - 1] !== unique[unique.length - 1]) sampled.push(unique[unique.length - 1]);
  return sampled;
}

function dedupeByIndex(points: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let lastKey = "";
  for (const p of points) {
    const key = `${p.t ?? ''}|${p.distance_m ?? ''}`;
    if (key !== lastKey) out.push(p);
    lastKey = key;
  }
  return out;
}

// Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm
// Preserves visually important points (peaks, valleys, trends)
function lttbDownsample(data: SeriesPoint[], threshold: number): SeriesPoint[] {
  if (data.length <= threshold || threshold <= 2) return data;

  const sampled: SeriesPoint[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  
  // Always include first point
  sampled.push(data[0]);
  
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    
    let avgX = 0, avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
      avgX += j;
      avgY += data[j].pace_min_km || data[j].heart_rate || 0;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;
    
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    
    const pointA = sampled[sampled.length - 1];
    const pointAX = sampled.length - 1;
    const pointAY = pointA.pace_min_km || pointA.heart_rate || 0;
    
    let maxArea = -1;
    let maxAreaPoint: SeriesPoint = data[rangeOffs];
    
    for (let j = rangeOffs; j < rangeTo && j < data.length; j++) {
      const pointY = data[j].pace_min_km || data[j].heart_rate || 0;
      const area = Math.abs((pointAX - avgX) * (pointY - pointAY) - (pointAX - j) * (avgY - pointAY));
      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = data[j];
      }
    }
    
    sampled.push(maxAreaPoint);
  }
  
  // Always include last point
  sampled.push(data[data.length - 1]);
  
  return sampled;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    console.info("[process-activity-chart] health-check", { url: req.url });
    return new Response(
      JSON.stringify({ ok: true, name: "process-activity-chart-from-garmin-log", ts: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    console.info("[process-activity-chart] request start", { method: req.method, url: req.url });
    const url = new URL(req.url);
    const { webhook_log_id, activity_id, user_id, full_precision } = await req.json().catch(() => ({}));
    console.info("[process-activity-chart] input", { has_webhook_log_id: !!webhook_log_id, activity_id, user_id, full_precision });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Timeout de 60 segundos para processar payloads grandes (>1MB)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(60000), // 60 segundos
          });
        },
      },
    });

    let payload: any = null;
    let logUserId: string | null = null;
    let srcActivityId: string | null = null;

    if (webhook_log_id) {
      const { data: logRow, error: logErr } = await supabase
        .from("garmin_webhook_logs")
        .select("id, user_id, webhook_type, payload")
        .eq("id", webhook_log_id)
        .single();
      if (logErr || !logRow) throw new Error(`Log not found: ${logErr?.message}`);

      const type = (logRow.webhook_type || '').toLowerCase();
      if (!type.includes("activity") || !type.includes("detail")) {
        return new Response(
          JSON.stringify({ success: false, message: "Not an activity details log" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      payload = logRow.payload;
      logUserId = logRow.user_id;
      // Try to get activity id from payload common fields
      srcActivityId = payload?.activityId?.toString() || payload?.summaryId?.toString() || payload?.activity_id?.toString() || null;
    } else if (activity_id && user_id) {
      // Fallback path: query the latest matching log by activity id
      const { data: logs, error } = await supabase
        .from("garmin_webhook_logs")
        .select("id, user_id, payload, webhook_type, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const found = (logs || []).find(l => {
        const pid = l.payload?.activityId?.toString() || l.payload?.summaryId?.toString() || l.payload?.activity_id?.toString();
        return pid === activity_id && (l.webhook_type || '').toLowerCase().includes("detail");
      });
      if (!found) throw new Error("No matching activity_details log found");
      payload = found.payload; logUserId = found.user_id; srcActivityId = activity_id;
    } else {
      throw new Error("Missing webhook_log_id or (activity_id + user_id)");
    }

    // Determine user and activity
    const userId = logUserId || user_id;
    const activityId = srcActivityId || activity_id || "unknown";

    // Extract series from payload
    let sampleSource = 'payload';
    let rawSeries: SeriesPoint[] = extractSamples(payload);

    // Fallback: if payload doesn't contain samples (typical for notifications),
    // try to build from garmin_activity_details table
    if ((!rawSeries || rawSeries.length === 0) && userId && activityId) {
      // 1) Try row-per-sample data
      const { data: rows, error: rowsErr } = await supabase
        .from("garmin_activity_details")
        .select("sample_timestamp, total_distance_in_meters, speed_meters_per_second, heart_rate, power_in_watts, elevation_in_meters")
        .eq("user_id", userId)
        .eq("activity_id", activityId)
        .order("sample_timestamp", { ascending: true })
        .limit(200000);

      if (!rowsErr && rows && rows.length > 0) {
        rawSeries = rows.map((r: any) => ({
          t: typeof r.sample_timestamp === "number" ? r.sample_timestamp : (r.sample_timestamp ? Number(r.sample_timestamp) : null),
          distance_m: r.total_distance_in_meters ?? null,
          speed_ms: r.speed_meters_per_second ?? null,
          pace_min_km: paceFromSpeed(r.speed_meters_per_second ?? null),
          heart_rate: r.heart_rate ?? null,
          power_watts: r.power_in_watts ?? null,
          elevation_m: r.elevation_in_meters ?? null,
        }));
        sampleSource = 'details_rows';
      } else {
        // 2) Try JSONB samples stored in a details row
        const { data: jRows, error: jErr } = await supabase
          .from("garmin_activity_details")
          .select("samples")
          .eq("user_id", userId)
          .eq("activity_id", activityId)
          .not("samples", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!jErr && jRows && jRows.length > 0 && jRows[0]?.samples) {
          rawSeries = extractSamples({ samples: jRows[0].samples });
          sampleSource = 'details_json';
        }
      }
    }

    if (!rawSeries || rawSeries.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No samples found (payload or database)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply sampling logic: default to full precision unless explicitly disabled
    let sampled: SeriesPoint[];
    const useFullPrecision = full_precision !== false;
    if (useFullPrecision) {
      // Use all points, only deduplicate
      sampled = dedupeByIndex(rawSeries);
      // Safety net: if too many points (>10k), apply LTTB downsampling to 5k
      if (sampled.length > 10000) {
        console.warn(`[process-activity-chart] Large dataset (${sampled.length} points), applying LTTB to 5000 points`);
        sampled = lttbDownsample(sampled, 5000);
      }
    } else {
      // Distance-anchored sampling (explicit opt-out)
      sampled = distanceAnchoredSample(rawSeries, 2000);
    }

    // Derive stats
    const durationSeconds = (() => {
      const ts = sampled.map(p => p.t ?? null).filter((x): x is number => typeof x === 'number');
      if (ts.length >= 2) return Math.max(...ts) - Math.min(...ts);
      return null;
    })();

    const totalDistance = sampled[sampled.length - 1].distance_m ?? null;
    const avgSpeed = safeAvg(sampled.map(p => p.speed_ms ?? null));
    const avgPace = paceFromSpeed(avgSpeed);
    const avgHr = safeAvg(sampled.map(p => p.heart_rate ?? null));
    const maxHr = safeMax(sampled.map(p => p.heart_rate ?? null));

    // Clean previous entries
    await supabase
      .from("activity_chart_data")
      .delete()
      .eq("user_id", userId)
      .eq("activity_source", "garmin")
      .eq("activity_id", activityId);

    const insertPayload = {
      user_id: userId,
      activity_id: activityId,
      activity_source: "garmin",
      series_data: sampled,
      data_points_count: sampled.length,
      duration_seconds: durationSeconds,
      total_distance_meters: totalDistance,
      avg_speed_ms: avgSpeed,
      avg_pace_min_km: avgPace,
      avg_heart_rate: avgHr ? Math.round(avgHr) : null,
      max_heart_rate: maxHr ? Math.round(maxHr) : null,
    } as any;

const { error: insErr } = await supabase.from("activity_chart_data").insert(insertPayload);
if (insErr) throw insErr;

// Build and upsert GPS coordinates prioritizing payload (since garmin_activity_details is deprecated)
const extractCoordsFromPayload = (p: any): [number, number][] => {
  const out: [number, number][] = [];
  const push = (lat: any, lon: any) => {
    const la = typeof lat === 'number' ? lat : Number(lat);
    const lo = typeof lon === 'number' ? lon : Number(lon);
    if (Number.isFinite(la) && Number.isFinite(lo)) out.push([la, lo]);
  };

  // 1) Direct array of samples
  if (Array.isArray(p?.samples)) {
    for (const s of p.samples) push(s?.latitudeInDegree ?? s?.latitude, s?.longitudeInDegree ?? s?.longitude);
  }

  // 2) activityDetails: [{ summary, samples: [...] }]
  if (Array.isArray(p?.activityDetails)) {
    for (const d of p.activityDetails) {
      if (Array.isArray(d?.samples)) {
        for (const s of d.samples) push(s?.latitudeInDegree ?? s?.latitude, s?.longitudeInDegree ?? s?.longitude);
      }
      // Also support arrays at details level
      const latArr = d?.latitudeInDegree || d?.latitude;
      const lonArr = d?.longitudeInDegree || d?.longitude;
      if (Array.isArray(latArr) && Array.isArray(lonArr)) {
        const n = Math.min(latArr.length, lonArr.length);
        for (let i = 0; i < n; i++) push(latArr[i], lonArr[i]);
      }
    }
  }

  // 3) activityDetails as object with arrays
  const det = p?.activityDetails || p?.details;
  if (det && !Array.isArray(det) && typeof det === 'object') {
    const latArr = det?.latitudeInDegree || det?.latitude;
    const lonArr = det?.longitudeInDegree || det?.longitude;
    if (Array.isArray(latArr) && Array.isArray(lonArr)) {
      const n = Math.min(latArr.length, lonArr.length);
      for (let i = 0; i < n; i++) push(latArr[i], lonArr[i]);
    }
  }

  // 4) samples as object of arrays
  const samplesObj = p?.samples;
  if (samplesObj && typeof samplesObj === 'object' && !Array.isArray(samplesObj)) {
    const latArr = samplesObj?.latitudeInDegree || samplesObj?.latitude;
    const lonArr = samplesObj?.longitudeInDegree || samplesObj?.longitude;
    if (Array.isArray(latArr) && Array.isArray(lonArr)) {
      const n = Math.min(latArr.length, lonArr.length);
      for (let i = 0; i < n; i++) push(latArr[i], lonArr[i]);
    }
  }

  return out;
};

let coords: [number, number][] = extractCoordsFromPayload(payload);

if (!coords || coords.length === 0) {
  // Fallback to legacy table if payload had no GPS
  const { data: coordRows, error: coordErr } = await supabase
    .from('garmin_activity_details')
    .select('latitude_in_degree, longitude_in_degree')
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .order('sample_timestamp', { ascending: true })
    .limit(200000);
  if (coordErr) console.warn('[process-activity-chart] coord legacy select error', coordErr.message);
  if (coordRows && coordRows.length > 0) {
    coords = coordRows
      .map((r: any) => [r.latitude_in_degree, r.longitude_in_degree] as [number, number])
      .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
  }
}

if (coords && coords.length > 0) {
  const total_points = coords.length;
  let coordsSampled = coords;
  if (coords.length > 2000) {
    const step = Math.ceil(coords.length / 2000);
    coordsSampled = [];
    for (let i = 0; i < coords.length; i += step) coordsSampled.push(coords[i]);
    if (coordsSampled[coordsSampled.length - 1] !== coords[coords.length - 1]) coordsSampled.push(coords[coords.length - 1]);
  }

  const lats = coordsSampled.map(c => c[0]);
  const lons = coordsSampled.map(c => c[1]);
  const bounds: [[number, number],[number, number]] = [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)]
  ];

  // Upsert into activity_coordinates
  await supabase
    .from('activity_coordinates')
    .delete()
    .eq('user_id', userId)
    .eq('activity_source', 'garmin')
    .eq('activity_id', activityId);

  const { error: coordInsErr } = await supabase.from('activity_coordinates').insert({
    user_id: userId,
    activity_id: activityId,
    activity_source: 'garmin',
    coordinates: coordsSampled,
    total_points,
    sampled_points: coordsSampled.length,
    starting_latitude: coordsSampled[0]?.[0] ?? null,
    starting_longitude: coordsSampled[0]?.[1] ?? null,
    bounding_box: bounds,
  });
  if (coordInsErr) console.warn('[process-activity-chart] coord insert error', coordInsErr.message);
}

console.info("[process-activity-chart] inserted", { rows: 1, points: sampled.length, userId, activityId });

return new Response(
  JSON.stringify({ success: true, inserted: sampled.length, activity_id: activityId, user_id: userId, source: sampleSource }),
  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
  } catch (e: any) {
    console.error("Error in process-activity-chart-from-garmin-log:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
