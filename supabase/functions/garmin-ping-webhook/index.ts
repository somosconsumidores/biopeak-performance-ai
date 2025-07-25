
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  console.log(`[garmin-ping-webhook] Request received: ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[garmin-ping-webhook] Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders })
  }

  // Create response immediately for Garmin
  const createSuccessResponse = (message: string = 'Ping received successfully') => {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      status: 'ok'
    };
    
    console.log(`[garmin-ping-webhook] Sending response:`, response);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  };

  try {
    console.log(`[garmin-ping-webhook] ${req.method} from ${req.headers.get('user-agent') || 'unknown'}`);
    
    // Get basic request info
    const pingData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      contentLength: req.headers.get('content-length')
    };

    console.log(`[garmin-ping-webhook] Ping data:`, pingData);

    // Try to initialize Supabase client (but don't fail if it doesn't work)
    let supabaseClient = null;
    try {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
    } catch (supabaseError) {
      console.warn('[garmin-ping-webhook] Failed to initialize Supabase client:', supabaseError);
    }

    // Try to get request payload if present (optional)
    let payload = null;
    try {
      const contentLength = parseInt(req.headers.get('content-length') || '0');
      if (contentLength > 0) {
        const text = await req.text();
        if (text) {
          payload = JSON.parse(text);
          console.log('[garmin-ping-webhook] Payload received:', payload);
        }
      }
    } catch (payloadError) {
      console.log('[garmin-ping-webhook] No valid JSON payload (this is normal for pings)');
    }

    // Try to log to database (but don't fail if it doesn't work)
    if (supabaseClient) {
      try {
        await supabaseClient
          .from('garmin_webhook_logs')
          .insert({
            user_id: null,
            webhook_type: 'ping',
            payload: { ...pingData, requestPayload: payload },
            status: 'received',
            garmin_user_id: null
          });
        console.log('[garmin-ping-webhook] Successfully logged to database');
      } catch (dbError) {
        console.warn('[garmin-ping-webhook] Failed to log to database (non-critical):', dbError);
      }
    }

    console.log('[garmin-ping-webhook] Ping processed successfully');
    return createSuccessResponse('Ping processed successfully');

  } catch (error) {
    console.error('[garmin-ping-webhook] Error processing ping:', error);
    
    // CRITICAL: Still return success to Garmin to maintain webhook health
    // The error is logged but we don't want Garmin to think the endpoint is down
    return createSuccessResponse('Ping received with error (still successful)');
  }
});
