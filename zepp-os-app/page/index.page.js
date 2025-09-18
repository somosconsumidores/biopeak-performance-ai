import { log as Logger } from '@zos/utils'
import { MessageBuilder } from '@zos/ble'
import { createWidget, widget, align, prop, text_style, event } from '@zos/ui'
import { Vibrator, VIBRATOR_SCENE_DURATION } from '@zos/sensor'
import { getProfile } from '@zos/user'
import { getPackageInfo } from '@zos/app'

const logger = Logger.getLogger('biopeak-sync')

const messageBuilder = new MessageBuilder()

Page({
  state: {
    syncing: false,
    connected: false
  },

  build() {
    logger.info('📱 BioPeak Sync App Started')
    
    // Header
    createWidget(widget.TEXT, {
      x: 0,
      y: 100,
      w: px(480),
      h: px(60),
      color: 0x00ff00,
      text_size: px(36),
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: 'BioPeak Sync'
    })

    // Status text
    this.statusText = createWidget(widget.TEXT, {
      x: 0,
      y: 180,
      w: px(480),
      h: px(40),
      color: 0xffffff,
      text_size: px(24),
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: 'Ready to sync'
    })

    // Sync button
    this.syncButton = createWidget(widget.BUTTON, {
      x: px(140),
      y: px(250),
      w: px(200),
      h: px(80),
      radius: px(40),
      normal_color: 0x00ff00,
      press_color: 0x00aa00,
      text: 'SYNC NOW',
      text_size: px(28),
      color: 0x000000,
      click_func: () => {
        this.startSync()
      }
    })

    // Connection status indicator
    this.connectionIndicator = createWidget(widget.CIRCLE, {
      center_x: px(50),
      y: px(50),
      radius: px(15),
      color: this.state.connected ? 0x00ff00 : 0xff0000
    })

    // Instructions
    createWidget(widget.TEXT, {
      x: px(20),
      y: px(380),
      w: px(440),
      h: px(100),
      color: 0xcccccc,
      text_size: px(18),
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
      text: 'Open BioPeak app on your phone first, then tap SYNC NOW to send your activity data.'
    })

    this.initializeBLE()
  },

  initializeBLE() {
    logger.info('🔗 Initializing BLE connection')
    
    messageBuilder.connect(() => {
      logger.info('✅ BLE connected')
      this.state.connected = true
      this.updateConnectionStatus()
    })

    messageBuilder.on('disconnect', () => {
      logger.info('❌ BLE disconnected')
      this.state.connected = false
      this.updateConnectionStatus()
    })

    // Listen for responses from side service
    messageBuilder.on('call', (data) => {
      logger.info('📨 Received from side service:', data)
      
      if (data.type === 'sync_complete') {
        this.onSyncComplete(data.success, data.message)
      } else if (data.type === 'sync_error') {
        this.onSyncError(data.error)
      }
    })
  },

  updateConnectionStatus() {
    if (this.connectionIndicator) {
      this.connectionIndicator.setProperty(prop.COLOR, 
        this.state.connected ? 0x00ff00 : 0xff0000)
    }
    
    if (this.statusText && !this.state.syncing) {
      this.statusText.setProperty(prop.TEXT, 
        this.state.connected ? 'Connected - Ready to sync' : 'Connecting to phone...')
    }
  },

  async startSync() {
    if (this.state.syncing) {
      logger.info('⏳ Sync already in progress')
      return
    }

    if (!this.state.connected) {
      logger.error('❌ Not connected to phone')
      this.showError('Not connected to phone')
      return
    }

    logger.info('🚀 Starting sync process')
    
    this.state.syncing = true
    this.statusText.setProperty(prop.TEXT, 'Collecting data...')
    this.syncButton.setProperty(prop.TEXT, 'SYNCING...')
    
    // Vibrate to indicate start
    const vibrator = new Vibrator()
    vibrator.setMode(VIBRATOR_SCENE_DURATION.VERY_SHORT)
    vibrator.start()

    try {
      // Collect activity data
      const activityData = await this.collectActivityData()
      
      logger.info('📊 Activity data collected:', activityData)
      
      // Send to side service
      this.statusText.setProperty(prop.TEXT, 'Sending to BioPeak...')
      
      messageBuilder.request({
        type: 'sync_activity',
        data: activityData,
        timestamp: Date.now()
      })

    } catch (error) {
      logger.error('💥 Sync error:', error)
      this.onSyncError(error.message)
    }
  },

  async collectActivityData() {
    logger.info('📊 Collecting activity data from device')
    
    try {
      // Get user profile
      const profile = getProfile()
      const packageInfo = getPackageInfo()
      
      // Simulate activity data (in real implementation, get from sensors)
      // Note: Real implementation would use @zos/sensor APIs
      const mockActivityData = {
        device_id: packageInfo?.appId?.toString() || 'zepp_device',
        user_profile: {
          height: profile?.height || null,
          weight: profile?.weight || null,
          gender: profile?.gender || null,
          age: profile?.age || null
        },
        activity_data: {
          activity_type: 'running', // Would be detected from actual workout
          start_time: Math.floor(Date.now() / 1000) - 1800, // 30 min ago
          duration: 1800, // 30 minutes
          distance: 5000, // 5km
          calories: 250,
          heart_rate: {
            average: 150,
            max: 175,
            samples: this.generateHRSamples(1800, 150, 175)
          },
          steps: 6500,
          gps_data: this.generateGPSData(1800) // Mock GPS data
        }
      }

      return mockActivityData
      
    } catch (error) {
      logger.error('❌ Error collecting activity data:', error)
      throw error
    }
  },

  generateHRSamples(duration, avgHR, maxHR) {
    const samples = []
    const sampleCount = Math.floor(duration / 60) // One sample per minute
    
    for (let i = 0; i < sampleCount; i++) {
      // Generate realistic HR variation
      const variation = (Math.random() - 0.5) * 20
      const hr = Math.max(100, Math.min(maxHR, avgHR + variation))
      samples.push(Math.floor(hr))
    }
    
    return samples
  },

  generateGPSData(duration) {
    const gpsData = []
    const sampleCount = Math.floor(duration / 30) // One sample per 30 seconds
    
    // Mock starting position (São Paulo)
    let lat = -23.5505
    let lng = -46.6333
    
    for (let i = 0; i < sampleCount; i++) {
      // Simulate movement
      lat += (Math.random() - 0.5) * 0.0001
      lng += (Math.random() - 0.5) * 0.0001
      
      gpsData.push({
        timestamp: Math.floor(Date.now() / 1000) - duration + (i * 30),
        latitude: lat,
        longitude: lng,
        altitude: 750 + (Math.random() * 20),
        speed: 3.5 + (Math.random() * 1.0) // ~3-4.5 m/s
      })
    }
    
    return gpsData
  },

  onSyncComplete(success, message) {
    logger.info('✅ Sync completed:', { success, message })
    
    this.state.syncing = false
    this.syncButton.setProperty(prop.TEXT, 'SYNC NOW')
    
    if (success) {
      this.statusText.setProperty(prop.TEXT, 'Sync successful!')
      this.statusText.setProperty(prop.COLOR, 0x00ff00)
      
      // Success vibration
      const vibrator = new Vibrator()
      vibrator.setMode(VIBRATOR_SCENE_DURATION.SHORT)
      vibrator.start()
      
      // Reset status after 3 seconds
      setTimeout(() => {
        if (this.statusText) {
          this.statusText.setProperty(prop.TEXT, 'Ready to sync')
          this.statusText.setProperty(prop.COLOR, 0xffffff)
        }
      }, 3000)
      
    } else {
      this.showError(message || 'Sync failed')
    }
  },

  onSyncError(error) {
    logger.error('❌ Sync error:', error)
    
    this.state.syncing = false
    this.syncButton.setProperty(prop.TEXT, 'SYNC NOW')
    this.showError(error)
  },

  showError(message) {
    this.statusText.setProperty(prop.TEXT, `Error: ${message}`)
    this.statusText.setProperty(prop.COLOR, 0xff0000)
    
    // Error vibration
    const vibrator = new Vibrator()
    vibrator.setMode(VIBRATOR_SCENE_DURATION.LONG)
    vibrator.start()
    
    // Reset status after 5 seconds
    setTimeout(() => {
      if (this.statusText) {
        this.statusText.setProperty(prop.TEXT, 'Ready to sync')
        this.statusText.setProperty(prop.COLOR, 0xffffff)
      }
    }, 5000)
  },

  onDestroy() {
    logger.info('🔚 BioPeak Sync App destroyed')
    if (messageBuilder) {
      messageBuilder.disConnect()
    }
  }
})