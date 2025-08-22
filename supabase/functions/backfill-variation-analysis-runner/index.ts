import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

type Source = 'garmin' | 'polar' | 'strava' | 'strava_gpx' | 'zepp_gpx' | 'all';

type RunnerBody = {
  source?: Source;
  limit?: number;
  offset?: number;
  dryRun?: boolean;
  user_id?: string; // optional: process only this user
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Item {
  user_id: string;
  activity_id: string;
}

const sourceConfig: Record<Exclude<Source, 'all'>, { table: string; idColumn: string; orderBy?: string }> = {
  garmin:      { table: 'garmin_activities',        idColumn: 'activity_id',        orderBy: 'synced_at' },
  polar:       { table: 'polar_activities',         idColumn: 'activity_id',        orderBy: 'start_time' },
  strava:      { table: 'strava_activities',        idColumn: 'strava_activity_id', orderBy: 'start_date' },
  strava_gpx:  { table: 'strava_gpx_activities',    idColumn: 'id',                 orderBy: 'created_at' },
  zepp_gpx:    { table: 'zepp_gpx_activities',      idColumn: 'activity_id',        orderBy: 'start_time' },
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) as RunnerBody;
    const source: Source = body.source ?? 'garmin';
    const limit = Math.min(Math.max(body.limit ?? 100, 1), 1000);
    const offset = Math.max(body.offset ?? 0, 0);
    const dryRun = !!body.dryRun;
    const onlyUserId = body.user_id || null;

    const sources: Exclude<Source, 'all'>[] = source === 'all'
      ? ['garmin', 'polar', 'strava', 'strava_gpx', 'zepp_gpx']
      : [source as Exclude<Source, 'all'>];

    const results: Record<string, any> = {};

    for (const s of sources) {
      const cfg = sourceConfig[s];
      let q = admin
        .from(cfg.table)
        .select(`user_id, ${cfg.idColumn}`)
        .range(offset, offset + limit - 1);

      if (cfg.orderBy) q = q.order(cfg.orderBy, { ascending: false, nullsFirst: false });
      if (onlyUserId) q = q.eq('user_id', onlyUserId);

      const { data: rows, error } = await q;
      if (error) {
        results[s] = { error: error.message };
        continue;
      }

      // Normalize
      const items: Item[] = (rows || []).map((r: any) => ({
        user_id: r.user_id,
        activity_id: String(r[cfg.idColumn]),
      }));

      let processed = 0;
      let ok = 0;
      const failures: Array<{ user_id: string; activity_id: string; step: string; error: string }> = [];

      for (const it of items) {
        processed++;
        if (dryRun) continue;

        try {
          // 1) Build or refresh the chart cache
          const { error: buildErr } = await admin.functions.invoke('build-activity-chart-cache', {
            body: {
              user_id: it.user_id,
              activity_id: it.activity_id,
              activity_source: s,
              version: 1,
            },
          });
          if (buildErr) throw new Error(`build-activity-chart-cache: ${buildErr.message || buildErr}`);

          // 2) Calculate variation analysis from cache (RPC)
          const { error: rpcErr } = await admin.rpc('calculate_variation_analysis', {
            p_user_id: it.user_id,
            p_activity_source: s,
            p_activity_id: it.activity_id,
          });
          if (rpcErr) throw new Error(`calculate_variation_analysis: ${rpcErr.message || rpcErr}`);

          ok++;
        } catch (e: any) {
          failures.push({ user_id: it.user_id, activity_id: it.activity_id, step: 'process', error: String(e?.message || e) });
        }
      }

      results[s] = {
        source: s,
        fetched: items.length,
        processed,
        ok,
        failures,
        next_offset: offset + limit,
      };
    }

    return new Response(JSON.stringify({ ok: true, limit, offset, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[backfill-variation-analysis-runner] Unexpected error:', e?.message || e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
