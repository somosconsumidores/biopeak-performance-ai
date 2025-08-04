import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccessLogData {
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  access_type?: 'login' | 'session_resume' | 'app_resume';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get request body to check for access type and frequency control
    const body = await req.json().catch(() => ({}));
    const accessType = body.access_type || 'login';
    const minIntervalHours = body.min_interval_hours || 1;

    // Extract client info from request
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Check for recent access to avoid spam (frequency control)
    if (minIntervalHours > 0) {
      const { data: recentAccess } = await supabaseClient
        .from('user_access_logs')
        .select('login_at')
        .eq('user_id', user.id)
        .gte('login_at', new Date(Date.now() - minIntervalHours * 60 * 60 * 1000).toISOString())
        .order('login_at', { ascending: false })
        .limit(1);

      if (recentAccess && recentAccess.length > 0) {
        console.log(`Access skipped for user ${user.id} - recent access within ${minIntervalHours} hours`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Access already logged recently',
            skipped: true,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Prepare access log data
    const accessLogData: AccessLogData = {
      user_id: user.id,
      ip_address: clientIP !== 'unknown' ? clientIP : null,
      user_agent: userAgent !== 'unknown' ? userAgent : null,
      access_type: accessType,
    };

    // Insert access log
    const { error: insertError } = await supabaseClient
      .from('user_access_logs')
      .insert([accessLogData]);

    if (insertError) {
      console.error('Error inserting access log:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to log access' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Access logged for user ${user.id} from IP ${clientIP} (type: ${accessType})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Access logged successfully',
        user_id: user.id,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});