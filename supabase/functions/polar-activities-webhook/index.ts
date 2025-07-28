import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarWebhookPayload {
  event: string;
  user_id: number;
  timestamp: string;
  url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[polar-activities-webhook] Received webhook:', req.method);

    const payload: PolarWebhookPayload = await req.json();
    console.log('[polar-activities-webhook] Payload:', JSON.stringify(payload, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find user by polar user ID
    const { data: tokenData, error: tokenError } = await supabase
      .from('polar_tokens')
      .select('user_id, access_token, x_user_id')
      .eq('x_user_id', payload.user_id)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      console.error('[polar-activities-webhook] No active token found for Polar user:', payload.user_id);
      return new Response('User not found', { status: 404 });
    }

    console.log('[polar-activities-webhook] Found user:', tokenData.user_id);

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