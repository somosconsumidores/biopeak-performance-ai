// Testar token em ambiente sandbox e produção
const testTokenEnvironments = async () => {
  const accessToken = '4cc14b98736a2d466cc3d6a7bfadda6d';
  
  const environments = [
    {
      name: 'PRODUÇÃO',
      baseUrl: 'https://www.polaraccesslink.com'
    },
    {
      name: 'SANDBOX',
      baseUrl: 'https://sandbox.polaraccesslink.com'
    }
  ];
  
  for (const env of environments) {
    try {
      console.log(`\n🌍 Testando ambiente ${env.name}...`);
      console.log(`📡 URL: ${env.baseUrl}/v3/users`);
      
      const response = await fetch(`${env.baseUrl}/v3/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log(`📊 Status: ${response.status}`);
      const result = await response.text();
      console.log(`📝 Resultado: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`);
      
      if (response.ok) {
        console.log(`✅ TOKEN VÁLIDO NO AMBIENTE ${env.name}!`);
        
        // Se o token funciona, agora registrar o webhook neste ambiente
        console.log(`🔗 Registrando webhook no ambiente ${env.name}...`);
        
        const webhookResponse = await fetch(`${env.baseUrl}/v3/notifications`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            url: 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook'
          })
        });
        
        console.log(`📊 Status do webhook: ${webhookResponse.status}`);
        const webhookResult = await webhookResponse.text();
        console.log(`📝 Resultado do webhook: ${webhookResult}`);
        
        if (webhookResponse.ok) {
          console.log(`🎯 WEBHOOK REGISTRADO COM SUCESSO NO ${env.name}!`);
        } else {
          console.log(`❌ Erro ao registrar webhook no ${env.name}`);
        }
        
        return; // Para quando encontrar o ambiente correto
      } else {
        console.log(`❌ Token inválido no ambiente ${env.name}`);
      }
      
    } catch (error) {
      console.error(`💥 Erro testando ${env.name}:`, error.message);
    }
  }
  
  console.log('\n❌ Token não funciona em nenhum ambiente!');
};

testTokenEnvironments();