// backfill-gas-model: executa o cálculo GAS em lote para usuários com atividades
// - Chama a Edge Function existente calculate-gas-model por usuário
// - Faz upsert no public.users_gas_model com os resultados
// Requer: SUPABASE_SERVICE_ROLE_KEY definido nos Secrets das Edge Functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = "https://grcwlmltlcltmwbhdpky.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      limit = 100,
      offset = 0,
      user_id,
      date, // ISO (yyyy-mm-dd) opcional; calculate-gas-model suporta padrão atual
      days_lookback = 42, // mantemos por compatibilidade futura
      concurrency = 3,
      only_missing_today = true,
    } = await req.json().catch(() => ({}));

    // Obtém o "hoje" padrão em YYYY-MM-DD
    const today = (date
      ? new Date(date)
      : new Date());
    const todayStr = today.toISOString().slice(0, 10);

    // Monta query base: usuários com atividades
    let baseQuery = admin
      .from("all_activities")
      .select("user_id", { count: "exact" })
      .neq("user_id", null)
      .order("user_id", { ascending: true })
      .range(offset, offset + Math.max(0, Number(limit) || 100) - 1);

    // Se um usuário específico foi solicitado
    if (user_id) {
      baseQuery = admin
        .from("all_activities")
        .select("user_id", { count: "exact" })
        .eq("user_id", user_id)
        .order("user_id", { ascending: true })
        .range(0, 0);
    }

    // Busca user_ids distintos
    const { data: rows, error } = await baseQuery;
    if (error) throw error;

    // Dedup na aplicação porque select simples não é distinct
    const userSet = new Set<string>();
    rows?.forEach((r: any) => {
      if (r && r.user_id) userSet.add(r.user_id);
    });

    let candidates = Array.from(userSet);

    // Opcional: filtra apenas quem não tem linha de hoje em users_gas_model
    if (only_missing_today && candidates.length) {
      const { data: existing, error: exErr } = await admin
        .from("users_gas_model")
        .select("user_id")
        .in("user_id", candidates as string[])
        .eq("calendar_date", todayStr);
      if (exErr) throw exErr;
      const existingSet = new Set<string>((existing || []).map((e: any) => e.user_id));
      candidates = candidates.filter((u) => !existingSet.has(u));
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          users_scanned: rows?.length || 0,
          users_to_process: 0,
          users_updated: 0,
          duration_ms: Date.now() - started,
          message: "Nenhum usuário pendente para hoje",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Processa em lotes com controle de concorrência
    const chunkSize = Math.max(1, Number(concurrency) || 1);
    let usersUpdated = 0;
    let usersFailed = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    for (let i = 0; i < candidates.length; i += chunkSize) {
      const slice = candidates.slice(i, i + chunkSize);
      await Promise.all(
        slice.map(async (uid) => {
          try {
            // Chama a função de cálculo usando Supabase client (sem fetch direto)
            const { data: result, error: invErr } = await admin.functions.invoke('calculate-gas-model', {
              body: { user_id: uid, date: todayStr, days_lookback },
            });
            if (invErr || !result) {
              usersFailed += 1;
              errors.push({ user_id: uid, error: invErr?.message || 'Invocation failed' });
              return;
            }
            const fitness = result?.fitness;
            const fatigue = result?.fatigue;
            const performance = result?.performance;
            const calcDate = (result?.date || todayStr) as string;

            if (
              typeof fitness !== "number" ||
              typeof fatigue !== "number" ||
              typeof performance !== "number"
            ) {
              usersFailed += 1;
              errors.push({ user_id: uid, error: "Resultado inválido da função calculate-gas-model" });
              return;
            }

            const { error: upErr } = await admin.from("users_gas_model").upsert(
              {
                user_id: uid,
                calendar_date: calcDate,
                fitness,
                fatigue,
                performance,
              },
              { onConflict: "user_id,calendar_date" }
            );
            if (upErr) throw upErr;
            usersUpdated += 1;
          } catch (e: any) {
            usersFailed += 1;
            errors.push({ user_id: uid, error: String(e?.message || e) });
          }
        })
      );
    }

    return new Response(
      JSON.stringify({
        users_scanned: rows?.length || 0,
        users_to_process: candidates.length,
        users_updated: usersUpdated,
        users_failed: usersFailed,
        errors,
        duration_ms: Date.now() - started,
        date: todayStr,
        limit,
        offset,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String((err as Error)?.message || err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
