import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PermissionChange {
  userId: string;
  permissions: string[];
  changeTimeInSeconds: number;
}

interface PermissionsPayload {
  userPermissionsChange: PermissionChange[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const payload: PermissionsPayload = await req.json()
    console.log('Received permissions change payload:', payload)

    if (!payload.userPermissionsChange || !Array.isArray(payload.userPermissionsChange)) {
      console.error('Invalid payload structure')
      return new Response('Invalid payload', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const results = []

    for (const permissionChange of payload.userPermissionsChange) {
      const { userId: garminUserId, permissions, changeTimeInSeconds } = permissionChange
      
      try {
        console.log(`Processing permission change for Garmin user: ${garminUserId}`)
        console.log(`New permissions: ${permissions.join(', ')}`)

        // Find user tokens and previous permissions by Garmin user ID
        const { data: tokens, error: tokenError } = await supabaseClient
          .from('garmin_tokens')
          .select('user_id, is_active')
          .eq('garmin_user_id', garminUserId)

        if (tokenError) {
          console.error('Error finding tokens:', tokenError)
          throw tokenError
        }

        if (tokens && tokens.length > 0) {
          const userId = tokens[0].user_id

          // Get previous permissions to compare changes
          const { data: previousPermissions, error: permError } = await supabaseClient
            .from('garmin_user_permissions')
            .select('permissions')
            .eq('user_id', userId)
            .eq('garmin_user_id', garminUserId)
            .maybeSingle()

          let addedPermissions = [];
          let revokedPermissions = [];
          
          if (previousPermissions) {
            const oldPerms = previousPermissions.permissions || [];
            addedPermissions = permissions.filter(p => !oldPerms.includes(p));
            revokedPermissions = oldPerms.filter(p => !permissions.includes(p));
            
            console.log(`Permission changes for ${garminUserId}:`);
            console.log(`Added: ${addedPermissions.join(', ') || 'none'}`);
            console.log(`Revoked: ${revokedPermissions.join(', ') || 'none'}`);
          } else {
            console.log(`No previous permissions found for ${garminUserId}, treating as initial grant`);
            addedPermissions = permissions;
          }

          // Update permissions in database
          const { error: updatePermError } = await supabaseClient
            .from('garmin_user_permissions')
            .upsert({
              user_id: userId,
              garmin_user_id: garminUserId,
              permissions: permissions,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,garmin_user_id'
            })

          if (updatePermError) {
            console.error('Error updating permissions:', updatePermError)
            throw updatePermError
          }

          // Check if permissions include required access
          const hasActivityExport = permissions.includes('ACTIVITY_EXPORT')
          const hasHealthExport = permissions.includes('HEALTH_EXPORT')
          const hasWellnessExport = permissions.includes('WELLNESS_EXPORT')
          
          // If user revoked essential permissions, deactivate tokens
          if (!hasActivityExport && !hasHealthExport && !hasWellnessExport) {
            console.log(`All essential permissions revoked, deactivating user: ${garminUserId}`)
            
            const { error: deactivateError } = await supabaseClient
              .rpc('deactivate_garmin_user', { garmin_user_id_param: garminUserId })

            if (deactivateError) {
              console.error('Error deactivating user:', deactivateError)
              throw deactivateError
            }
          }

          // Log the webhook with detailed change information
          await supabaseClient
            .from('garmin_webhook_logs')
            .insert({
              user_id: userId,
              webhook_type: 'permissions_change',
              payload: {
                ...permissionChange,
                previousPermissions: previousPermissions?.permissions || [],
                addedPermissions,
                revokedPermissions
              },
              status: 'success',
              garmin_user_id: garminUserId
            })

          console.log(`Successfully processed permission change for user: ${garminUserId}`)
          results.push({ 
            userId: garminUserId, 
            status: 'success',
            permissions,
            addedPermissions,
            revokedPermissions,
            deactivated: !hasActivityExport && !hasHealthExport && !hasWellnessExport
          })
        } else {
          console.log(`No tokens found for Garmin user: ${garminUserId}`)
          
          // Still log the webhook attempt
          await supabaseClient
            .from('garmin_webhook_logs')
            .insert({
              user_id: null,
              webhook_type: 'permissions_change',
              payload: permissionChange,
              status: 'no_user_found',
              garmin_user_id: garminUserId
            })

          results.push({ userId: garminUserId, status: 'no_user_found' })
        }
      } catch (error) {
        console.error(`Error processing permission change for ${garminUserId}:`, error)
        
        // Log the error
        await supabaseClient
          .from('garmin_webhook_logs')
          .insert({
            user_id: null,
            webhook_type: 'permissions_change',
            payload: permissionChange,
            status: 'error',
            error_message: error.message,
            garmin_user_id: garminUserId
          })

        results.push({ userId: garminUserId, status: 'error', error: error.message })
      }
    }

    console.log('Permission change processing complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in permissions webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})