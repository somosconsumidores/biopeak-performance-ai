import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Auth: admin JWT OR x-hook-secret fallback
    const authHeader = req.headers.get('Authorization')
    const hookSecret = req.headers.get('x-hook-secret')
    const expectedSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')

    let isSystem = false
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // Verifica role admin
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      userId = user.id
    } else if (hookSecret && expectedSecret && hookSecret === expectedSecret) {
      // System mode (no user context)
      isSystem = true
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Parâmetros opcionais
    let body: any = {}
    try { body = await req.json() } catch {}
    const dateStr: string = body?.date || new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const from = `${dateStr}T00:00:00Z`
    const to = `${dateStr}T23:59:59Z`

    // Busca falhas de hoje no controle de sync de detalhes
    const { data: failed, error: qErr } = await supabase
      .from('garmin_sync_control')
      .select('id,user_id,webhook_payload,callback_url,created_at')
      .eq('sync_type', 'details')
      .eq('status', 'failed')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })

    if (qErr) {
      console.error('[reprocess] query error', qErr)
      return new Response(JSON.stringify({ error: 'Query error', details: qErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const candidates = (failed || []).filter(r => r.webhook_payload)
    console.log(`[reprocess] Found ${failed?.length || 0} failed, ${candidates.length} with payload to reprocess`)

    // Além de falhas, buscar todos os webhooks de detalhes do dia
    const { data: logs, error: logsErr } = await supabase
      .from('garmin_webhook_logs')
      .select('id,user_id,payload,webhook_type,created_at')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })

    if (logsErr) {
      console.error('[reprocess] logs query error', logsErr)
    }

    const logCandidates = (logs || []).filter(l => {
      const p = l?.payload as any
      return p && (Array.isArray(p.activityDetails) ? p.activityDetails.length > 0 : !!p.activityDetails)
    })

    console.log(`[reprocess] Found ${logCandidates.length} webhook logs with activityDetails for ${dateStr}`)

    // Unificar candidatos (prioriza falhas explícitas, mas reprocessa logs também)
    let combined: Array<any> = [
      ...candidates.map(r => ({ src: 'sync', id: r.id, user_id: r.user_id, payload: r.webhook_payload })),
      ...logCandidates.map(l => ({ src: 'log', id: l.id, user_id: l.user_id, payload: l.payload }))
    ]

    // Também considerar TODAS as atividades de hoje (reprocessa idempotente via upsert)
    const { data: acts, error: actErr } = await supabase
      .from('garmin_activities')
      .select('user_id,activity_id,summary_id,activity_date,start_time_in_seconds')
      .eq('activity_date', dateStr)
      .order('start_time_in_seconds', { ascending: true })

    if (actErr) {
      console.error('[reprocess] activities query error', actErr)
    } else if (acts && acts.length > 0) {
      console.log(`[reprocess] Found ${acts.length} activities for ${dateStr}`)

      // Opcional: poderíamos filtrar atividades já com detalhes, mas o upsert é idempotente
      for (const a of acts) {
        // Busca token ativo do usuário
        const { data: tokenRow, error: tokenErr } = await supabase
          .from('garmin_tokens')
          .select('access_token')
          .eq('user_id', a.user_id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (tokenErr || !tokenRow?.access_token) {
          console.warn('[reprocess] missing token for activity', a.activity_id)
          continue
        }

        combined.push({
          src: 'activity',
          id: a.activity_id,
          user_id: a.user_id,
          activity_id: a.activity_id,
          summary_id: a.summary_id,
          garmin_access_token: tokenRow.access_token,
        })
      }
    }

    let processed = 0
    let success = 0
    const errors: Array<{ id: string, reason: string }> = []

    for (const row of combined) {
      processed++
      try {
        const body: any = { webhook_triggered: true, user_id: row.user_id }
        if (row.payload) {
          body.webhook_payload = row.payload
        } else if (row.activity_id) {
          body.activity_id = row.activity_id
          if (row.summary_id) body.summary_id = row.summary_id
          if (row.garmin_access_token) body.garmin_access_token = row.garmin_access_token
        }

        const { data, error } = await supabase.functions.invoke('sync-garmin-activity-details', {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body
        })

        if (error || data?.error) {
          console.error('[reprocess] invoke error', row.id, error || data?.error)
          errors.push({ id: String(row.id), reason: (error?.message || data?.error || 'unknown') })
        } else {
          success++
        }
      } catch (e) {
        console.error('[reprocess] unexpected', row.id, e)
        errors.push({ id: String(row.id), reason: 'unexpected error' })
      }
    }

    return new Response(JSON.stringify({
      date: dateStr,
      found_failed: failed?.length || 0,
      with_payload: candidates.length,
      found_logs: logCandidates.length,
      processed,
      success,
      failed: errors.length,
      errors
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[reprocess] fatal', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
