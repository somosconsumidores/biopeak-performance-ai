const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Generate unique request ID for tracking
  const requestId = crypto.randomUUID();
  const requestStart = Date.now();
  
  // Capture all headers for debugging
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  // Detailed request logging
  console.log(`🔵 [strava-config] REQUEST RECEIVED`, {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: {
      origin: headers.origin || 'N/A',
      referer: headers.referer || 'N/A',
      userAgent: headers['user-agent'] || 'N/A',
      authorization: headers.authorization ? 'PRESENT' : 'MISSING',
      'x-client-info': headers['x-client-info'] || 'N/A',
      apikey: headers.apikey ? 'PRESENT' : 'MISSING',
      contentType: headers['content-type'] || 'N/A',
      accept: headers.accept || 'N/A',
      host: headers.host || 'N/A',
    }
  });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ [strava-config] OPTIONS request handled`, { requestId });
    return new Response(null, { headers: corsHeaders })
  }

  // Accept GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    console.error(`❌ [strava-config] Method not allowed`, { 
      requestId, 
      method: req.method 
    });
    return new Response(JSON.stringify({ error: 'Method not allowed', requestId }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    console.log(`🔍 [strava-config] Fetching STRAVA_CLIENT_ID from env`, { requestId });
    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    
    if (!clientId) {
      console.error(`❌ [strava-config] STRAVA_CLIENT_ID not configured`, { requestId });
      return new Response(JSON.stringify({ 
        error: 'Strava configuration missing',
        details: 'STRAVA_CLIENT_ID não configurado nos secrets do Supabase',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log(`✅ [strava-config] STRAVA_CLIENT_ID found`, { 
      requestId,
      clientIdLength: clientId.length 
    });

    // Use dynamic redirect URI based on request origin for flexibility
    const requestOrigin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
    // Default to production domain for safety
    let redirectUri = 'https://biopeak-ai.com/strava-callback'
    
    console.log(`🔍 [strava-config] Calculating redirectUri`, { 
      requestId,
      requestOrigin,
      defaultRedirectUri: redirectUri
    });
    
    if (requestOrigin) {
      if (requestOrigin.includes('localhost')) {
        redirectUri = `${requestOrigin}/strava-callback`
        console.log(`🏠 [strava-config] Using localhost redirectUri`, { requestId, redirectUri });
      } else if (requestOrigin.includes('biopeak-ai.com')) {
        redirectUri = `${requestOrigin}/strava-callback`
        console.log(`🌐 [strava-config] Using biopeak-ai.com redirectUri`, { requestId, redirectUri });
      } else if (requestOrigin.includes('lovable.app')) {
        redirectUri = `${requestOrigin}/strava-callback`
        console.log(`💜 [strava-config] Using lovable.app redirectUri`, { requestId, redirectUri });
      } else {
        console.log(`⚠️ [strava-config] Origin not recognized, using default`, { 
          requestId, 
          requestOrigin, 
          redirectUri 
        });
      }
    } else {
      console.log(`⚠️ [strava-config] No origin/referer found, using default`, { 
        requestId, 
        redirectUri 
      });
    }
    
    const response = {
      clientId: clientId,
      redirectUri: redirectUri,
      timestamp: new Date().toISOString(),
      requestId
    }
    
    const processingTime = Date.now() - requestStart;
    
    console.log(`✅ [strava-config] SUCCESS - Sending response`, { 
      requestId,
      processingTime: `${processingTime}ms`,
      response: {
        clientId: clientId.substring(0, 8) + '...',
        redirectUri: response.redirectUri,
        timestamp: response.timestamp
      }
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const processingTime = Date.now() - requestStart;
    
    console.error(`❌ [strava-config] EXCEPTION CAUGHT`, { 
      requestId,
      processingTime: `${processingTime}ms`,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      errorType: typeof error
    });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString(),
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})