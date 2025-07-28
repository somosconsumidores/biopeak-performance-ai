// Testar diferentes endpoints da API Polar
const testPolarEndpoints = async () => {
  const accessToken = '4cc14b98736a2d466cc3d6a7bfadda6d';
  
  const environments = [
    { name: 'PRODUÇÃO', baseUrl: 'https://www.polaraccesslink.com' },
    { name: 'SANDBOX', baseUrl: 'https://sandbox.polaraccesslink.com' }
  ];
  
  // Diferentes endpoints para testar
  const testEndpoints = [
    { path: '/v3/users', method: 'GET', desc: 'Usuários' },
    { path: '/v3/notifications', method: 'GET', desc: 'Webhooks existentes' },
    { path: '/v3/users/registration', method: 'GET', desc: 'Registro do usuário' },
    { path: '/v3', method: 'GET', desc: 'Raiz da API' }
  ];
  
  for (const env of environments) {
    console.log(`\n🌍 === TESTANDO AMBIENTE ${env.name} ===`);
    
    for (const endpoint of testEndpoints) {
      try {
        const url = `${env.baseUrl}${endpoint.path}`;
        console.log(`\n📡 Testando: ${endpoint.method} ${url}`);
        
        const response = await fetch(url, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        console.log(`📊 Status: ${response.status} (${response.statusText})`);
        
        // Pegar apenas os primeiros caracteres da resposta
        const result = await response.text();
        const shortResult = result.substring(0, 300);
        console.log(`📝 Resposta: ${shortResult}${result.length > 300 ? '...' : ''}`);
        
        if (response.ok) {
          console.log(`✅ SUCESSO! Token válido em ${env.name} - ${endpoint.desc}`);
          
          // Se encontramos um endpoint que funciona, tentar registrar o webhook
          if (endpoint.path === '/v3/notifications' && endpoint.method === 'GET') {
            console.log(`\n🔗 Tentando registrar webhook em ${env.name}...`);
            
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
            
            console.log(`📊 Status webhook: ${webhookResponse.status}`);
            const webhookResult = await webhookResponse.text();
            console.log(`📝 Resultado webhook: ${webhookResult.substring(0, 200)}`);
            
            if (webhookResponse.ok) {
              console.log(`🎯 WEBHOOK REGISTRADO COM SUCESSO!`);
              return;
            }
          }
        } else if (response.status === 405) {
          console.log(`⚠️ Método ${endpoint.method} não permitido para ${endpoint.path}`);
        } else if (response.status === 401) {
          console.log(`🔑 Token não autorizado para ${endpoint.path}`);
        } else {
          console.log(`❌ Erro ${response.status} para ${endpoint.path}`);
        }
        
      } catch (error) {
        console.error(`💥 Erro de rede para ${endpoint.path}:`, error.message);
        
        // Se for erro de rede no sandbox, pode ser que a URL esteja incorreta
        if (env.name === 'SANDBOX' && error.message.includes('fetch failed')) {
          console.log(`ℹ️ Pode ser que o ambiente sandbox tenha URL diferente`);
        }
      }
      
      // Pequena pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n❌ Nenhum endpoint funcionou. O token pode estar realmente inválido.');
};

testPolarEndpoints();