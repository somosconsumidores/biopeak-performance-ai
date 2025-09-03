// Supabase Edge Function: calculate-gas-model
// Implements Selye’s General Adaptation Syndrome (Fitness–Fatigue model)
// - Input: { user_id: string, today?: string }
// - Output: { user_id, fitness, fatigue, performance, date }
// - Auth: Requires JWT (default). Ensures the caller matches user_id.
// - CORS: Enabled for web usage.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for the Fitness–Fatigue model
const HR_REST = 60; // bpm (can be parameterized later)
const K1 = 1.0;     // Fitness weight
const K2 = 2.0;     // Fatigue weight
const TF = 42;      // Fitness time constant (days)
const TD = 7;       // Fatigue time constant (days)

// Utilities
function parseISODateOnly(input?: string | null): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  const d = new Date(input);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Normalize to midnight UTC to avoid timezone drift
  const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24)));
}

function safeNumber(val: unknown): number | null {
  const num = typeof val === 'number' ? val : val == null ? null : Number(val);
  return Number.isFinite(num as number) ? (num as number) : null;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[GAS][${requestId}] Request received: ${req.method} ${new URL(req.url).pathname}`);

  try {
    if (req.method !== 'POST') {
      console.warn(`[GAS][${requestId}] Method not allowed: ${req.method}`);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { user_id, today } = await req.json().catch(() => ({ user_id: undefined, today: undefined })) as {
      user_id?: string;
      today?: string;
    };

    if (!user_id) {
      console.warn(`[GAS][${requestId}] Missing user_id in body`);
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    // Validate auth and ensure caller matches user_id
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error(`[GAS][${requestId}] Auth error:`, authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const callerId = authData?.user?.id;
    if (!callerId || callerId !== user_id) {
      console.warn(`[GAS][${requestId}] Forbidden: caller ${callerId} does not match user_id ${user_id}`);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const todayDate = parseISODateOnly(today);
    console.log(`[GAS][${requestId}] Params -> user_id=${user_id}, today=${todayDate}`);

    // Fetch activities for user
    console.log(`[GAS][${requestId}] Fetching activities from all_activities`);
    const { data: activities, error } = await supabase
      .from('all_activities')
      .select('activity_date,total_time_minutes,average_heart_rate,max_heart_rate')
      .eq('user_id', user_id)
      .lte('activity_date', todayDate)
      .order('activity_date', { ascending: true });

    if (error) {
      console.error(`[GAS][${requestId}] DB error:`, error);
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`[GAS][${requestId}] Activities fetched: ${activities?.length ?? 0}`);

    // Compute TRIMP for each activity and aggregate fitness/fatigue
    let fitness = 0;
    let fatigue = 0;

    for (const act of activities ?? []) {
      const date = (act as any).activity_date as string | null;
      const mins = safeNumber((act as any).total_time_minutes);
      const avgHR = safeNumber((act as any).average_heart_rate);
      const maxHR = safeNumber((act as any).max_heart_rate);

      if (!date || !mins || mins <= 0 || !avgHR || avgHR <= 0 || !maxHR || maxHR <= 0 || maxHR <= HR_REST) {
        console.log(`[GAS][${requestId}] Skipping invalid record`, { date, mins, avgHR, maxHR });
        continue;
      }

      const hrDen = (maxHR - HR_REST);
      if (hrDen <= 0) {
        console.log(`[GAS][${requestId}] Skipping due to non-positive denominator`, { maxHR });
        continue;
      }

      const trimp = mins * ((avgHR - HR_REST) / hrDen);
      const dAgo = daysBetween(date, todayDate);

      const fitnessImp = K1 * trimp * Math.exp(-dAgo / TF);
      const fatigueImp = K2 * trimp * Math.exp(-dAgo / TD);

      fitness += fitnessImp;
      fatigue += fatigueImp;
    }

    const performance = fitness - fatigue;

    const response = {
      user_id,
      fitness: Number(fitness.toFixed(2)),
      fatigue: Number(fatigue.toFixed(2)),
      performance: Number(performance.toFixed(2)),
      date: todayDate,
    };

    console.log(`[GAS][${requestId}] Result`, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[GAS] Unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
