// Script de teste para o build-activity-chart-cache
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBuildCache() {
  console.log('Testing build-activity-chart-cache...');
  
  try {
    const result = await supabase.functions.invoke('build-activity-chart-cache', {
      body: {
        activity_id: '1180f6ee-6168-43e3-b3ee-cf2b1f5bc43c',
        user_id: '854037c9-66d5-4aec-9393-4c430d197b4e',
        activity_source: 'gpx',
        version: 1
      }
    });
    
    console.log('Result:', result);
    
    if (result.error) {
      console.error('Edge function error:', result.error);
    } else {
      console.log('Success:', result.data);
    }
    
  } catch (error) {
    console.error('Error calling edge function:', error);
  }
}

testBuildCache();