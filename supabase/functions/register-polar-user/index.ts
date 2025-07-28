import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarUserRegistration {
  'member-id': string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { access_token }: { access_token: string } = await req.json();

    if (!access_token) {
      throw new Error('Access token is required');
    }

    console.log('Registering Polar user with access token...');

    // Register user with Polar API
    const response = await fetch('https://www.polaraccesslink.com/v3/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        'member-id': user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Polar user registration error:', errorData);
      
      // If user already exists, that's okay
      if (response.status === 409) {
        console.log('User already registered with Polar');
      } else {
        throw new Error(`User registration failed: ${errorData.error || response.statusText}`);
      }
    } else {
      const userData: PolarUserRegistration = await response.json();
      console.log('Polar user registered successfully:', userData);
    }

    // Configure webhook for this user
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/supabase.co', '/supabase.co')}/functions/v1/polar-activities-webhook`;
    
    const webhookResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });

    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.json().catch(() => ({}));
      console.error('Webhook registration error:', webhookError);
      // Don't fail the whole process if webhook registration fails
      console.log('Webhook registration failed, but user registration was successful');
    } else {
      const webhookData = await webhookResponse.json();
      console.log('Webhook registered successfully:', webhookData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Polar user registered and webhook configured successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Register Polar user error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});