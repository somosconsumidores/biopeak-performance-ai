import { MessageBuilder } from '@zos/ble'
import { log as Logger } from '@zos/utils'

const logger = Logger.getLogger('biopeak-side-service')

// BioPeak API configuration
const BIOPEAK_API_URL = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/zepp-sync'
const PAIR_API_URL = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/pair-zepp'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'

const messageBuilder = new MessageBuilder()

App({
  globalData: {
    userToken: null,
    deviceId: null,
    syncing: false,
    paired: false
  },

  onCreate() {
    logger.info('🚀 BioPeak Side Service started')
    this.initializeBLE()
    this.loadStoredCredentials()
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

  loadStoredCredentials() {
    // Try to load stored JWT token
    // In production, use proper storage like localStorage or SecureStorage
    logger.info('🔑 Checking for stored credentials')
    
    try {
      // Mock check - in real implementation, load from secure storage
      const storedToken = null // localStorage.getItem('biopeak_jwt')
      const storedDeviceId = null // localStorage.getItem('zepp_device_id')
      
      if (storedToken && storedDeviceId) {
        this.globalData.userToken = storedToken
        this.globalData.deviceId = storedDeviceId
        this.globalData.paired = true
        logger.info('✅ Found stored credentials')
      } else {
        logger.info('ℹ️ No stored credentials found - pairing required')
      }
    } catch (error) {
      logger.error('❌ Error loading credentials:', error)
    }
  },

  async handleDeviceRequest(ctx) {
    const { payload } = ctx.request
    
    try {
      if (payload.type === 'sync_activity') {
        await this.handleActivitySync(payload.data, ctx)
      } else if (payload.type === 'pair_device') {
        await this.handleDevicePairing(payload.pairing_code, ctx)
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

  async handleDevicePairing(pairingCode, ctx) {
    logger.info('🔗 Starting device pairing with code:', pairingCode)
    
    try {
      const response = await fetch(PAIR_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          pairing_code: pairingCode,
          device_info: {
            platform: 'zepp_os',
            app_version: '1.1.0'
          }
        })
      })

      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || `Pairing failed: HTTP ${response.status}`)
      }

      if (responseData.success && responseData.jwt_token) {
        // Store credentials
        this.globalData.userToken = responseData.jwt_token
        this.globalData.deviceId = responseData.device_id
        this.globalData.paired = true
        
        // In production, store securely
        // localStorage.setItem('biopeak_jwt', responseData.jwt_token)
        // localStorage.setItem('zepp_device_id', responseData.device_id)
        
        logger.info('✅ Device paired successfully')
        
        ctx.response({
          type: 'pairing_complete',
          success: true,
          message: 'Device paired with BioPeak!'
        })
      } else {
        throw new Error('Invalid pairing response')
      }

    } catch (error) {
      logger.error('❌ Pairing failed:', error)
      ctx.response({
        type: 'pairing_error',
        error: error.message
      })
    }
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

    if (!this.globalData.paired || !this.globalData.userToken) {
      logger.error('❌ Device not paired with BioPeak')
      ctx.response({
        type: 'sync_error',
        error: 'Device not paired. Please pair with BioPeak first.'
      })
      return
    }

    logger.info('🔄 Starting activity sync to BioPeak')
    this.globalData.syncing = true

    try {
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
      
      // Check if token expired
      if (error.message.includes('Invalid authentication') || error.message.includes('401')) {
        this.globalData.paired = false
        this.globalData.userToken = null
        // Clear stored credentials
        // localStorage.removeItem('biopeak_jwt')
        // localStorage.removeItem('zepp_device_id')
      }
      
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
      device_id: this.globalData.deviceId || activityData.device_id,
      activity_data: activityData.activity_data,
      user_profile: activityData.user_profile,
      sync_timestamp: Date.now()
    }

    // Don't log JWT token in plain text
    logger.info('📦 Request payload (JWT redacted):', {
      ...requestBody,
      jwt_present: !!this.globalData.userToken
    })

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

  // Method to check if device is paired
  isPaired() {
    return this.globalData.paired && !!this.globalData.userToken
  },

  // Method to clear stored credentials
  clearCredentials() {
    this.globalData.userToken = null
    this.globalData.deviceId = null
    this.globalData.paired = false
    
    // Clear from storage
    // localStorage.removeItem('biopeak_jwt')
    // localStorage.removeItem('zepp_device_id')
    
    logger.info('🧹 Credentials cleared')
  },

  onDestroy() {
    logger.info('🔚 BioPeak Side Service destroyed')
    if (messageBuilder) {
      messageBuilder.off()
    }
  }
})