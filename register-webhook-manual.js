// Registrar webhook global na Polar manualmente
const registerPolarWebhook = async () => {
  const accessToken = '4cc14b98736a2d466cc3d6a7bfadda6d';
  const webhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
  
  try {
    console.log('🔗 Registrando webhook global na Polar...');
    console.log('📡 Webhook URL:', webhookUrl);
    console.log('🔑 Token:', accessToken.substring(0, 8) + '...');
    
    const response = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl
      })
    });
    
    console.log('📊 Status da resposta:', response.status);
    const result = await response.text();
    console.log('📝 Resultado:', result);
    
    if (response.ok) {
      console.log('✅ SUCESSO! Webhook registrado na Polar!');
      console.log('🎯 A Polar agora enviará notificações para nosso webhook');
    } else {
      console.log('❌ ERRO no registro:', result);
    }
    
  } catch (error) {
    console.error('💥 Erro na execução:', error);
  }
};

registerPolarWebhook();