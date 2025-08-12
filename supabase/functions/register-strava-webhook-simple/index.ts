const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stravaClientId = Deno.env.get('STRAVA_CLIENT_ID')
    const stravaClientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    if (!stravaClientId || !stravaClientSecret || !supabaseUrl) {
      return new Response(JSON.stringify({ 
        error: 'Missing required environment variables',
        details: 'STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and SUPABASE_URL are required'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Construct the callback URL for the webhook endpoint
    const callbackUrl = `${supabaseUrl}/functions/v1/strava-webhook`
    const verifyToken = Deno.env.get('STRAVA_VERIFY_TOKEN') || 'biopeak-strava-webhook-2025'

    console.log('Registering Strava webhook:', {
      client_id: stravaClientId,
      callback_url: callbackUrl,
      verify_token: verifyToken
    })

    // 1) Verificar inscrições existentes e reutilizar se já houver
    const listUrl = `https://www.strava.com/api/v3/push_subscriptions?client_id=${stravaClientId}&client_secret=${stravaClientSecret}`
    const listRes = await fetch(listUrl)
    let existingSubs: any[] = []
    try {
      existingSubs = await listRes.json()
    } catch (_) {
      existingSubs = []
    }

    if (listRes.ok && Array.isArray(existingSubs) && existingSubs.length > 0) {
      const existing = existingSubs.find((s: any) => s.callback_url === callbackUrl) ?? existingSubs[0]
      console.log('Found existing Strava subscription, reusing:', existing)
      return new Response(JSON.stringify({
        success: true,
        reused: true,
        subscription: existing,
        callback_url: callbackUrl,
        verify_token: verifyToken,
        message: 'Assinatura de webhook já existe. Reutilizando a inscrição atual.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) Registrar webhook com a Strava (caso não exista)
    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken
      })
    })

    const responseData = await response.json()

    if (!response.ok) {
      // Se já existir, retornar a atual
      const alreadyExists = responseData?.errors?.some((e: any) => e?.code === 'already exists')
      if (response.status === 400 && alreadyExists) {
        const listRes2 = await fetch(listUrl)
        let subs2: any[] = []
        try { subs2 = await listRes2.json() } catch (_) { subs2 = [] }
        const existing = Array.isArray(subs2) && subs2.length > 0
          ? (subs2.find((s: any) => s.callback_url === callbackUrl) ?? subs2[0])
          : null
        console.warn('Strava subscription already exists, reusing:', existing)
        return new Response(JSON.stringify({
          success: true,
          reused: true,
          subscription: existing,
          callback_url: callbackUrl,
          verify_token: verifyToken,
          message: 'Assinatura de webhook já existia e foi reutilizada.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.error('Strava webhook registration failed:', responseData)
      return new Response(JSON.stringify({ 
        error: 'Failed to register webhook',
        details: responseData,
        status: response.status
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Strava webhook registered successfully:', responseData)

    return new Response(JSON.stringify({ 
      success: true,
      reused: false,
      subscription: responseData,
      callback_url: callbackUrl,
      verify_token: verifyToken,
      message: 'Webhook registrado com sucesso! A Strava agora enviará notificações para nosso endpoint.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook registration error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})