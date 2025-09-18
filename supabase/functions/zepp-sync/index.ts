import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ZeppSyncPayload {
  device_id: string
  activity_data: {
    activity_type: string
    start_time: number
    duration: number
    distance?: number
    calories?: number
    heart_rate?: {
      average: number
      max: number
      samples?: number[]
    }
    steps?: number
    gps_data?: Array<{
      timestamp: number
      latitude: number
      longitude: number
      altitude?: number
      speed?: number
    }>
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Zepp sync started')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Extract user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    console.log(`👤 Authenticated user: ${user.id}`)

    const payload: ZeppSyncPayload = await req.json()
    console.log('📱 Payload received:', JSON.stringify(payload, null, 2))

    // Validate payload
    if (!payload.device_id || !payload.activity_data) {
      throw new Error('Invalid payload structure')
    }

    const { activity_data } = payload
    const activityId = `zepp_${payload.device_id}_${Date.now()}`
    const startDate = new Date(activity_data.start_time * 1000)

    // Prepare activity data for zepp_activities table
    const activityRecord = {
      user_id: user.id,
      activity_id: activityId,
      device_id: payload.device_id,
      activity_type: activity_data.activity_type,
      start_time: startDate.toISOString(),
      duration_in_seconds: activity_data.duration,
      distance_in_meters: activity_data.distance || null,
      calories: activity_data.calories || null,
      average_heart_rate_bpm: activity_data.heart_rate?.average || null,
      max_heart_rate_bpm: activity_data.heart_rate?.max || null,
      steps: activity_data.steps || null,
      synced_at: new Date().toISOString()
    }

    console.log('💾 Inserting activity record:', activityRecord)

    // Insert into zepp_activities
    const { error: activityError } = await supabase
      .from('zepp_activities')
      .insert(activityRecord)

    if (activityError) {
      console.error('❌ Error inserting activity:', activityError)
      throw activityError
    }

    // Insert activity details if we have samples data
    if (activity_data.heart_rate?.samples || activity_data.gps_data) {
      const detailsData = {
        user_id: user.id,
        activity_id: activityId,
        heart_rate_samples: activity_data.heart_rate?.samples || [],
        gps_coordinates: activity_data.gps_data || [],
        raw_data: activity_data
      }

      const { error: detailsError } = await supabase
        .from('zepp_activity_details')
        .insert(detailsData)

      if (detailsError) {
        console.warn('⚠️ Error inserting activity details:', detailsError)
      }
    }

    // Check rate limiting
    const { data: rateLimitData } = await supabase
      .from('zepp_sync_control')
      .select('last_sync_at')
      .eq('user_id', user.id)
      .eq('device_id', payload.device_id)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single()

    if (rateLimitData?.last_sync_at) {
      const lastSync = new Date(rateLimitData.last_sync_at)
      const now = new Date()
      const timeDiff = now.getTime() - lastSync.getTime()
      const minInterval = 60 * 1000 // 1 minute minimum between syncs
      
      if (timeDiff < minInterval) {
        throw new Error('Rate limit: Please wait before syncing again')
      }
    }

    // Log sync attempt
    await supabase
      .from('zepp_sync_control')
      .insert({
        user_id: user.id,
        device_id: payload.device_id,
        sync_type: 'activity',
        status: 'in_progress',
        last_sync_at: new Date().toISOString()
      })

    // Insert into all_activities for unified view
    const unifiedActivity = {
      user_id: user.id,
      activity_id: activityId,
      activity_source: 'ZEPP', // Standardized as uppercase
      activity_type: activity_data.activity_type,
      activity_date: startDate.toISOString().split('T')[0],
      total_distance_meters: activity_data.distance || null,
      total_time_minutes: activity_data.duration ? activity_data.duration / 60 : null,
      active_kilocalories: activity_data.calories || null,
      average_heart_rate: activity_data.heart_rate?.average || null,
      max_heart_rate: activity_data.heart_rate?.max || null,
      pace_min_per_km: activity_data.distance && activity_data.duration 
        ? (activity_data.duration / 60) / (activity_data.distance / 1000) 
        : null,
      device_name: `Zepp Device ${payload.device_id}`
    }

    console.log('🔗 Inserting unified activity:', unifiedActivity)

    const { error: unifiedError } = await supabase
      .from('all_activities')
      .insert(unifiedActivity)

    if (unifiedError) {
      console.error('❌ Error inserting unified activity:', unifiedError)
      throw unifiedError
    }

    // Update sync status to completed
    await supabase
      .from('zepp_sync_control')
      .update({
        status: 'completed',
        last_sync_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('device_id', payload.device_id)

    // Trigger activity chart calculation
    try {
      const { error: chartError } = await supabase.functions.invoke('calculate-activity-chart-data', {
        body: {
          user_id: user.id,
          activity_id: activityId,
          activity_source: 'ZEPP'
        }
      })

      if (chartError) {
        console.warn('⚠️ Error calculating chart data:', chartError)
      }
    } catch (chartErr) {
      console.warn('⚠️ Chart calculation failed:', chartErr)
    }

    console.log('✅ Zepp sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        activity_id: activityId,
        message: 'Activity synced successfully' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('💥 Zepp sync error:', error)
    
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