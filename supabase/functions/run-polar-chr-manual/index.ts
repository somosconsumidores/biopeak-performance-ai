import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isValidDate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}:\d{2}$/.test(t);
}

function isValidHeartRate(hr: number): boolean {
  return Number.isFinite(hr) && hr >= 20 && hr <= 250;
}

function toTimestamp(dateStr: string, timeStr: string): string | null {
  if (!isValidTime(timeStr)) return null;
  const iso = `${dateStr}T${timeStr}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function getServiceClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

interface ManualCHRRequestBody {
  access_token: string;
  date: string;
  polar_user_id?: number | null;
  user_id?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    const body = (await req.json().catch(() => ({}))) as ManualCHRRequestBody;
    console.log("[run-polar-chr-manual] Body:", body);

    const accessToken = body.access_token;
    let date = body.date;
    let userId = body.user_id ?? null;
    let polarUserId: number | null = typeof body.polar_user_id === "number" ? body.polar_user_id : null;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "access_token is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!isValidDate(date)) {
      console.warn("[run-polar-chr-manual] Invalid or missing date. Using today.");
      date = toDateOnly(new Date());
    }

    // Fetch CHR from Polar AccessLink
    const apiUrl = `https://www.polaraccesslink.com/v3/users/continuous-heart-rate/${date}`;
    console.log("[run-polar-chr-manual] Fetch:", apiUrl);

    const resp = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const rateLimitReset = resp.headers.get("RateLimit-Reset");
    const rawText = await resp.text();
    console.log("[run-polar-chr-manual] Status:", resp.status, "Reset:", rateLimitReset, "Body:", rawText);

    if (resp.status === 404) {
      return new Response(
        JSON.stringify({
          message: "CHR data not available yet for this date. Try later.",
          status: 404,
          rateLimitReset,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (resp.status === 401 || resp.status === 403) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized to fetch CHR: token invalid/revoked or missing scopes",
          status: resp.status,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limited by Polar", status: 429, rateLimitReset }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: `Unexpected response ${resp.status}`, body: rawText }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const data = JSON.parse(rawText || "{}");
    const samples = data?.heart_rate_samples ?? data?.samples ?? [];
    const calendarDate: string = data?.date || date;
    const resolvedPolarUserId: number | null =
      (typeof data?.polar_user === "number" ? data.polar_user : null) ?? polarUserId ?? null;

    console.log("[run-polar-chr-manual] Samples count:", samples?.length || 0);

    // Try resolve user_id if missing and we have polar_user_id
    if (!userId && resolvedPolarUserId != null) {
      try {
        const { data: userIdData, error: userIdErr } = await supabase
          .rpc("find_user_by_polar_id", { polar_user_id_param: resolvedPolarUserId });
        if (userIdErr) {
          console.warn("[run-polar-chr-manual] find_user_by_polar_id error:", userIdErr.message);
        } else {
          userId = userIdData ?? null;
        }
      } catch (e) {
        console.warn("[run-polar-chr-manual] RPC resolve user error:", e);
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "Cannot resolve user_id. Provide user_id or a polar_user_id mapped to a user.",
          date: calendarDate,
          polar_user_id: resolvedPolarUserId,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!Array.isArray(samples) || samples.length === 0) {
      return new Response(
        JSON.stringify({ message: "No samples to upsert", date: calendarDate, polar_user_id: resolvedPolarUserId }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const allSamples = Array.isArray(samples) ? samples : [];
    const validRows = (allSamples as Array<any>)
      .filter(
        (s) =>
          typeof s?.heart_rate === "number" &&
          typeof s?.sample_time === "string" &&
          isValidTime(s.sample_time) &&
          isValidHeartRate(s.heart_rate),
      )
      .map((s) => ({
        user_id: userId,
        polar_user_id: resolvedPolarUserId,
        calendar_date: calendarDate,
        sample_time: s.sample_time,
        sample_timestamp: toTimestamp(calendarDate, s.sample_time),
        heart_rate: Math.round(s.heart_rate as number),
      }));

    const ignored = (allSamples as Array<any>).length - validRows.length;

    console.log(
      "[run-polar-chr-manual] Valid:",
      validRows.length,
      "Ignored:",
      ignored,
      "Date:",
      calendarDate,
      "PolarUserId:",
      resolvedPolarUserId,
      "User:",
      userId,
    );

    if (validRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No valid samples in payload", date: calendarDate, ignored_samples: ignored }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { error: upsertError } = await supabase
      .from("polar_continuous_hr_samples")
      .upsert(validRows, { onConflict: "user_id,calendar_date,sample_time" });

    if (upsertError) {
      console.error("[run-polar-chr-manual] Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        message: "CHR samples synced",
        date: calendarDate,
        inserted_or_updated: validRows.length,
        ignored_samples: ignored,
        rate_limit_reset: rateLimitReset,
        polar_user_id: resolvedPolarUserId,
        user_id: userId,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e: any) {
    console.error("[run-polar-chr-manual] Unexpected error:", e?.message || e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
