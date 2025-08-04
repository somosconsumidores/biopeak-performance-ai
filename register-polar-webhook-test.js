// Test script to register Polar webhook
const testWebhookRegistration = async () => {
  console.log('Testing Polar webhook registration...');
  
  const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/register-polar-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    },
    body: JSON.stringify({
      accessToken: '9491c108683a0456c922aba834e9c360',
      userId: 'b76cb8f5-1d6e-44bf-a301-661b6bc3b259'
    })
  });

  const result = await response.text();
  console.log('Response status:', response.status);
  console.log('Response body:', result);
};

// Run the test
testWebhookRegistration().catch(console.error);