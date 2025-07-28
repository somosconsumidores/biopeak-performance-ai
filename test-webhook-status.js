// Script simples para verificar webhook Polar
const checkWebhook = async () => {
  const token = 'aaa6f4948905ad1ad6c4847604ef368b';
  
  try {
    console.log('🔍 Verificando webhooks registrados na Polar...');
    
    const response = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', result);
    
    // Check if our webhook is in the list
    const expectedUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
    
    if (result.includes(expectedUrl)) {
      console.log('✅ Webhook ESTÁ registrado!');
    } else {
      console.log('❌ Webhook NÃO está registrado!');
      console.log('Tentando registrar...');
      
      const registerResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: expectedUrl
        })
      });
      
      const registerResult = await registerResponse.text();
      console.log('Registro - Status:', registerResponse.status);
      console.log('Registro - Response:', registerResult);
    }
    
  } catch (error) {
    console.error('Erro:', error);
  }
};

checkWebhook();