import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    if (req.method === 'GET') {
      // Get user's current permissions from database
      const { data: storedPermissions, error: permError } = await supabase
        .from('garmin_user_permissions')
        .select('garmin_user_id, permissions, granted_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (permError) {
        console.error('Error fetching stored permissions:', permError);
        throw permError;
      }

      // Get user's current Garmin token to query live permissions
      const { data: token, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, garmin_user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      let livePermissions = null;
      if (token?.access_token) {
        try {
          console.log('Fetching live permissions from Garmin API...');
          const response = await fetch('https://apis.garmin.com/wellness-api/rest/user/permission', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            livePermissions = data.permissions || [];
            console.log('Live permissions retrieved:', livePermissions);
          } else {
            console.warn('Failed to fetch live permissions:', response.status);
          }
        } catch (error) {
          console.warn('Error fetching live permissions:', error);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          garminUserId: storedPermissions?.garmin_user_id || token?.garmin_user_id,
          storedPermissions: storedPermissions?.permissions || [],
          livePermissions: livePermissions,
          lastUpdated: storedPermissions?.updated_at,
          grantedAt: storedPermissions?.granted_at,
          hasValidToken: !!token?.access_token
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === 'POST') {
      // Force refresh permissions from Garmin API
      const { data: token, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, garmin_user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (tokenError || !token?.access_token) {
        throw new Error('No active Garmin token found');
      }

      console.log('Force refreshing permissions from Garmin API...');
      const response = await fetch('https://apis.garmin.com/wellness-api/rest/user/permission', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status}`);
      }

      const data = await response.json();
      const currentPermissions = data.permissions || [];

      // Update stored permissions
      const { error: updateError } = await supabase
        .from('garmin_user_permissions')
        .upsert({
          user_id: user.id,
          garmin_user_id: token.garmin_user_id,
          permissions: currentPermissions,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,garmin_user_id'
        });

      if (updateError) {
        console.error('Error updating permissions:', updateError);
        throw updateError;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Permissions refreshed successfully',
        data: {
          garminUserId: token.garmin_user_id,
          permissions: currentPermissions,
          updatedAt: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
    
  } catch (error) {
    console.error('Error in permissions query:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});