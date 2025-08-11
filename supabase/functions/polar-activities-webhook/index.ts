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
    
    // Compare de forma case-insensitive
    const headerSig = (signature || '').toLowerCase();
    return calculatedHex === headerSig;
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
    const incomingUserId: any = (payload as any).user_id ?? (payload as any).userId; const xUserId = incomingUserId != null ? Number(incomingUserId) : null;
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
      .eq('x_user_id', xUserId)
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
          polar_user_id: xUserId,
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
      console.error('[polar-activities-webhook] No active token found for Polar user:', xUserId);
      
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
    const eventLower = (payload.event || '').toLowerCase();

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

    // Route handling by event type
    try {
      if (eventLower === 'exercise') {
        // Log the sync attempt for activities
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
          console.error('[polar-activities-webhook] Failed to log activities sync attempt:', syncError);
        }

        const { error: actError } = await supabase.functions.invoke('sync-polar-activities', {
          body: {
            user_id: tokenData.user_id,
            polar_user_id: tokenData.polar_user_id || xUserId,
            access_token: tokenData.access_token,
            webhook_payload: payload,
          },
        });

        if (actError) {
          throw new Error(`Activities sync failed: ${actError.message || JSON.stringify(actError)}`);
        }

        console.log('[polar-activities-webhook] Activities sync triggered successfully');

        if (syncData) {
          await supabase
            .from('polar_sync_control')
            .update({ status: 'completed', last_sync_at: new Date().toISOString() })
            .eq('id', syncData.id);
        }

        if (logId) {
          await supabase
            .from('polar_webhook_logs')
            .update({ status: 'success', processed_at: new Date().toISOString() })
            .eq('id', logId);
        }
      } else if (eventLower === 'sleep') {
        // Log the sync attempt for sleep
        const { data: syncData, error: syncError } = await supabase
          .from('polar_sync_control')
          .insert({
            user_id: tokenData.user_id,
            sync_type: 'sleep',
            triggered_by: 'webhook',
            status: 'pending',
          })
          .select()
          .single();

        if (syncError) {
          console.error('[polar-activities-webhook] Failed to log sleep sync attempt:', syncError);
        }

        const { error: slpError } = await supabase.functions.invoke('sync-polar-sleep', {
          body: {
            user_id: tokenData.user_id,
            polar_user_id: tokenData.polar_user_id || xUserId,
            access_token: tokenData.access_token,
            webhook_payload: payload,
          },
        });

        if (slpError) {
          throw new Error(`Sleep sync failed: ${slpError.message || JSON.stringify(slpError)}`);
        }

        console.log('[polar-activities-webhook] Sleep sync triggered successfully');

        if (syncData) {
          await supabase
            .from('polar_sync_control')
            .update({ status: 'completed', last_sync_at: new Date().toISOString() })
            .eq('id', syncData.id);
        }

        if (logId) {
          await supabase
            .from('polar_webhook_logs')
            .update({ status: 'success', processed_at: new Date().toISOString() })
            .eq('id', logId);
        }
      } else if (eventLower === 'continuous_heart_rate') {
        // Store raw continuous HR event for later processing
        const eventDateIso = payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString();
        const body: any = payload as any;
        const { error: insertErr } = await supabase.from('polar_continuous_hr_events').insert({
          user_id: tokenData.user_id,
          polar_user_id: xUserId,
          event_date: eventDateIso,
          window_start: body.window_start || body.start_time || null,
          window_end: body.window_end || body.end_time || null,
          payload: payload as unknown as object,
        });
        if (insertErr) {
          throw insertErr;
        }

        // NEW: trigger CHR daily sync using the official endpoint for the date in payload.url
        const dateFromUrl =
          (typeof body?.url === 'string' && body.url.split('/').pop()) || null;

        const { error: chrError } = await supabase.functions.invoke('sync-polar-continuous-hr', {
          body: {
            user_id: tokenData.user_id,
            polar_user_id: tokenData.polar_user_id || xUserId,
            access_token: tokenData.access_token,
            date: dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : undefined,
            url: body?.url,
            webhook_payload: payload,
          },
        });

        if (chrError) {
          console.error('[polar-activities-webhook] CHR sync invoke error:', chrError);
          if (logId) {
            await supabase
              .from('polar_webhook_logs')
              .update({ status: 'failed', error_message: String(chrError?.message || chrError), processed_at: new Date().toISOString() })
              .eq('id', logId);
          }
          throw new Error(`CHR sync failed: ${chrError.message || JSON.stringify(chrError)}`);
        }

        if (logId) {
          await supabase
            .from('polar_webhook_logs')
            .update({ status: 'success', processed_at: new Date().toISOString() })
            .eq('id', logId);
        }
        console.log('[polar-activities-webhook] Stored continuous HR event and triggered daily CHR sync');
      } else if (eventLower === 'sleep_wise_circadian_bedtime') {
        const body: any = payload as any;
        const dateIso = body.calendar_date || (payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString());
        const upsertData = {
          user_id: tokenData.user_id,
           polar_user_id: xUserId,
          calendar_date: dateIso,
          bedtime_start: body.bedtime_start || null,
          bedtime_end: body.bedtime_end || null,
          confidence: body.confidence ?? body.score ?? null,
          timezone: body.timezone || body.tz || null,
          payload: payload as unknown as object,
        };
        const { error: upsertErr } = await supabase
          .from('polar_sleepwise_bedtime')
          .upsert(upsertData, { onConflict: 'user_id,calendar_date' });
        if (upsertErr) {
          throw upsertErr;
        }
        if (logId) {
          await supabase
            .from('polar_webhook_logs')
            .update({ status: 'success', processed_at: new Date().toISOString() })
            .eq('id', logId);
        }
        console.log('[polar-activities-webhook] Upserted SleepWise bedtime');
      } else if (eventLower === 'sleep_wise_alertness') {
        const body: any = payload as any;
        const dateIso = body.calendar_date || (payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString());
        const predictions = body.predictions || body.alertness || [];
        const { error: upsertErr } = await supabase
          .from('polar_sleepwise_alertness')
          .upsert({
            user_id: tokenData.user_id,
            polar_user_id: xUserId,
            calendar_date: dateIso,
            predictions,
            payload: payload as unknown as object,
          }, { onConflict: 'user_id,calendar_date' });
        if (upsertErr) {
          throw upsertErr;
        }
        if (logId) {
          await supabase
            .from('polar_webhook_logs')
            .update({ status: 'success', processed_at: new Date().toISOString() })
            .eq('id', logId);
        }
        console.log('[polar-activities-webhook] Upserted SleepWise alertness');
      } else {
        console.log('[polar-activities-webhook] Unhandled Polar event type, marking as success:', eventLower);
        if (logId) {
          await supabase
            .from('polar_webhook_logs')
            .update({ status: 'success', processed_at: new Date().toISOString() })
            .eq('id', logId);
        }
      }
    } catch (syncOrStoreErr) {
      console.error('[polar-activities-webhook] Processing error:', syncOrStoreErr);
      if (logId) {
        await supabase
          .from('polar_webhook_logs')
          .update({ status: 'failed', error_message: String(syncOrStoreErr?.message || syncOrStoreErr), processed_at: new Date().toISOString() })
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
