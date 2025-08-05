import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get last sync info
async function getLastSyncInfo(serviceRoleClient: any, userId: string) {
  const { data: syncStatus } = await serviceRoleClient
    .from('strava_sync_status')
    .select('last_sync_at, total_activities_synced')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    lastSyncDate: syncStatus?.last_sync_at ? new Date(syncStatus.last_sync_at) : null,
    totalSynced: syncStatus?.total_activities_synced || 0
  }
}

// Helper function to update sync status
async function updateSyncStatus(serviceRoleClient: any, userId: string, status: string, lastActivityDate?: Date, totalSynced?: number, errorMessage?: string) {
  const updateData: any = {
    user_id: userId,
    sync_status: status,
    updated_at: new Date().toISOString()
  }

  if (status === 'completed') {
    updateData.last_sync_at = new Date().toISOString()
    if (lastActivityDate) {
      updateData.last_activity_date = lastActivityDate.toISOString()
    }
    if (totalSynced !== undefined) {
      updateData.total_activities_synced = totalSynced
    }
  }

  if (errorMessage) {
    updateData.error_message = errorMessage
  }

  await serviceRoleClient
    .from('strava_sync_status')
    .upsert(updateData)
}

// Helper function to ensure valid access token
async function ensureValidAccessToken(serviceRoleClient: any, userId: string) {
  const { data: tokenData } = await serviceRoleClient
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenData?.access_token) {
    throw new Error('No Strava token found for user')
  }

  // Check if token is expired
  const expiresAt = new Date(tokenData.expires_at)
  const now = new Date()
  
  if (expiresAt <= now) {
    // Token is expired, refresh it
    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
    
    const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token'
      })
    })

    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json()
      
      // Update tokens in database
      await serviceRoleClient
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: new Date(refreshData.expires_at * 1000).toISOString()
        })
        .eq('user_id', userId)

      return refreshData.access_token
    } else {
      throw new Error('Failed to refresh Strava token')
    }
  }

  return tokenData.access_token
}

// Helper function to verify token scopes
async function verifyTokenScopes(accessToken: string) {
  const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!athleteResponse.ok) {
    throw new Error('Failed to verify token scopes')
  }

  const athlete = await athleteResponse.json()
  return { scopes: [], athlete }
}

// Helper function to fetch Strava activities
async function fetchStravaActivities(accessToken: string, lastSyncDate?: Date) {
  let url = 'https://www.strava.com/api/v3/athlete/activities?per_page=200'
  
  if (lastSyncDate) {
    const afterTimestamp = Math.floor(lastSyncDate.getTime() / 1000)
    url += `&after=${afterTimestamp}`
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.status}`)
  }

  return await response.json()
}

// Helper function to fetch detailed activity data
async function fetchDetailedActivityData(activities: any[], accessToken: string) {
  const detailedActivities = []
  let detailRequestCount = 0

  for (const activity of activities) {
    try {
      const detailResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      
      detailRequestCount++
      
      if (detailResponse.ok) {
        const detailedActivity = await detailResponse.json()
        detailedActivities.push(detailedActivity)
      }
      
      // Rate limiting - wait between requests
      if (detailRequestCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.log(`Failed to fetch details for activity ${activity.id}:`, error)
    }
  }

  return { detailedActivities, detailRequestCount }
}

// Helper function to store activities in database
async function storeActivitiesInDatabase(activities: any[], serviceRoleClient: any, userId: string) {
  let syncedCount = 0

  for (const activity of activities) {
    try {
      const { error } = await serviceRoleClient
        .from('strava_activities')
        .upsert({
          user_id: userId,
          strava_activity_id: activity.id,
          name: activity.name,
          type: activity.type,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain,
          start_date: activity.start_date,
          calories: activity.calories,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          average_speed: activity.average_speed,
          max_speed: activity.max_speed,
        })

      if (!error) {
        syncedCount++
      }
    } catch (error) {
      console.log(`Failed to store activity ${activity.id}:`, error)
    }
  }

  return syncedCount
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Create supabase client with anon key for JWT validation
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  
  // Create service role client for database operations
  const serviceRoleClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get last sync info for incremental sync
    const { lastSyncDate, totalSynced: previouslySynced } = await getLastSyncInfo(serviceRoleClient, user.id)
    
    // Update sync status to 'in_progress'
    await updateSyncStatus(serviceRoleClient, user.id, 'in_progress')

    // Ensure we have a valid access token (handles refresh if needed)
    const accessToken = await ensureValidAccessToken(serviceRoleClient, user.id)

    // Verify token scopes and capabilities
    const { scopes, athlete } = await verifyTokenScopes(accessToken)

    // Fetch activities from Strava using helper function with incremental sync
    const activities = await fetchStravaActivities(accessToken, lastSyncDate)

    // Fetch detailed activity data using helper function
    const { detailedActivities, detailRequestCount } = await fetchDetailedActivityData(activities, accessToken)

    // Store activities in database using helper function
    const syncedCount = await storeActivitiesInDatabase(detailedActivities, serviceRoleClient, user.id)
    
    // Find most recent activity date for next incremental sync
    const mostRecentActivity = detailedActivities.reduce((latest, activity) => {
      const activityDate = new Date(activity.start_date)
      return activityDate > latest ? activityDate : latest
    }, lastSyncDate || new Date(0))

    // Update sync status to completed
    console.log(`Sync completed for user ${user.id}: ${syncedCount} new activities synced, total now: ${previouslySynced + syncedCount}`)
    
    await updateSyncStatus(
      serviceRoleClient, 
      user.id, 
      'completed', 
      mostRecentActivity,
      previouslySynced + syncedCount
    )

    return new Response(JSON.stringify({ 
      success: true,
      synced: syncedCount,
      total: detailedActivities.length,
      isIncremental: !!lastSyncDate,
      lastSyncDate: lastSyncDate?.toISOString(),
      mostRecentActivity: mostRecentActivity.toISOString(),
      debug: {
        userId: user.id,
        activitiesReceived: detailedActivities.length,
        detailRequestsMade: detailRequestCount,
        previouslySynced: previouslySynced
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    // Try to get user id from authorization for error logging
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseClient.auth.getUser(token)
        if (user) {
          await updateSyncStatus(serviceRoleClient, user.id, 'error', undefined, undefined, error?.message)
        }
      } catch (e) {
        console.log('Could not update error status:', e)
      }
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})