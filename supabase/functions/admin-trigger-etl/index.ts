import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminTriggerRequest {
  activity_id: string;
  activity_source?: string; // if missing, we'll try to detect
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    const { activity_id, activity_source }: AdminTriggerRequest = await req.json();
    if (!activity_id) {
      return new Response(
        JSON.stringify({ error: "activity_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Client as current user (for auth and role check)
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Admin client (bypass RLS for discovery and ETL execution)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Get user from JWT
    const {
      data: { user },
      error: getUserError,
    } = await supabaseUser.auth.getUser();

    if (getUserError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: hasAdminRole, error: roleError } = await supabaseUser.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !hasAdminRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Discover owner and source
    let ownerUserId: string | null = null;
    let source: string | null = activity_source ?? null;

    // Try unified table first
    const { data: unifiedRow } = await supabaseAdmin
      .from("all_activities")
      .select("user_id, activity_source")
      .eq("activity_id", activity_id)
      .maybeSingle();

    if (unifiedRow) {
      ownerUserId = unifiedRow.user_id;
      source = source ?? unifiedRow.activity_source;
    }

    // Fallback for Garmin if not found yet
    if (!ownerUserId) {
      const { data: garminRow } = await supabaseAdmin
        .from("garmin_activities")
        .select("user_id")
        .eq("activity_id", activity_id)
        .maybeSingle();
      if (garminRow) {
        ownerUserId = garminRow.user_id;
        source = source ?? "garmin";
      }
    }

    if (!ownerUserId) {
      return new Response(
        JSON.stringify({ error: "Owner not found for activity", activity_id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!source) source = "garmin";

    console.log(
      `[admin-trigger-etl] Triggering ETL for activity ${activity_id} (${source}) owned by ${ownerUserId} - requested by admin ${user.id}`,
    );

    const { data: etlData, error: etlError } = await supabaseAdmin.functions.invoke(
      "process-activity-data-etl",
      { body: { user_id: ownerUserId, activity_id, activity_source: source } },
    );

    if (etlError) {
      console.error("[admin-trigger-etl] ETL error:", etlError);
      return new Response(JSON.stringify({ error: "ETL failed", details: etlError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify counts
    const [chart, segs, zones, coords, variation] = await Promise.all([
      supabaseAdmin
        .from("activity_chart_data")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId)
        .eq("activity_id", activity_id)
        .eq("activity_source", source),
      supabaseAdmin
        .from("activity_segments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId)
        .eq("activity_id", activity_id)
        .eq("activity_source", source),
      supabaseAdmin
        .from("activity_heart_rate_zones")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId)
        .eq("activity_id", activity_id)
        .eq("activity_source", source),
      supabaseAdmin
        .from("activity_coordinates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId)
        .eq("activity_id", activity_id)
        .eq("activity_source", source),
      supabaseAdmin
        .from("activity_variation_analysis")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId)
        .eq("activity_id", activity_id)
        .eq("activity_source", source),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        triggered_for: { user_id: ownerUserId, activity_id, activity_source: source },
        etl: etlData ?? null,
        counts: {
          chart: chart.count ?? 0,
          segments: segs.count ?? 0,
          hr_zones: zones.count ?? 0,
          coordinates: coords.count ?? 0,
          variation: variation.count ?? 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[admin-trigger-etl] Unexpected error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
