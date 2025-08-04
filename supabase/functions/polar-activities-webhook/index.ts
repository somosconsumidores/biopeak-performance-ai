import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, polar-webhook-event, polar-webhook-signature',
}

interface PolarWebhookPayload {
  event: string;
  user_id: number;
  entity_id?: string;
  timestamp: string;
  url?: string;
}

// Function to verify HMAC SHA-256 signature
async function verifySignature(payload: string, signature: string, secretKey: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const calculatedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const calculatedHex = Array.from(new Uint8Array(calculatedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return calculatedHex === signature;
  } catch (error) {
    console.error('[polar-activities-webhook] Error verifying signature:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[polar-activities-webhook] Received webhook:', req.method);
    
    // Get headers for verification
    const polarEvent = req.headers.get('polar-webhook-event');
    const polarSignature = req.headers.get('polar-webhook-signature');
    
    console.log('[polar-activities-webhook] Event type:', polarEvent);
    console.log('[polar-activities-webhook] Signature present:', !!polarSignature);

    const payloadText = await req.text();
    const payload: PolarWebhookPayload = JSON.parse(payloadText);
    console.log('[polar-activities-webhook] Payload:', JSON.stringify(payload, null, 2));
    
    // Handle PING events immediately
    if (payload.event === 'PING') {
      console.log('[polar-activities-webhook] Received PING event, responding OK');
      return new Response('OK', { 
        status: 200,
        headers: corsHeaders 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find user by polar user ID
    const { data: tokenData, error: tokenError } = await supabase
      .from('polar_tokens')
      .select('user_id, access_token, x_user_id, polar_user_id')
      .eq('x_user_id', payload.user_id)
      .eq('is_active', true)
      .single();

    // Get global signature key
    const { data: signatureData } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'polar_webhook_signature_key')
      .single();
    
    // Verify signature if both signature and secret key are available
    let signatureValid = true;
    const secretKey = signatureData?.setting_value;
    
    if (polarSignature && secretKey) {
      signatureValid = await verifySignature(payloadText, polarSignature, secretKey);
      console.log('[polar-activities-webhook] Signature verification:', signatureValid ? 'VALID' : 'INVALID');
      
      if (!signatureValid) {
        console.error('[polar-activities-webhook] Invalid signature, rejecting webhook');
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
    } else if (polarSignature) {
      console.warn('[polar-activities-webhook] Signature provided but no secret key found');
    }

    let logId: string | null = null;

    // Log the webhook reception (even if user not found)
    try {
      const { data: logData, error: logError } = await supabase
        .from('polar_webhook_logs')
        .insert({
          user_id: tokenData?.user_id || null,
          polar_user_id: payload.user_id,
          webhook_type: payload.event?.toLowerCase() || 'activities',
          payload: payload,
          status: 'received',
        })
        .select('id')
        .single();

      if (!logError && logData) {
        logId = logData.id;
        console.log('[polar-activities-webhook] Logged webhook with ID:', logId);
      }
    } catch (logError) {
      console.error('[polar-activities-webhook] Failed to log webhook:', logError);
    }

    if (tokenError || !tokenData) {
      console.error('[polar-activities-webhook] No active token found for Polar user:', payload.user_id);
      
      // Update log status to failed
      if (logId) {
        await supabase
          .from('polar_webhook_logs')
          .update({
            status: 'failed',
            error_message: 'No active token found for Polar user',
            processed_at: new Date().toISOString(),
          })
          .eq('id', logId);
      }
      
      return new Response('User not found', { status: 404 });
    }

    console.log('[polar-activities-webhook] Found user:', tokenData.user_id);

    // Update log status to processing
    if (logId) {
      await supabase
        .from('polar_webhook_logs')
        .update({
          status: 'processing',
          processed_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }

    // Log the sync attempt
    const { data: syncData, error: syncError } = await supabase
      .from('polar_sync_control')
      .insert({
        user_id: tokenData.user_id,
        sync_type: 'activities',
        triggered_by: 'webhook',
        status: 'pending',
      })
      .select()
      .single();

    if (syncError) {
      console.error('[polar-activities-webhook] Failed to log sync attempt:', syncError);
    }

    // Call sync function to fetch the new activities
    try {
      const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-polar-activities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: tokenData.user_id,
          polar_user_id: tokenData.polar_user_id || payload.user_id,
          access_token: tokenData.access_token,
          webhook_payload: payload,
        }),
      });

      if (!syncResponse.ok) {
        throw new Error(`Sync failed: ${syncResponse.statusText}`);
      }

      console.log('[polar-activities-webhook] Sync triggered successfully');

      // Update sync status to completed
      if (syncData) {
        await supabase
          .from('polar_sync_control')
          .update({
            status: 'completed',
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', syncData.id);
      }

      // Update webhook log status to success
      if (logId) {
        await supabase
          .from('polar_webhook_logs')
          .update({
            status: 'success',
            processed_at: new Date().toISOString(),
          })
          .eq('id', logId);
      }

    } catch (syncError) {
      console.error('[polar-activities-webhook] Sync error:', syncError);
      
      // Update sync status to failed
      if (syncData) {
        await supabase
          .from('polar_sync_control')
          .update({
            status: 'failed',
          })
          .eq('id', syncData.id);
      }

      // Update webhook log status to failed
      if (logId) {
        await supabase
          .from('polar_webhook_logs')
          .update({
            status: 'failed',
            error_message: syncError.message,
            processed_at: new Date().toISOString(),
          })
          .eq('id', logId);
      }
    }

    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('[polar-activities-webhook] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});