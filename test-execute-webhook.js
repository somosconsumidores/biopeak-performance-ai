// Executar o registro do webhook Polar diretamente
const executeWebhookRegistration = async () => {
  try {
    console.log('🚀 Executando registro do webhook Polar...');
    
    const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/force-check-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    console.log('📊 Status da resposta:', response.status);
    console.log('📝 Resultado completo:', JSON.stringify(result, null, 2));
    
    if (result.status === 'REGISTERED') {
      console.log('✅ SUCESSO! Webhook registrado na Polar!');
    } else if (result.status === 'ALREADY_REGISTERED') {
      console.log('✅ PERFEITO! Webhook já estava registrado na Polar!');
    } else {
      console.log('❌ ERRO no registro:', result.message);
    }
    
  } catch (error) {
    console.error('💥 Erro na execução:', error);
  }
};

executeWebhookRegistration();