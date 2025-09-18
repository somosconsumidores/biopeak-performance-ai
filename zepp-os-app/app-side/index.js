import { MessageBuilder } from '@zos/ble'
import { log as Logger } from '@zos/utils'
import { localStorage } from '@zos/storage'

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
    logger.info('🔑 Loading stored credentials from persistent storage')
    
    try {
      const storedToken = this.loadJWT()
      const storedDeviceId = this.getStoredValue('zepp_device_id')
      
      if (storedToken && storedDeviceId) {
        this.globalData.userToken = storedToken
        this.globalData.deviceId = storedDeviceId
        this.globalData.paired = true
        logger.info('✅ JWT credentials restored from storage')
      } else {
        logger.info('ℹ️ No stored credentials - device pairing required')
        this.globalData.paired = false
        this.globalData.userToken = null
        this.globalData.deviceId = null
      }
    } catch (error) {
      logger.error('❌ Error loading stored credentials:', error)
      this.globalData.paired = false
    }
  },

  // Persistent storage for JWT tokens
  saveJWT(token) {
    try {
      localStorage.setItem('biopeak_jwt', token)
      logger.info('💾 JWT token saved to storage')
      return true
    } catch (error) {
      logger.error('❌ Failed to save JWT:', error)
      return false
    }
  },

  loadJWT() {
    try {
      const token = localStorage.getItem('biopeak_jwt')
      if (token) {
        logger.info('🔑 JWT token loaded from storage')
        return token
      }
      return null
    } catch (error) {
      logger.error('❌ Failed to load JWT:', error)
      return null
    }
  },

  clearJWT() {
    try {
      localStorage.removeItem('biopeak_jwt')
      localStorage.removeItem('zepp_device_id')
      logger.info('🧹 JWT credentials cleared from storage')
      return true
    } catch (error) {
      logger.error('❌ Failed to clear JWT:', error)
      return false
    }
  },

  // Legacy storage methods for compatibility
  getStoredValue(key) {
    try {
      return localStorage.getItem(key) || null
    } catch {
      return null
    }
  },

  setStoredValue(key, value) {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },

  removeStoredValue(key) {
    try {
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  },

  handleDeviceRequest(ctx) {
    const { payload } = ctx.request
    
    try {
      if (payload.type === 'sync_activity') {
        this.handleActivitySync(payload.data, ctx)
      } else if (payload.type === 'pair_device') {
        this.handleDevicePairing(payload.pairing_code, ctx)
      } else if (payload.type === 'ping') {
        // Respond to ping with pong (keep-alive)
        logger.debug('🏓 Ping received, responding with pong')
        ctx.response({ type: 'pong', success: true })
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

  handleDeviceCall(ctx) {
    // Handle direct calls from device
    logger.info('📞 Handling device call')
  },

  handleDevicePairing(pairingCode, ctx) {
    logger.info('🔗 Starting device pairing with code:', pairingCode)
    
    try {
      fetch(PAIR_API_URL, {
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
      .then(response => response.json())
      .then(responseData => {
        if (responseData.success && responseData.jwt_token) {
          // Store credentials in memory
          this.globalData.userToken = responseData.jwt_token
          this.globalData.deviceId = responseData.device_id
          this.globalData.paired = true
          
          // Persist JWT securely for future sessions
          this.saveJWT(responseData.jwt_token)
          this.setStoredValue('zepp_device_id', responseData.device_id)
          
          logger.info('✅ Device paired and JWT persisted successfully')
          
          ctx.response({
            type: 'pairing_complete',
            success: true,
            message: 'Device paired with BioPeak!'
          })
        } else {
          ctx.response({
            type: 'pairing_error',
            error: 'Invalid pairing response'
          })
        }
      })
      .catch(error => {
        logger.error('❌ Pairing failed:', error)
        ctx.response({
          type: 'pairing_error',
          error: error.message || 'Pairing failed unexpectedly'
        })
      })
    } catch (error) {
      // Ensure ctx.response is always called, even on unexpected errors
      logger.error('❌ Pairing setup failed:', error)
      ctx.response({
        type: 'pairing_error',
        error: error.message || 'Pairing failed unexpectedly'
      })
    }
  },

  handleActivitySync(activityData, ctx) {
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
      
      this.sendToBioPeak(activityData)
        .then(response => {
          if (response.success) {
            logger.info('✅ Activity synced successfully:', response.activity_id)
            
            ctx.response({
              type: 'sync_complete',
              success: true,
              message: 'Activity synced to BioPeak!',
              activity_id: response.activity_id
            })
          } else {
            ctx.response({
              type: 'sync_error',
              error: response.error || 'Unknown API error'
            })
          }
          this.globalData.syncing = false
        })
        .catch(error => {
          logger.error('❌ Activity sync failed:', error)
          
          // Check if token expired or invalid (401 Unauthorized)
          if (error.message.includes('Invalid authentication') || 
              error.message.includes('401') || 
              error.message.includes('Unauthorized')) {
            logger.warn('🔑 JWT token expired or invalid - clearing credentials')
            this.globalData.paired = false
            this.globalData.userToken = null
            this.globalData.deviceId = null
            // Clear persisted credentials
            this.clearJWT()
          }
          
          ctx.response({
            type: 'sync_error',
            error: error.message
          })
          this.globalData.syncing = false
        })

    } catch (error) {
      logger.error('❌ Activity sync setup failed:', error)
      ctx.response({
        type: 'sync_error',
        error: error.message
      })
      this.globalData.syncing = false
    }
  },

  sendToBioPeak(activityData) {
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

    return fetch(BIOPEAK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${this.globalData.userToken}`
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errorData => {
          logger.error('❌ API response error:', response.status, errorData)
          throw new Error(errorData.error || `HTTP ${response.status}`)
        })
      }
      return response.json()
    })
    .then(responseData => {
      logger.info('✅ API response success:', responseData)
      return responseData
    })
    .catch(error => {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Check internet connection.')
      }
      throw error
    })
  },

  // Method to check if device is paired
  isPaired() {
    return this.globalData.paired && !!this.globalData.userToken
  },

  // Method to clear stored credentials completely
  clearCredentials() {
    logger.info('🧹 Clearing all stored credentials')
    
    this.globalData.userToken = null
    this.globalData.deviceId = null
    this.globalData.paired = false
    
    // Clear from persistent storage
    this.clearJWT()
    
    logger.info('✅ All credentials cleared successfully')
  },

  onDestroy() {
    logger.info('🔚 BioPeak Side Service destroyed')
    if (messageBuilder) {
      messageBuilder.off()
    }
  }
})