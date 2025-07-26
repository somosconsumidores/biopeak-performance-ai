import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-token-refresh] Testing token refresh for user: ${userId}`);

    // Get current token
    const { data: currentToken, error: fetchError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentToken) {
      console.error('[test-token-refresh] Error fetching token:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-token-refresh] Current token expires at:', currentToken.expires_at);

    // Update token to expire in 2 minutes to trigger refresh
    const now = new Date();
    const newExpiryTime = new Date(Date.now() + 2 * 60 * 1000);
    const brazilTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(newExpiryTime);
    
    console.log(`[test-token-refresh] Setting token to expire at: ${newExpiryTime.toISOString()} (Brasil: ${brazilTime})`);
    
    const { data: updatedToken, error: updateError } = await supabase
      .from('garmin_tokens')
      .update({ 
        expires_at: newExpiryTime,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[test-token-refresh] Error updating token:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-token-refresh] Token updated to expire at:', updatedToken.expires_at);

    const currentBrazilTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(currentToken.expires_at));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Token configurado para expirar em 2 minutos (Brasil: ${brazilTime})`,
        old_expiry: currentToken.expires_at,
        old_expiry_brazil: currentBrazilTime,
        new_expiry: updatedToken.expires_at,
        new_expiry_brazil: brazilTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-token-refresh] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});