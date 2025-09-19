import { createWidget, widget, align, prop, event } from '@zos/ui'
import { Vibrator } from '@zos/sensor'
import { showToast } from '@zos/interaction'
import { MessageBuilder } from '@zos/ble'
import { log as Logger } from '@zos/utils'
import { push } from '@zos/router'
import { getProfile } from '@zos/user'
import { HeartRate, Geolocation, Step } from '@zos/sensor'

const logger = Logger.getLogger('BioPeak-Watch')
const vibrator = new Vibrator()
const messageBuilder = new MessageBuilder()

// Global state
let isConnected = false
let isPaired = false
let isSyncing = false
let pairingCode = ''

Page({
  onInit() {
    logger.info('BioPeak Sync - Initializing watch app')
    this.initializeUI()
    this.initializeBLE()
    this.checkPairingStatus()
  },

  initializeUI() {
    // Background
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 390,
      h: 450,
      color: 0x000000
    })

    // Title
    this.titleText = createWidget(widget.TEXT, {
      x: 0,
      y: 50,
      w: 390,
      h: 60,
      text: 'BioPeak Sync',
      text_size: 32,
      color: 0xFFFFFF,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })

    // Status text
    this.statusText = createWidget(widget.TEXT, {
      x: 0,
      y: 120,
      w: 390,
      h: 40,
      text: 'Checking connection...',
      text_size: 20,
      color: 0x888888,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })

    // Pairing code input (initially hidden)
    this.pairingCodeText = createWidget(widget.TEXT, {
      x: 0,
      y: 180,
      w: 390,
      h: 40,
      text: 'Enter pairing code:',
      text_size: 18,
      color: 0xFFFFFF,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })

    this.pairingCodeDisplay = createWidget(widget.TEXT, {
      x: 0,
      y: 220,
      w: 390,
      h: 50,
      text: '______',
      text_size: 36,
      color: 0x00FF00,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })

    // Action button
    this.actionButton = createWidget(widget.BUTTON, {
      x: 95,
      y: 300,
      w: 200,
      h: 60,
      text: 'Pair Device',
      normal_color: 0x333333,
      press_color: 0x555555,
      text_size: 20,
      color: 0xFFFFFF,
      click_func: () => this.handleActionButton()
    })

    // Sync button (initially hidden)
    this.syncButton = createWidget(widget.BUTTON, {
      x: 95,
      y: 380,
      w: 200,
      h: 60,
      text: 'Sync Now',
      normal_color: 0x0066CC,
      press_color: 0x0044AA,
      text_size: 20,
      color: 0xFFFFFF,
      click_func: () => this.syncActivity()
    })

    this.hideElement(this.pairingCodeText)
    this.hideElement(this.pairingCodeDisplay)
    this.hideElement(this.syncButton)
  },

  initializeBLE() {
    messageBuilder.connect(() => {
      isConnected = true
      logger.info('BLE connected to side service')
      this.updateStatus('Connected to phone')
    })

    messageBuilder.on('disconnect', () => {
      isConnected = false
      logger.info('BLE disconnected from side service')
      this.updateStatus('Disconnected from phone')
    })

    messageBuilder.on('call', (buf) => {
      const response = buf2json(buf)
      logger.info('Received response from side service', response)
      this.handleSideServiceResponse(response)
    })
  },

  checkPairingStatus() {
    if (isConnected) {
      const request = { type: 'ping', timestamp: Date.now() }
      messageBuilder.request(json2buf(request))
        .then((response) => {
          const data = buf2json(response)
          isPaired = data.paired || false
          this.updateUIForPairingStatus()
        })
        .catch(() => {
          this.updateStatus('Failed to check pairing status')
        })
    } else {
      setTimeout(() => this.checkPairingStatus(), 1000)
    }
  },

  updateStatus(text) {
    this.statusText.setProperty(prop.TEXT, text)
  },

  updateUIForPairingStatus() {
    if (isPaired) {
      this.updateStatus('Device paired successfully')
      this.actionButton.setProperty(prop.TEXT, 'Unpair Device')
      this.showElement(this.syncButton)
      this.hideElement(this.pairingCodeText)
      this.hideElement(this.pairingCodeDisplay)
    } else {
      this.updateStatus('Device not paired')
      this.actionButton.setProperty(prop.TEXT, 'Pair Device')
      this.hideElement(this.syncButton)
    }
  },

  handleActionButton() {
    if (isPaired) {
      this.unpairDevice()
    } else {
      this.startPairing()
    }
  },

  startPairing() {
    this.updateStatus('Enter 6-digit code from BioPeak app')
    this.showElement(this.pairingCodeText)
    this.showElement(this.pairingCodeDisplay)
    this.actionButton.setProperty(prop.TEXT, 'Submit Code')
    pairingCode = ''
    this.updatePairingCodeDisplay()
    
    // Simple code input simulation (in real app, you'd use proper input widgets)
    this.startPairingInput()
  },

  startPairingInput() {
    // This is a simplified version - in a real app you'd implement proper digit input
    // For now, we'll use a mock 6-digit code
    const mockCode = '123456'
    pairingCode = mockCode
    this.updatePairingCodeDisplay()
    
    setTimeout(() => {
      this.submitPairingCode()
    }, 2000)
  },

  updatePairingCodeDisplay() {
    const display = pairingCode.padEnd(6, '_')
    this.pairingCodeDisplay.setProperty(prop.TEXT, display)
  },

  submitPairingCode() {
    if (pairingCode.length !== 6) {
      showToast({ text: 'Please enter 6-digit code' })
      return
    }

    this.updateStatus('Pairing with BioPeak...')
    vibrator.scene('click')

    const request = {
      type: 'pair_device',
      pairingCode: pairingCode,
      timestamp: Date.now()
    }

    messageBuilder.request(json2buf(request))
      .then((response) => {
        const data = buf2json(response)
        this.handlePairingResponse(data)
      })
      .catch((error) => {
        logger.error('Pairing request failed', error)
        this.updateStatus('Pairing failed - try again')
        vibrator.scene('error')
      })
  },

  handlePairingResponse(response) {
    if (response.success) {
      isPaired = true
      this.updateStatus('Paired successfully!')
      this.updateUIForPairingStatus()
      vibrator.scene('success')
      showToast({ text: 'Device paired with BioPeak!' })
    } else {
      this.updateStatus('Pairing failed: ' + (response.error || 'Unknown error'))
      vibrator.scene('error')
      showToast({ text: 'Pairing failed - check code' })
    }
  },

  unpairDevice() {
    isPaired = false
    this.updateStatus('Device unpaired')
    this.updateUIForPairingStatus()
    showToast({ text: 'Device unpaired' })
  },

  syncActivity() {
    if (!isPaired || isSyncing) return

    isSyncing = true
    this.updateStatus('Syncing activity data...')
    this.syncButton.setProperty(prop.TEXT, 'Syncing...')
    vibrator.scene('click')

    // Collect activity data
    this.collectActivityData()
      .then((activityData) => {
        const request = {
          type: 'sync_activity',
          data: activityData,
          timestamp: Date.now()
        }

        return messageBuilder.request(json2buf(request))
      })
      .then((response) => {
        const data = buf2json(response)
        this.handleSyncResponse(data)
      })
      .catch((error) => {
        logger.error('Sync failed', error)
        this.updateStatus('Sync failed - try again')
        vibrator.scene('error')
      })
      .finally(() => {
        isSyncing = false
        this.syncButton.setProperty(prop.TEXT, 'Sync Now')
      })
  },

  async collectActivityData() {
    const profile = getProfile()
    const now = Date.now()

    // Get heart rate data
    let heartRate = null
    try {
      const hrSensor = new HeartRate()
      heartRate = hrSensor.getCurrent()
    } catch (e) {
      logger.warn('Failed to get heart rate', e)
    }

    // Get step data
    let steps = null
    try {
      const stepSensor = new Step()
      steps = stepSensor.getToday()
    } catch (e) {
      logger.warn('Failed to get steps', e)
    }

    // Get location data
    let location = null
    try {
      const geoSensor = new Geolocation()
      location = geoSensor.getLastKnownLocation()
    } catch (e) {
      logger.warn('Failed to get location', e)
    }

    return {
      timestamp: now,
      deviceId: profile?.id || 'unknown',
      heartRate: heartRate,
      steps: steps,
      location: location,
      activityType: 'general',
      duration: 0, // Would be calculated from actual activity
      calories: steps ? Math.floor(steps * 0.04) : null
    }
  },

  handleSyncResponse(response) {
    if (response.success) {
      this.updateStatus('Activity synced successfully!')
      vibrator.scene('success')
      showToast({ text: 'Data synced to BioPeak!' })
    } else {
      this.updateStatus('Sync failed: ' + (response.error || 'Unknown error'))
      vibrator.scene('error')
      showToast({ text: 'Sync failed - try again' })
    }
  },

  handleSideServiceResponse(response) {
    logger.info('Side service response', response)
    // Handle any async responses from the side service
  },

  showElement(element) {
    element.setProperty(prop.VISIBLE, true)
  },

  hideElement(element) {
    element.setProperty(prop.VISIBLE, false)
  },

  onDestroy() {
    logger.info('BioPeak Sync - Destroying watch app')
    messageBuilder.disConnect()
  }
})

// Utility functions
function json2buf(json) {
  const jsonStr = JSON.stringify(json)
  const buffer = new ArrayBuffer(jsonStr.length)
  const uint8Array = new Uint8Array(buffer)
  for (let i = 0; i < jsonStr.length; i++) {
    uint8Array[i] = jsonStr.charCodeAt(i)
  }
  return buffer
}

function buf2json(buffer) {
  const uint8Array = new Uint8Array(buffer)
  let jsonStr = ''
  for (let i = 0; i < uint8Array.length; i++) {
    jsonStr += String.fromCharCode(uint8Array[i])
  }
  return JSON.parse(jsonStr)
}