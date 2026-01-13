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

    // Map category to Android notification channel
    const androidChannelId = getAndroidChannelId(category);

    // Build OneSignal API request
    const oneSignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: [user_id],
      headings: { en: title },
      contents: { en: message },
      data: {
        ...data,
        category,
      },
      // Android-specific settings
      android_channel_id: androidChannelId,
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

    if (!oneSignalResponse.ok) {
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

function getAndroidChannelId(category: string): string {
  switch (category) {
    case 'training':
      return 'training_notifications';
    case 'achievement':
      return 'achievement_notifications';
    case 'engagement':
      return 'engagement_notifications';
    default:
      return 'general_notifications';
  }
}
