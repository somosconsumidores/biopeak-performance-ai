// backfill-activity-charts-from-logs
// Busca logs de webhook do tipo activity_details_notification para um user e
// processa cada um usando a função existente process-activity-chart-from-garmin-log
// Inserindo os dados na tabela activity_chart_data

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BackfillBody = {
  user_id: string
  webhook_type?: string
  since?: string
  until?: string
  limit?: number
  dry_run?: boolean
}

type ProcessResult = {
  webhook_log_id: string
  status: 'success' | 'error'
  message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

let body: BackfillBody
try {
  body = (await req.json()) as BackfillBody
} catch (parseErr) {
  return new Response(
    JSON.stringify({
      error: 'JSON inválido no corpo da requisição',
      details: String(parseErr),
      example: {
        user_id: 'fa155754-46c5-4f12-99e2-54a9673ff74f',
        dry_run: true,
        limit: 500,
        since: '2025-01-01T00:00:00Z',
        until: '2025-01-31T23:59:59Z'
      }
    }),
    { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}
const userId = body?.user_id
const webhookType = body?.webhook_type ?? 'activity_details_notification'
const since = body?.since
const until = body?.until
const limit = body?.limit ?? 500
const dryRun = body?.dry_run ?? false

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client com JWT do usuário para validar permissão
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    if (userErr || !userData?.user) {
      console.log('[backfill-activity-charts-from-logs] Auth error:', userErr)
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Verifica se é admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    })

    if (roleErr) {
      console.log('[backfill-activity-charts-from-logs] has_role error:', roleErr)
    }

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: apenas administradores' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Monta a query de logs
    let query = supabaseAdmin
      .from('garmin_webhook_logs')
      .select('id, user_id, webhook_type, created_at', { count: 'exact' })
      .eq('webhook_type', webhookType)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (since) query = query.gte('created_at', since)
    if (until) query = query.lte('created_at', until)

    if (limit && limit > 0) query = query.limit(Math.min(limit, 1000))

    const { data: logs, error: logsErr, count } = await query

    if (logsErr) {
      console.error('[backfill-activity-charts-from-logs] Query error:', logsErr)
      return new Response(
        JSON.stringify({ error: 'Falha ao buscar logs', details: logsErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const totalLogs = logs?.length ?? 0

    if (dryRun) {
      return new Response(
        JSON.stringify({
          message: 'Dry run: logs que seriam processados',
          webhook_type: webhookType,
          user_id: userId,
          total_found: count ?? totalLogs,
          sample_ids: logs?.slice(0, 10).map((l) => l.id) ?? [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Processa cada log chamando a função existente
    const results: ProcessResult[] = []

    for (const log of logs ?? []) {
      try {
        const { data: procData, error: procErr } = await supabaseAdmin.functions.invoke(
          'process-activity-chart-from-garmin-log',
          {
            body: { webhook_log_id: log.id },
          }
        )

        if (procErr) {
          console.error('[backfill-activity-charts-from-logs] process error:', procErr)
          results.push({ webhook_log_id: log.id, status: 'error', message: procErr.message })
        } else {
          results.push({ webhook_log_id: log.id, status: 'success', message: procData?.message })
        }
      } catch (e) {
        console.error('[backfill-activity-charts-from-logs] exception invoking process fn:', e)
        results.push({ webhook_log_id: log.id, status: 'error', message: String(e) })
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    return new Response(
      JSON.stringify({
        message: 'Processamento concluído',
        webhook_type: webhookType,
        user_id: userId,
        total_found: count ?? totalLogs,
        processed: results.length,
        success: successCount,
        errors: errorCount,
        results: results.slice(0, 50), // não retornar lista enorme
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (err) {
    console.error('[backfill-activity-charts-from-logs] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro inesperado', details: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
