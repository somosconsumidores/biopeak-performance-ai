import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  user_id?: string;
  user_ids?: string[];
  player_id?: string;
  player_ids?: string[];
  title: string;
  message: string;
  data?: Record<string, any>;
  notification_type?: string;
  url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('Missing OneSignal credentials');
      return new Response(
        JSON.stringify({ error: 'OneSignal not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body: NotificationRequest = await req.json();
    const { user_id, user_ids, player_id, player_ids, title, message, data, notification_type, url } = body;

    console.log('Send push notification request:', { user_id, user_ids, player_id, player_ids, title, notification_type });

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title and message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine target users
    let targetUserIds: string[] = [];
    let targetPlayerIds: string[] = [];

    if (player_ids && player_ids.length > 0) {
      targetPlayerIds = player_ids;
    } else if (player_id) {
      targetPlayerIds = [player_id];
    } else if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
    } else if (user_id) {
      targetUserIds = [user_id];
    } else {
      return new Response(
        JSON.stringify({ error: 'Must provide user_id, user_ids, player_id, or player_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build OneSignal request
    const oneSignalPayload: Record<string, any> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: message },
      data: data || {},
    };

    // Add URL if provided
    if (url) {
      oneSignalPayload.url = url;
    }

    // Set targeting
    if (targetPlayerIds.length > 0) {
      // Target by OneSignal Player IDs
      oneSignalPayload.include_player_ids = targetPlayerIds;
    } else {
      // Target by External User IDs (Supabase user_id)
      oneSignalPayload.include_aliases = {
        external_id: targetUserIds,
      };
      oneSignalPayload.target_channel = 'push';
    }

    console.log('OneSignal payload:', JSON.stringify(oneSignalPayload, null, 2));

    // Send to OneSignal
    const oneSignalResponse = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const oneSignalResult = await oneSignalResponse.json();
    console.log('OneSignal response:', oneSignalResult);

    if (!oneSignalResponse.ok) {
      console.error('OneSignal error:', oneSignalResult);
      
      // Log failed notification
      for (const uid of targetUserIds) {
        await supabase.from('push_notification_history').insert({
          user_id: uid,
          title,
          message,
          data,
          notification_type: notification_type || 'general',
          status: 'failed',
        });
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: oneSignalResult.errors || 'Failed to send notification',
          details: oneSignalResult 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful notification(s)
    const notificationId = oneSignalResult.id;
    const historyInserts = targetUserIds.map(uid => ({
      user_id: uid,
      title,
      message,
      data,
      notification_type: notification_type || 'general',
      onesignal_notification_id: notificationId,
      status: 'sent',
    }));

    if (historyInserts.length > 0) {
      const { error: historyError } = await supabase
        .from('push_notification_history')
        .insert(historyInserts);

      if (historyError) {
        console.error('Error logging notification history:', historyError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: notificationId,
        recipients: oneSignalResult.recipients || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
