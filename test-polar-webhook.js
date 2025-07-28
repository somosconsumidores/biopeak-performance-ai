// Script para testar o webhook da Polar
const testPolarWebhook = async () => {
  console.log('🧪 TESTANDO WEBHOOK DA POLAR');
  console.log('='.repeat(50));
  
  // URL do webhook em produção
  const webhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
  
  // Payload simulado baseado na documentação da Polar
  const testPayload = {
    event: 'EXERCISE',
    userId: 17394, // Usando um dos IDs dos tokens no banco
    timestamp: new Date().toISOString()
  };
  
  console.log('📡 Enviando payload simulado:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n📍 Para URL:', webhookUrl);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Polar-Webhook-Test/1.0'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('\n📊 RESPOSTA DO WEBHOOK:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ WEBHOOK RESPONDEU COM SUCESSO!');
      console.log('Verifique a tabela polar_webhook_logs para confirmar que o log foi salvo.');
    } else {
      console.log('\n❌ WEBHOOK RETORNOU ERRO');
      if (response.status === 404) {
        console.log('💡 Isso é esperado se não houver token ativo para o userId 17394');
      }
    }
    
  } catch (error) {
    console.error('\n💥 ERRO NA CHAMADA:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🔍 PRÓXIMOS PASSOS:');
  console.log('1. Verifique os logs da função: Edge Functions > polar-activities-webhook > Logs');
  console.log('2. Consulte a tabela polar_webhook_logs no SQL Editor');
  console.log('3. Se necessário, ajuste o userId para um que tenha token ativo');
};

// Teste adicional com userId diferente (caso o primeiro não tenha token)
const testWithDifferentUser = async () => {
  console.log('\n🔄 TESTANDO COM USERID DIFERENTE...');
  
  const testPayload2 = {
    event: 'EXERCISE',
    userId: 999999, // ID que certamente não existe
    timestamp: new Date().toISOString()
  };
  
  try {
    const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Polar-Webhook-Test/1.0'
      },
      body: JSON.stringify(testPayload2)
    });
    
    console.log('Status para userId inexistente:', response.status);
    const responseText = await response.text();
    console.log('Resposta:', responseText);
    
    console.log('\n💡 Este teste deve criar um log mesmo sem usuário encontrado');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
};

// Executar os testes
const runAllTests = async () => {
  await testPolarWebhook();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa entre testes
  await testWithDifferentUser();
  
  console.log('\n📋 COMANDOS SQL PARA VERIFICAR LOGS:');
  console.log('-- Ver todos os logs do webhook:');
  console.log('SELECT * FROM polar_webhook_logs ORDER BY created_at DESC LIMIT 10;');
  console.log('\n-- Ver logs com detalhes:');
  console.log('SELECT id, user_id, polar_user_id, webhook_type, status, error_message, created_at FROM polar_webhook_logs ORDER BY created_at DESC;');
};

runAllTests();