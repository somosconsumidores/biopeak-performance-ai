#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://grcwlmltlcltmwbhdpky.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

async function cleanupTestActivities() {
  try {
    console.log('🧹 Starting cleanup of test activities...')
    console.log('User: sandro.biopeak@biopeak.com')
    console.log('Criteria: activity_date <= 2025-11-05')
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/all_activities?user_id=eq.0dcd5c6b-3e17-406c-adea-b4d6b6fa16be&activity_date=lte.2025-11-05`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const deleted = await response.json()
    console.log(`✅ Successfully deleted ${deleted.length} activities`)
    console.log('Remaining activities: Only those from 2025-11-06 onwards')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

cleanupTestActivities()
