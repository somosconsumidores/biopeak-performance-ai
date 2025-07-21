import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('Starting migration of Garmin User IDs...')

    // Get all active tokens without garmin_user_id
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('garmin_tokens')
      .select('id, user_id, access_token, garmin_user_id')
      .eq('is_active', true)
      .is('garmin_user_id', null)

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError)
      throw tokensError
    }

    console.log(`Found ${tokens?.length || 0} tokens to migrate`)

    const results = []

    for (const token of tokens || []) {
      try {
        console.log(`Migrating token for user: ${token.user_id}`)

        // Fetch Garmin User API ID
        const userIdResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Accept': 'application/json'
          }
        })

        if (userIdResponse.ok) {
          const userIdData = await userIdResponse.json()
          const garminUserId = userIdData.userId

          console.log(`Retrieved Garmin User ID ${garminUserId} for user ${token.user_id}`)

          // Update the token with the garmin_user_id
          const { error: updateError } = await supabaseClient
            .from('garmin_tokens')
            .update({ garmin_user_id: garminUserId })
            .eq('id', token.id)

          if (updateError) {
            console.error(`Error updating token ${token.id}:`, updateError)
            results.push({
              user_id: token.user_id,
              status: 'error',
              error: updateError.message
            })
          } else {
            console.log(`Successfully updated token for user ${token.user_id}`)
            results.push({
              user_id: token.user_id,
              garmin_user_id: garminUserId,
              status: 'success'
            })
          }
        } else {
          const errorText = await userIdResponse.text()
          console.error(`Failed to fetch Garmin User ID for user ${token.user_id}:`, userIdResponse.status, errorText)
          results.push({
            user_id: token.user_id,
            status: 'api_error',
            error: `Garmin API returned ${userIdResponse.status}: ${errorText}`
          })
        }
      } catch (error) {
        console.error(`Error processing token for user ${token.user_id}:`, error)
        results.push({
          user_id: token.user_id,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log('Migration completed:', results)

    return new Response(JSON.stringify({ 
      success: true, 
      migrated: results.filter(r => r.status === 'success').length,
      errors: results.filter(r => r.status !== 'success').length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in migration:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})