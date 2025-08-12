import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReprocessOptions {
  webhook_id?: string;
  user_id?: string;
  hours_back?: number; // default 72h
  limit?: number; // default 50
  dry_run?: boolean; // default false
  status?: ("failed" | "received" | "processing" | "success")[]; // default ["failed"]
}

interface PolarWebhookLog {
  id: string;
  user_id: string | null;
  polar_user_id: number | null;
  webhook_type: string;
  payload: any;
  status: string | null;
  created_at: string | null;
}

interface ProcessResult {
  id: string;
  status: "success" | "skipped" | "error";
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body: ReprocessOptions = await req.json().catch(() => ({}));
    const {
      webhook_id,
      user_id,
      hours_back = 72,
      limit = 50,
      dry_run = false,
      status = ["failed"],
    } = body || {};

    console.log("[reprocess-polar-sleep] Starting reprocess with options:", body || {});

    // Build base query for Polar sleep webhooks
    let query = supabase
      .from("polar_webhook_logs")
      .select("id,user_id,polar_user_id,webhook_type,payload,status,created_at")
      .eq("webhook_type", "sleep");

    if (webhook_id) query = query.eq("id", webhook_id);
    if (user_id) query = query.eq("user_id", user_id);

    // Status filter
    if (status && status.length > 0) {
      query = query.in("status", status);
    }

    // Time window
    if (hours_back && hours_back > 0) {
      const since = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }

    query = query.order("created_at", { ascending: false }).limit(limit);

    const { data: logs, error: logsError } = await query;
    if (logsError) {
      console.error("[reprocess-polar-sleep] Error fetching logs:", logsError);
      return new Response(JSON.stringify({ success: false, error: logsError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const toProcess = (logs || []) as PolarWebhookLog[];

    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          count: toProcess.length,
          ids: toProcess.map((l) => l.id),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const results: ProcessResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Helper to resolve numeric Polar user ID from log
    const resolvePolarUserId = (log: PolarWebhookLog): number | null => {
      const fromColumn = log.polar_user_id;
      const fromPayload = (log as any)?.payload?.user_id ?? (log as any)?.payload?.userId;
      const val = fromColumn ?? fromPayload;
      const num = val != null ? Number(val) : null;
      return Number.isFinite(num as number) ? (num as number) : null;
    };

    for (const log of toProcess) {
      const xUserId = resolvePolarUserId(log);
      const url: string | undefined = (log as any)?.payload?.url;

      if (!xUserId) {
        const msg = "Missing polar_user_id in log payload";
        console.warn(`[reprocess-polar-sleep] ${msg} for ${log.id}`);
        results.push({ id: log.id, status: "skipped", message: msg });
        skippedCount++;
        continue;
      }
      if (!url) {
        const msg = "Missing sleep URL in payload";
        console.warn(`[reprocess-polar-sleep] ${msg} for ${log.id}`);
        results.push({ id: log.id, status: "skipped", message: msg });
        skippedCount++;
        continue;
      }

      // Find active Polar token by x_user_id
      const { data: tokenData, error: tokenErr } = await supabase
        .from("polar_tokens")
        .select("user_id, access_token, x_user_id, polar_user_id, is_active")
        .eq("x_user_id", xUserId)
        .eq("is_active", true)
        .maybeSingle();

      if (tokenErr) {
        console.error("[reprocess-polar-sleep] Token lookup error:", tokenErr);
      }

      if (!tokenData?.access_token || !tokenData?.user_id) {
        const msg = "No active token found for Polar user";
        console.warn(`[reprocess-polar-sleep] ${msg} ${xUserId} (log ${log.id})`);
        // Mark the log as failed (keeps history consistent)
        await supabase
          .from("polar_webhook_logs")
          .update({ status: "failed", error_message: msg, processed_at: new Date().toISOString() })
          .eq("id", log.id);
        results.push({ id: log.id, status: "skipped", message: msg });
        skippedCount++;
        continue;
      }

      // Invoke the canonical sync function using the URL from webhook
      const invokeBody = {
        user_id: tokenData.user_id,
        polar_user_id: tokenData.polar_user_id || xUserId,
        access_token: tokenData.access_token,
        url,
        webhook_payload: log.payload,
      };

      console.log("[reprocess-polar-sleep] Invoking sync-polar-sleep with body:", {
        user_id: invokeBody.user_id,
        polar_user_id: invokeBody.polar_user_id,
        url: invokeBody.url,
      });

      const { error: invokeErr } = await supabase.functions.invoke("sync-polar-sleep", {
        body: invokeBody,
      });

      if (invokeErr) {
        const msg = `sync-polar-sleep failed: ${invokeErr.message || JSON.stringify(invokeErr)}`;
        console.error("[reprocess-polar-sleep]", msg);
        await supabase
          .from("polar_webhook_logs")
          .update({ status: "failed", error_message: msg, processed_at: new Date().toISOString() })
          .eq("id", log.id);
        results.push({ id: log.id, status: "error", message: msg });
        errorCount++;
        continue;
      }

      await supabase
        .from("polar_webhook_logs")
        .update({ status: "success", processed_at: new Date().toISOString(), error_message: null })
        .eq("id", log.id);

      results.push({ id: log.id, status: "success", message: "Reprocessed successfully" });
      successCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: toProcess.length,
        successCount,
        errorCount,
        skippedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("[reprocess-polar-sleep] Error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as any)?.message || String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
