// Testar token e depois registrar webhook
const testAndRegisterWebhook = async () => {
  const accessToken = '4cc14b98736a2d466cc3d6a7bfadda6d';
  
  try {
    console.log('🧪 Primeiro: testando se o token está válido...');
    
    // Teste 1: Verificar se o token funciona com endpoint básico
    const testResponse = await fetch('https://www.polaraccesslink.com/v3/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('📊 Status do teste:', testResponse.status);
    const testResult = await testResponse.text();
    console.log('📝 Resultado do teste:', testResult);
    
    if (!testResponse.ok) {
      console.log('❌ Token inválido! Não posso registrar webhook.');
      return;
    }
    
    console.log('✅ Token válido! Agora tentando registrar webhook...');
    
    // Teste 2: Listar webhooks existentes primeiro
    console.log('📋 Listando webhooks existentes...');
    const listResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('📊 Status da lista:', listResponse.status);
    const listResult = await listResponse.text();
    console.log('📝 Webhooks existentes:', listResult);
    
    // Teste 3: Registrar webhook
    const webhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
    
    console.log('🔗 Registrando webhook...');
    const registerResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl
      })
    });
    
    console.log('📊 Status do registro:', registerResponse.status);
    const registerResult = await registerResponse.text();
    console.log('📝 Resultado do registro:', registerResult);
    
    if (registerResponse.ok) {
      console.log('✅ SUCESSO! Webhook registrado na Polar!');
    } else {
      console.log('❌ ERRO no registro. Verificando detalhes...');
      
      // Tentar extrair mais informações do erro
      try {
        const errorJson = JSON.parse(registerResult);
        console.log('🔍 Detalhes do erro:', errorJson);
      } catch (e) {
        console.log('🔍 Erro HTML retornado, não JSON');
      }
    }
    
  } catch (error) {
    console.error('💥 Erro na execução:', error);
  }
};

testAndRegisterWebhook();