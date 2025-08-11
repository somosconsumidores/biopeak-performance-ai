// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReprocessOptions {
  webhook_id?: string;
  user_id?: string;
  hours_back?: number;
  webhook_type?: string; // exercise | sleep | continuous_heart_rate | sleep_wise_circadian_bedtime | sleep_wise_alertness
  dry_run?: boolean;
  limit?: number;
}

interface PolarWebhookLog {
  id: string;
  user_id: string | null;
  polar_user_id?: number | null;
  webhook_type: string;
  status: string;
  created_at: string;
  processed_at?: string | null;
  payload: any;
}

interface WebhookRecoveryResult {
  message: string;
  failed_webhooks_found: number;
  reprocessed_successfully: number;
  reprocessed_with_errors: number;
  dry_run: boolean;
  failed_webhooks?: Array<{
    id: string;
    user_id: string | null;
    webhook_type: string;
    created_at: string;
  }>;
  reprocess_results?: Array<{
    webhook_id: string;
    success: boolean;
    error?: string;
  }>;
}

function getServiceClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveUserIdForPolar(supabase: ReturnType<typeof getServiceClient>, log: PolarWebhookLog): Promise<string | null> {
  if (log.user_id) return log.user_id;
  const payloadUserId = log?.payload?.user_id;
  if (payloadUserId) return payloadUserId;

  const polarId = log.polar_user_id ?? log?.payload?.user_id ?? log?.payload?.polar_user_id ?? log?.payload?.user?.user_id;
  if (polarId == null) return null;

  const { data, error } = await supabase.rpc("find_user_by_polar_id", { polar_user_id_param: Number(polarId) });
  if (error) {
    console.error("[reprocess-polar-webhooks] find_user_by_polar_id error:", error);
    return null;
  }
  return data as string | null;
}

async function handlePolarEvent(
  supabase: ReturnType<typeof getServiceClient>,
  log: PolarWebhookLog,
  userId: string | null,
): Promise<void> {
  const type = (log.webhook_type || log?.payload?.event || "").toLowerCase();

  if (!userId) throw new Error("Unable to resolve user_id for log " + log.id);

  if (type === "exercise") {
    // Fetch active Polar access token for this user
    const { data: tokenData, error: tokenError } = await supabase
      .from("polar_tokens")
      .select("access_token, x_user_id, polar_user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData?.access_token) {
      throw new Error(`No active Polar access token found for user ${userId}`);
    }

    const polarUserId =
      (typeof tokenData.x_user_id === "number" ? tokenData.x_user_id : null) ??
      (tokenData.polar_user_id ? Number(tokenData.polar_user_id) : null);

    const { error } = await supabase.functions.invoke("sync-polar-activities", {
      body: {
        user_id: userId,
        polar_user_id: polarUserId,
        access_token: tokenData.access_token,
        webhook_payload: log.payload ?? {},
      },
    });
    if (error) throw new Error(`sync-polar-activities failed: ${error.message || JSON.stringify(error)}`);
    return;
  }

  if (type === "sleep") {
    // Fetch active Polar access token for this user
    const { data: tokenData, error: tokenError } = await supabase
      .from("polar_tokens")
      .select("access_token, x_user_id, polar_user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData?.access_token) {
      throw new Error(`No active Polar access token found for user ${userId}`);
    }

    const polarUserId =
      (typeof tokenData.x_user_id === "number" ? tokenData.x_user_id : null) ??
      (tokenData.polar_user_id ? Number(tokenData.polar_user_id) : null);

    const { error } = await supabase.functions.invoke("sync-polar-sleep", {
      body: {
        user_id: userId,
        polar_user_id: polarUserId,
        access_token: tokenData.access_token,
        webhook_payload: log.payload ?? {},
      },
    });
    if (error) throw new Error(`sync-polar-sleep failed: ${error.message || JSON.stringify(error)}`);
    return;
  }

  if (type === "continuous_heart_rate") {
    const insertPayload = {
      user_id: userId,
      polar_user_id: log.polar_user_id ?? log?.payload?.user_id ?? null,
      payload: log.payload ?? {},
      event_date: log?.payload?.date ? new Date(log.payload.date) : new Date(),
      window_start: log?.payload?.window_start ? new Date(log.payload.window_start) : null,
      window_end: log?.payload?.window_end ? new Date(log.payload.window_end) : null,
    };
    const { error } = await supabase.from("polar_continuous_hr_events").insert([insertPayload]);
    if (error) throw new Error(`insert polar_continuous_hr_events failed: ${error.message}`);
    return;
  }

  if (type === "sleep_wise_alertness") {
    const calendarDate = log?.payload?.calendar_date || log?.payload?.date || new Date().toISOString().slice(0, 10);
    const predictions = log?.payload?.predictions ?? [];
    const insertPayload = {
      user_id: userId,
      polar_user_id: log.polar_user_id ?? log?.payload?.user_id ?? null,
      calendar_date: calendarDate,
      payload: log.payload ?? {},
      predictions,
    };
    const { error } = await supabase.from("polar_sleepwise_alertness").insert([insertPayload]);
    if (error) throw new Error(`insert polar_sleepwise_alertness failed: ${error.message}`);
    return;
  }

  if (type === "sleep_wise_circadian_bedtime") {
    const calendarDate = log?.payload?.calendar_date || log?.payload?.date || new Date().toISOString().slice(0, 10);
    const insertPayload: Record<string, any> = {
      user_id: userId,
      polar_user_id: log.polar_user_id ?? log?.payload?.user_id ?? null,
      calendar_date: calendarDate,
      payload: log.payload ?? {},
    };
    const { error } = await supabase.from("polar_sleepwise_bedtime").insert([insertPayload]);
    if (error) throw new Error(`insert polar_sleepwise_bedtime failed: ${error.message}`);
    return;
  }

  throw new Error(`Unsupported webhook_type for Polar reprocess: ${type}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    const options = (await req.json().catch(() => ({}))) as ReprocessOptions;
    const {
      webhook_id,
      user_id,
      hours_back,
      webhook_type,
      dry_run = false,
      limit = 100,
    } = options || {};

    console.log("[reprocess-polar-webhooks] Start with options:", options);

    let query = supabase
      .from("polar_webhook_logs")
      .select("id, user_id, webhook_type, status, created_at, processed_at, payload, polar_user_id")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (webhook_id) query = query.eq("id", webhook_id);
    if (user_id) query = query.eq("user_id", user_id);
    if (webhook_type) query = query.eq("webhook_type", webhook_type);
    if (hours_back && hours_back > 0) {
      const since = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error("[reprocess-polar-webhooks] Query error:", logsError);
      return new Response(
        JSON.stringify({ message: "Erro ao buscar logs", error: logsError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const failedLogs = (logs || []) as PolarWebhookLog[];

    if (dry_run) {
      const result: WebhookRecoveryResult = {
        message: "Dry run concluído",
        dry_run: true,
        failed_webhooks_found: failedLogs.length,
        reprocessed_successfully: 0,
        reprocessed_with_errors: 0,
        failed_webhooks: failedLogs.map((l) => ({
          id: l.id,
          user_id: l.user_id,
          webhook_type: l.webhook_type,
          created_at: l.created_at,
        })),
      };
      console.log("[reprocess-polar-webhooks] Dry-run result:", result);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const reprocessResults: WebhookRecoveryResult["reprocess_results"] = [];

    for (const log of failedLogs) {
      try {
        const userId = await resolveUserIdForPolar(supabase, log);
        await handlePolarEvent(supabase, log, userId);

        const { error: updError } = await supabase
          .from("polar_webhook_logs")
          .update({ status: "success", processed_at: new Date().toISOString(), error_message: null })
          .eq("id", log.id);

        if (updError) {
          console.warn("[reprocess-polar-webhooks] Could not update log status:", updError);
        }

        successCount++;
        reprocessResults?.push({ webhook_id: log.id, success: true });
      } catch (err: any) {
        console.error(`[reprocess-polar-webhooks] Reprocess error for ${log.id}:`, err?.message || err);

        const { error: updError } = await supabase
          .from("polar_webhook_logs")
          .update({ error_message: String(err?.message || err), processed_at: new Date().toISOString() })
          .eq("id", log.id);
        if (updError) {
          console.warn("[reprocess-polar-webhooks] Could not update error message:", updError);
        }

        errorCount++;
        reprocessResults?.push({ webhook_id: log.id, success: false, error: String(err?.message || err) });
      }
    }

    const result: WebhookRecoveryResult = {
      message: `Reprocessamento concluído: ${successCount} sucesso(s), ${errorCount} erro(s)`,
      dry_run: false,
      failed_webhooks_found: failedLogs.length,
      reprocessed_successfully: successCount,
      reprocessed_with_errors: errorCount,
      reprocess_results: reprocessResults,
    };

    console.log("[reprocess-polar-webhooks] Done:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("[reprocess-polar-webhooks] Unexpected error:", e?.message || e);
    return new Response(JSON.stringify({ message: "Erro inesperado", error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
