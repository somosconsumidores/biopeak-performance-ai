import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  user_id: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  category?: 'training' | 'engagement' | 'achievement' | 'general';
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
      console.error('❌ OneSignal credentials not configured');
      return new Response(
        JSON.stringify({ error: 'OneSignal not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: PushNotificationRequest = await req.json();
    const { user_id, title, message, data, category = 'general' } = body;

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: 'user_id, title, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Sending push notification to user: ${user_id.substring(0, 8)}...`);
    console.log(`📱 Title: ${title}`);
    console.log(`📱 Message: ${message}`);
    console.log(`📱 Category: ${category}`);

    // Build OneSignal API request - Using SDK 5.x format with include_aliases
    const oneSignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: [user_id]
      },
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
      data: {
        ...data,
        category,
      },
      // iOS-specific settings
      ios_sound: 'default',
      // TTL: 24 hours
      ttl: 86400,
    };

    console.log('📱 OneSignal payload:', JSON.stringify(oneSignalPayload, null, 2));

    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const oneSignalResult = await oneSignalResponse.json();

    // Check for "All included players are not subscribed" error
    const hasNotSubscribedError = oneSignalResult.errors?.some(
      (err: string) => err.includes('not subscribed') || err.includes('All included players')
    );

    if (hasNotSubscribedError && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      console.log('⚠️ External ID not linked, attempting fallback via subscription_id...');
      
      // Create Supabase client with service role
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Fetch active subscription IDs for this user
      const { data: tokens, error: tokensError } = await supabase
        .from('push_notification_tokens')
        .select('player_id, platform')
        .eq('user_id', user_id)
        .eq('is_active', true);
      
      if (tokensError) {
        console.error('❌ Failed to fetch tokens from database:', tokensError);
      } else if (tokens && tokens.length > 0) {
        const subscriptionIds = tokens.map(t => t.player_id);
        console.log(`📱 Found ${subscriptionIds.length} active subscription(s), retrying with include_subscription_ids...`);
        
        // Retry with subscription IDs directly
        const fallbackPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_subscription_ids: subscriptionIds,
          headings: { en: title },
          contents: { en: message },
          data: {
            ...data,
            category,
          },
          ios_sound: 'default',
          ttl: 86400,
        };
        
        console.log('📱 Fallback payload:', JSON.stringify(fallbackPayload, null, 2));
        
        const fallbackResponse = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(fallbackPayload),
        });
        
        const fallbackResult = await fallbackResponse.json();
        
        if (!fallbackResponse.ok || fallbackResult.errors?.length > 0) {
          console.error('❌ Fallback also failed:', fallbackResult);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to send notification (both methods)', 
              primary_error: oneSignalResult,
              fallback_error: fallbackResult
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('✅ Notification sent successfully via fallback (subscription_id):', fallbackResult);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            notification_id: fallbackResult.id,
            recipients: fallbackResult.recipients,
            method: 'fallback_subscription_id'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('⚠️ No active tokens found in database for fallback');
      }
    }

    if (!oneSignalResponse.ok || oneSignalResult.errors?.length > 0) {
      console.error('❌ OneSignal API error:', oneSignalResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send notification', 
          details: oneSignalResult 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Notification sent successfully:', oneSignalResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: oneSignalResult.id,
        recipients: oneSignalResult.recipients,
        method: 'external_id'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
