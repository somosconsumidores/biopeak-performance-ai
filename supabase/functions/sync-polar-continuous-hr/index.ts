
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

// CORS para chamadas públicas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utilidades
function parseDateFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    // Esperado algo como .../continuous-heart-rate/2025-08-10
    const parts = url.split("/");
    const last = parts[parts.length - 1];
    const m = /^(\d{4}-\d{2}-\d{2})$/.exec(last);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
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

interface SyncRequestBody {
  user_id: string;
  polar_user_id?: number | null;
  access_token?: string | null;
  date?: string | null;
  url?: string | null;
  webhook_payload?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequestBody;
    console.log("[sync-polar-continuous-hr] Body:", body);

    const userId = body.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1) Resolver access_token e polar_user_id, se necessário
    let accessToken = body.access_token || null;
    let polarUserId = typeof body.polar_user_id === "number" ? body.polar_user_id : null;

    if (!accessToken) {
      const { data: tokenData, error: tokenError } = await supabase
        .from("polar_tokens")
        .select("access_token, x_user_id, polar_user_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error("[sync-polar-continuous-hr] Token not found:", tokenError);
        return new Response(JSON.stringify({ error: "No active Polar access token for user" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      accessToken = tokenData.access_token;
      polarUserId =
        polarUserId ??
        (typeof tokenData.x_user_id === "number" ? tokenData.x_user_id : null) ??
        (tokenData.polar_user_id ? Number(tokenData.polar_user_id) : null);
    }

    // 2) Determinar a data
    let date =
      body.date ||
      parseDateFromUrl(body.url || body.webhook_payload?.url) ||
      body.webhook_payload?.date ||
      (body.webhook_payload?.timestamp ? toDateOnly(new Date(body.webhook_payload.timestamp)) : null) ||
      toDateOnly(new Date());

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn("[sync-polar-continuous-hr] Invalid or missing date. Using today.");
      date = toDateOnly(new Date());
    }

    // 3) Buscar CHR no AccessLink
    const apiUrl = `https://www.polaraccesslink.com/v3/users/continuous-heart-rate/${date}`;
    console.log("[sync-polar-continuous-hr] Fetch:", apiUrl);

    const resp = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const rateLimitReset = resp.headers.get("RateLimit-Reset");
    const rawText = await resp.text();
    console.log("[sync-polar-continuous-hr] Status:", resp.status, "Reset:", rateLimitReset, "Body:", rawText);

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
        JSON.stringify({
          error: "Rate limited by Polar",
          status: 429,
          rateLimitReset,
        }),
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
    const resolvedPolarUserId =
      (typeof data?.polar_user === "number" ? data.polar_user : null) ?? polarUserId ?? null;

    console.log("[sync-polar-continuous-hr] Samples count:", samples?.length || 0);

    if (!Array.isArray(samples) || samples.length === 0) {
      return new Response(
        JSON.stringify({ message: "No samples to upsert", date: calendarDate }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // 4) Persist with idempotent upsert, with validation and timestamps
    const allSamples = Array.isArray(samples) ? samples : [];
    const validRows = (allSamples as Array<any>)
      .filter((s) => typeof s?.heart_rate === "number" && typeof s?.sample_time === "string" && isValidTime(s.sample_time) && isValidHeartRate(s.heart_rate))
      .map((s) => ({
        user_id: userId,
        polar_user_id: resolvedPolarUserId,
        calendar_date: calendarDate,
        sample_time: s.sample_time,
        sample_timestamp: toTimestamp(calendarDate, s.sample_time),
        heart_rate: Math.round(s.heart_rate as number),
      }));

    const ignored = (allSamples as Array<any>).length - validRows.length;

    console.log("[sync-polar-continuous-hr] Valid:", validRows.length, "Ignored:", ignored, "Date:", calendarDate, "PolarUserId:", resolvedPolarUserId);

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
      console.error("[sync-polar-continuous-hr] Upsert error:", upsertError);
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
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e: any) {
    console.error("[sync-polar-continuous-hr] Unexpected error:", e?.message || e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
