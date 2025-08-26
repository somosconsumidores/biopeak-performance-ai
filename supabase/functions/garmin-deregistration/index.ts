
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeregistrationPayload {
  deregistrations: Array<{
    userId: string;
  }>;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  console.log(`[garmin-deregistration] ${req.method} ${req.url}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Always return success to Garmin - this is critical for webhook health
  const successResponse = (results: any[] = []) => new Response(JSON.stringify({ 
    success: true, 
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
    processingTime: Date.now() - startTime
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse payload
    let payload: DeregistrationPayload;
    try {
      payload = await req.json();
      console.log('[garmin-deregistration] Received payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('[garmin-deregistration] Failed to parse JSON payload:', parseError);
      return successResponse([{ error: 'Invalid JSON payload', status: 'error' }]);
    }

    if (!payload.deregistrations || !Array.isArray(payload.deregistrations)) {
      console.error('[garmin-deregistration] Invalid payload structure');
      return successResponse([{ error: 'Invalid payload structure', status: 'error' }]);
    }

    const results = [];

    for (const deregistration of payload.deregistrations) {
      const { userId: garminUserId } = deregistration;
      
      try {
        console.log(`[garmin-deregistration] Processing deregistration for Garmin user: ${garminUserId}`);

        // Find tokens using the correct garmin_user_id column
        const { data: tokens, error: tokenError } = await supabaseClient
          .from('garmin_tokens')
          .select('user_id, garmin_user_id, is_active')
          .eq('garmin_user_id', garminUserId)
          .eq('is_active', true);

        if (tokenError) {
          console.error('[garmin-deregistration] Error finding tokens:', tokenError);
          throw tokenError;
        }

        console.log(`[garmin-deregistration] Found ${tokens?.length || 0} active tokens for Garmin user: ${garminUserId}`);

        if (tokens && tokens.length > 0) {
          // Deactivate tokens
          const { error: deactivateError } = await supabaseClient
            .from('garmin_tokens')
            .update({ 
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('garmin_user_id', garminUserId)
            .eq('is_active', true);

          if (deactivateError) {
            console.error('[garmin-deregistration] Error deactivating tokens:', deactivateError);
            throw deactivateError;
          }

          // Log the webhook for each affected user
          for (const token of tokens) {
            try {
              await supabaseClient
                .from('garmin_webhook_logs')
                .insert({
                  user_id: token.user_id,
                  webhook_type: 'deregistration',
                  payload: deregistration,
                  status: 'success',
                  garmin_user_id: garminUserId
                });
            } catch (logError) {
              console.warn('[garmin-deregistration] Failed to log webhook:', logError);
            }
          }

          console.log(`[garmin-deregistration] Successfully deactivated ${tokens.length} tokens for Garmin user: ${garminUserId}`);
          results.push({ 
            userId: garminUserId, 
            status: 'success', 
            tokensDeactivated: tokens.length,
            affectedUsers: tokens.map(t => t.user_id)
          });
        } else {
          console.log(`[garmin-deregistration] No active tokens found for Garmin user: ${garminUserId}`);
          
          // Still log the webhook attempt
          try {
            await supabaseClient
              .from('garmin_webhook_logs')
              .insert({
                user_id: null,
                webhook_type: 'deregistration',
                payload: deregistration,
                status: 'no_user_found',
                garmin_user_id: garminUserId
              });
          } catch (logError) {
            console.warn('[garmin-deregistration] Failed to log webhook:', logError);
          }

          results.push({ userId: garminUserId, status: 'no_user_found' });
        }
      } catch (error) {
        console.error(`[garmin-deregistration] Error processing deregistration for ${garminUserId}:`, error);
        
        // Log the error
        try {
          await supabaseClient
            .from('garmin_webhook_logs')
            .insert({
              user_id: null,
              webhook_type: 'deregistration',
              payload: deregistration,
              status: 'error',
              error_message: error.message,
              garmin_user_id: garminUserId
            });
        } catch (logError) {
          console.warn('[garmin-deregistration] Failed to log error:', logError);
        }

        results.push({ userId: garminUserId, status: 'error', error: error.message });
      }
    }

    console.log('[garmin-deregistration] Processing complete:', JSON.stringify(results, null, 2));
    return successResponse(results);

  } catch (error) {
    console.error('[garmin-deregistration] Fatal error:', error);
    
    // CRITICAL: Still return success to Garmin to maintain webhook health
    return successResponse([{ error: error.message, status: 'fatal_error' }]);
  }
});
