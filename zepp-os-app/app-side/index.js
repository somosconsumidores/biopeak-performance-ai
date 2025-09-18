import { MessageBuilder } from '@zos/ble'
import { log as Logger } from '@zos/utils'

const logger = Logger.getLogger('biopeak-side-service')

// BioPeak API configuration
const BIOPEAK_API_URL = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/zepp-sync'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'

const messageBuilder = new MessageBuilder()

App({
  globalData: {
    userToken: null,
    syncing: false
  },

  onCreate() {
    logger.info('🚀 BioPeak Side Service started')
    this.initializeBLE()
    this.loadUserToken()
  },

  initializeBLE() {
    logger.info('🔗 Initializing BLE communication')
    
    messageBuilder.listen(() => {
      logger.info('✅ BLE listener ready')
    })

    messageBuilder.on('request', (ctx) => {
      logger.info('📨 Received request from device:', ctx.request.payload)
      this.handleDeviceRequest(ctx)
    })

    messageBuilder.on('call', (ctx) => {
      logger.info('📞 Received call from device:', ctx.payload)
      this.handleDeviceCall(ctx)
    })
  },

  loadUserToken() {
    // Try to get stored user token for BioPeak
    // In production, this would be obtained through OAuth flow
    // For now, we'll prompt user to login through the companion app
    logger.info('🔑 Checking for stored user token')
    
    // This would be stored after user logs in through companion app
    this.globalData.userToken = null // Will be set after authentication
  },

  async handleDeviceRequest(ctx) {
    const { payload } = ctx.request
    
    try {
      if (payload.type === 'sync_activity') {
        await this.handleActivitySync(payload.data, ctx)
      } else {
        logger.warn('❓ Unknown request type:', payload.type)
        ctx.response({
          type: 'sync_error',
          error: 'Unknown request type'
        })
      }
    } catch (error) {
      logger.error('💥 Error handling device request:', error)
      ctx.response({
        type: 'sync_error',
        error: error.message
      })
    }
  },

  async handleDeviceCall(ctx) {
    // Handle direct calls from device
    logger.info('📞 Handling device call')
  },

  async handleActivitySync(activityData, ctx) {
    if (this.globalData.syncing) {
      logger.warn('⏳ Sync already in progress')
      ctx.response({
        type: 'sync_error',
        error: 'Sync already in progress'
      })
      return
    }

    logger.info('🔄 Starting activity sync to BioPeak')
    this.globalData.syncing = true

    try {
      // Check if user is authenticated
      if (!this.globalData.userToken) {
        throw new Error('User not authenticated. Please log in to BioPeak first.')
      }

      logger.info('📤 Sending activity data to BioPeak API')
      
      const response = await this.sendToBioPeak(activityData)
      
      if (response.success) {
        logger.info('✅ Activity synced successfully:', response.activity_id)
        
        ctx.response({
          type: 'sync_complete',
          success: true,
          message: 'Activity synced to BioPeak!',
          activity_id: response.activity_id
        })
      } else {
        throw new Error(response.error || 'Unknown API error')
      }

    } catch (error) {
      logger.error('❌ Activity sync failed:', error)
      
      ctx.response({
        type: 'sync_error',
        error: error.message
      })
    } finally {
      this.globalData.syncing = false
    }
  },

  async sendToBioPeak(activityData) {
    logger.info('🌐 Making request to BioPeak API')
    
    const requestBody = {
      device_id: activityData.device_id,
      activity_data: activityData.activity_data,
      user_profile: activityData.user_profile,
      sync_timestamp: Date.now()
    }

    logger.info('📦 Request payload:', JSON.stringify(requestBody, null, 2))

    try {
      const response = await fetch(BIOPEAK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${this.globalData.userToken}`
        },
        body: JSON.stringify(requestBody)
      })

      const responseData = await response.json()
      
      if (!response.ok) {
        logger.error('❌ API response error:', response.status, responseData)
        throw new Error(responseData.error || `HTTP ${response.status}`)
      }

      logger.info('✅ API response success:', responseData)
      return responseData

    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Check internet connection.')
      }
      throw error
    }
  },

  // Method to set user token (called from companion app)
  setUserToken(token) {
    logger.info('🔑 Setting user authentication token')
    this.globalData.userToken = token
    
    // Store token persistently (would use proper storage in production)
    // For now just keep in memory
  },

  // Method to check authentication status
  isAuthenticated() {
    return !!this.globalData.userToken
  },

  onDestroy() {
    logger.info('🔚 BioPeak Side Service destroyed')
    if (messageBuilder) {
      messageBuilder.off()
    }
  }
})
