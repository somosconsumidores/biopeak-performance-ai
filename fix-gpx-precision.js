#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgpejnuhmqsxldpqkqjz.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

async function fixGpxPrecision() {
  try {
    console.log('🔧 Calling fix-gpx-activity-precision function...')
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fix-gpx-activity-precision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Fix completed:', JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

fixGpxPrecision()