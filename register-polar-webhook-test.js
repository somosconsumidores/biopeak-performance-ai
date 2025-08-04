// Test script to register Polar webhook - corrected version
const testWebhookRegistration = async () => {
  console.log('Testing Polar webhook registration...');
  
  const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/register-polar-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    },
    body: JSON.stringify({
      action: 'register'
    })
  });

  const result = await response.text();
  console.log('Response status:', response.status);
  console.log('Response body:', result);
};

// Test listing existing webhooks
const testListWebhooks = async () => {
  console.log('Testing webhook listing...');
  
  const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/register-polar-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    },
    body: JSON.stringify({
      action: 'list'
    })
  });

  const result = await response.text();
  console.log('List response status:', response.status);
  console.log('List response body:', result);
};

// Run the tests
console.log('=== Testing Polar Webhook Registration ===');
testListWebhooks()
  .then(() => testWebhookRegistration())
  .catch(console.error);