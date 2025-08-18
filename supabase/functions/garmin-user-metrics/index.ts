
/**
 * Supabase Edge Function: garmin-user-metrics
 * Public webhook for Garmin Health API userMetrics push notifications.
 * - Accepts POST application/json with body { userMetrics: [ ... ] }
 * - Upserts into public.garmin_vo2max (idempotent via unique (garmin_user_id, calendar_date))
 * - Logs each notification into public.garmin_webhook_logs
 * - Always returns 200 quickly and logs errors without delaying the response
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type UserMetricItem = {
  userId: string;
  summaryId?: string;
  calendarDate: string;
  vo2MaxRunning?: number | null;
  vo2MaxCycling?: number | null;
  vo2Max?: number | null; // Novo: alguns webhooks usam vo2Max genérico
  fitnessAge?: number | null;
  // Permitir campos desconhecidos como VO2MAX (maiúsculo) ou strings numéricas
  [key: string]: unknown;
};

type IncomingPayload = {
  userMetrics?: UserMetricItem[];
};

// Helper: normaliza número (aceita number ou string numérica)
function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    // Keep it simple and safe; Garmin will POST real data
    return new Response(JSON.stringify({ ok: true, message: 'Only POST is supported' }), {
      headers: corsHeaders,
      status: 200,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  let payload: IncomingPayload | null = null;

  try {
    // Content-Type check (not strictly required by Garmin but keeps API tidy)
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      console.warn('[garmin-user-metrics] Non-JSON Content-Type received:', contentType);
    }

    payload = await req.json().catch(() => null);
    if (!payload || !Array.isArray(payload.userMetrics)) {
      console.warn('[garmin-user-metrics] Invalid or empty body, responding OK to satisfy webhook requirement');
      return new Response(JSON.stringify({ ok: true, received: 0 }), {
        headers: corsHeaders,
        status: 200,
      });
    }

    console.log('[garmin-user-metrics] Received userMetrics items:', payload.userMetrics.length);
    const rows = [];
    const logs: any[] = [];
    const userIdCache = new Map<string, string | null>();

    for (const item of payload.userMetrics) {
      if (!item?.userId || !item?.calendarDate) {
        console.warn('[garmin-user-metrics] Skipping invalid item (missing userId or calendarDate):', item);
        continue;
      }

      // Resolve internal user_id from garmin_user_id (cached per unique userId)
      let resolvedUserId: string | null = null;
      if (userIdCache.has(item.userId)) {
        resolvedUserId = userIdCache.get(item.userId) ?? null;
      } else {
        const { data: userIdResolved, error: resolveError } = await supabase
          .rpc('find_user_by_garmin_id', { garmin_user_id_param: item.userId });
        if (resolveError) {
          console.error('[garmin-user-metrics] Error resolving user_id for garmin_user_id:', item.userId, resolveError);
        }
        resolvedUserId = userIdResolved ?? null;
        userIdCache.set(item.userId, resolvedUserId);
      }

      // Normalização de VO2: prioriza específicos; se ausentes, usa genérico (vo2Max/VO2MAX)
      const genericVo2Raw = (item as any).vo2Max ?? (item as any).VO2MAX ?? null;
      const genericVo2 = toNumberOrNull(genericVo2Raw);
      const vo2Run = toNumberOrNull(item.vo2MaxRunning) ?? genericVo2;
      const vo2Cycling = toNumberOrNull(item.vo2MaxCycling);

      if (!toNumberOrNull(item.vo2MaxRunning) && !toNumberOrNull(item.vo2MaxCycling) && genericVo2 !== null) {
        console.log('[garmin-user-metrics] Using generic VO2 value for running:', {
          garmin_user_id: item.userId,
          calendar_date: item.calendarDate,
          genericVo2,
        });
      }

      rows.push({
        garmin_user_id: item.userId,
        calendar_date: item.calendarDate, // YYYY-MM-DD
        vo2_max_running: vo2Run ?? null,
        vo2_max_cycling: vo2Cycling ?? null,
        fitness_age: toNumberOrNull(item.fitnessAge) ?? null,
      });

      logs.push({
        webhook_type: 'user_metrics',
        garmin_user_id: item.userId,
        user_id: resolvedUserId,
        payload: item as unknown as object,
        status: 'success',
      });
    }

    if (rows.length === 0) {
      console.warn('[garmin-user-metrics] No valid items to upsert, responding OK');
      return new Response(JSON.stringify({ ok: true, received: 0 }), {
        headers: corsHeaders,
        status: 200,
      });
    }

    // Idempotent upsert (unique: garmin_user_id + calendar_date)
    const { error: upsertError } = await supabase
      .from('garmin_vo2max')
      .upsert(rows, { onConflict: 'garmin_user_id,calendar_date' });

    if (upsertError) {
      console.error('[garmin-user-metrics] Upsert error:', upsertError);
    } else {
      console.log(`[garmin-user-metrics] Upserted ${rows.length} vo2max rows successfully`);
    }

    // Best-effort logging (do not block or fail the response if it errors)
    const { error: logError } = await supabase.from('garmin_webhook_logs').insert(
      logs.map((l) => ({
        webhook_type: l.webhook_type,
        garmin_user_id: l.garmin_user_id,
        user_id: l.user_id ?? null,
        payload: l.payload,
        status: upsertError ? 'error' : 'success',
        error_message: upsertError ? String(upsertError.message ?? 'Upsert error') : null,
      }))
    );

    if (logError) {
      console.error('[garmin-user-metrics] Log insert error:', logError);
    } else {
      console.log(`[garmin-user-metrics] Inserted ${logs.length} webhook log entries`);
    }

    // Respond fast and always 200
    return new Response(
      JSON.stringify({
        ok: true,
        received: rows.length,
        upserted: upsertError ? 0 : rows.length,
      }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (e) {
    console.error('[garmin-user-metrics] Unexpected error:', e);

    // Never block or return non-200 to Garmin
    return new Response(JSON.stringify({ ok: true, error: 'logged' }), {
      headers: corsHeaders,
      status: 200,
    });
  }
});
