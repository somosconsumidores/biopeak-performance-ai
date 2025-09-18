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
    
    // Generate idempotent activity_id using start_time instead of current timestamp
    const activityId = `zepp_${payload.device_id}_${activity_data.start_time}`
    const startDate = new Date(activity_data.start_time * 1000)

    // RATE LIMITING: Check before any database inserts
    const { data: rateLimitData } = await supabase
      .from('zepp_sync_control')
      .select('last_sync_at, status')
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
        console.warn(`⚠️ Rate limit hit for user ${user.id}, device ${payload.device_id}`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Rate limit exceeded. Please wait 1 minute between syncs.' 
          }),
          { 
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': '60'
            } 
          }
        )
      }
    }

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

    console.log('💾 Upserting activity record:', activityRecord)

    // Upsert into zepp_activities (idempotent)
    const { error: activityError } = await supabase
      .from('zepp_activities')
      .upsert(activityRecord, { 
        onConflict: 'user_id,activity_id',
        ignoreDuplicates: false 
      })

    if (activityError) {
      console.error('❌ Error upserting activity:', activityError)
      throw activityError
    }

    // Insert activity details if we have samples data (use upsert for idempotency)
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
        .upsert(detailsData, { 
          onConflict: 'user_id,activity_id',
          ignoreDuplicates: false 
        })

      if (detailsError) {
        console.warn('⚠️ Error upserting activity details:', detailsError)
      }
    }

    // Log sync attempt (use upsert for sync control)
    await supabase
      .from('zepp_sync_control')
      .upsert({
        user_id: user.id,
        device_id: payload.device_id,
        sync_type: 'activity',
        status: 'in_progress',
        last_sync_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,device_id',
        ignoreDuplicates: false 
      })

    // Upsert into all_activities for unified view (idempotent)
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

    console.log('🔗 Upserting unified activity:', unifiedActivity)

    const { error: unifiedError } = await supabase
      .from('all_activities')
      .upsert(unifiedActivity, { 
        onConflict: 'user_id,activity_source,activity_id',
        ignoreDuplicates: false 
      })

    if (unifiedError) {
      console.error('❌ Error upserting unified activity:', unifiedError)
      throw unifiedError
    }

    // Update sync status to completed (upsert)
    await supabase
      .from('zepp_sync_control')
      .upsert({
        user_id: user.id,
        device_id: payload.device_id,
        sync_type: 'activity',
        status: 'completed',
        last_sync_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,device_id',
        ignoreDuplicates: false 
      })

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
    
    // Determine appropriate HTTP status code
    let status = 400
    if (error.message.includes('Invalid authentication') || error.message.includes('authorization')) {
      status = 401
    } else if (error.message.includes('Rate limit')) {
      status = 429
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})