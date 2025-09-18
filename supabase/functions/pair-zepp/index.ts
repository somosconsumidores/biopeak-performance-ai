import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PairZeppPayload {
  pairing_code: string
  device_info?: {
    platform: string
    app_version: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔗 Zepp pairing started')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    
    const payload: PairZeppPayload = await req.json()
    console.log('📱 Pairing payload received:', { 
      pairing_code: payload.pairing_code,
      device_info: payload.device_info 
    })

    // Validate payload
    if (!payload.pairing_code) {
      throw new Error('Missing pairing code')
    }

    // Look up the pairing code in zepp_pairing_codes table
    const { data: pairingData, error: pairingError } = await supabase
      .from('zepp_pairing_codes')
      .select('user_id, expires_at, used_at')
      .eq('code', payload.pairing_code)
      .single()

    if (pairingError || !pairingData) {
      console.error('❌ Invalid pairing code:', payload.pairing_code)
      throw new Error('Invalid or expired pairing code')
    }

    // Check if code is expired
    const now = new Date()
    const expiresAt = new Date(pairingData.expires_at)
    if (now > expiresAt) {
      console.error('❌ Pairing code expired:', { expires_at: pairingData.expires_at })
      throw new Error('Pairing code has expired')
    }

    // Check if code was already used
    if (pairingData.used_at) {
      console.error('❌ Pairing code already used:', { used_at: pairingData.used_at })
      throw new Error('Pairing code has already been used')
    }

    const userId = pairingData.user_id

    // Generate device ID
    const deviceId = `zepp_${userId}_${Date.now()}`

    // Create or update zepp_tokens record
    const tokenData = {
      user_id: userId,
      device_id: deviceId,
      device_info: payload.device_info || {},
      is_active: true,
      paired_at: new Date().toISOString()
    }

    const { error: tokenError } = await supabase
      .from('zepp_tokens')
      .upsert(tokenData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })

    if (tokenError) {
      console.error('❌ Error creating zepp token:', tokenError)
      throw tokenError
    }

    // Mark pairing code as used
    const { error: updateError } = await supabase
      .from('zepp_pairing_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('code', payload.pairing_code)

    if (updateError) {
      console.warn('⚠️ Error marking pairing code as used:', updateError)
    }

    // Generate JWT for the user
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `user_${userId}@zepp.biopeak.com`, // Virtual email for JWT generation
      options: {
        redirectTo: 'https://biopeak-ai.com'
      }
    })

    if (authError || !authData.properties?.hashed_token) {
      console.error('❌ Error generating JWT:', authError)
      throw new Error('Failed to generate authentication token')
    }

    // Create a proper JWT using the user
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !user) {
      console.error('❌ Error getting user:', userError)
      throw new Error('User not found')
    }

    // Generate access token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: userId,
      session_data: {
        device_type: 'zepp_os',
        device_id: deviceId
      }
    })

    if (sessionError || !sessionData.session?.access_token) {
      console.error('❌ Error creating session:', sessionError)
      throw new Error('Failed to create authentication session')
    }

    console.log('✅ Zepp pairing completed successfully for user:', userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        device_id: deviceId,
        jwt_token: sessionData.session.access_token,
        message: 'Device paired successfully' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('💥 Zepp pairing error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})