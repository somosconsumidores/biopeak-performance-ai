// Análise completa da situação com token Polar
const analyzeTokenSituation = async () => {
  console.log('='.repeat(60));
  console.log('🔍 DIAGNÓSTICO COMPLETO DO TOKEN POLAR');
  console.log('='.repeat(60));
  
  const token = '4cc14b98736a2d466cc3d6a7bfadda6d';
  
  console.log('\n📋 INFORMAÇÕES DO PROBLEMA:');
  console.log('• Token no banco: 4cc14b98736a2d466cc3d6a7bfadda6d');
  console.log('• Data de expiração: 2035-07-26 (muito no futuro, suspeito)');
  console.log('• Status: ativo no banco');
  console.log('• Erro API: 401 Unauthorized');
  console.log('• User ID: ac254e78-99e3-428c-baa2-0fc60f6c9222');
  
  console.log('\n🧪 POSSÍVEIS CAUSAS:');
  console.log('1. Token gerado para ambiente sandbox, mas usando produção');
  console.log('2. Token invalidado pela Polar por algum motivo');
  console.log('3. Formato do token incorreto');
  console.log('4. Usuario não registrado corretamente na Polar');
  console.log('5. Permissões insuficientes');
  
  console.log('\n🔧 SOLUÇÕES RECOMENDADAS:');
  console.log('1. ✅ Fazer nova autenticação OAuth completa');
  console.log('2. ✅ Verificar se o usuário foi registrado na Polar (/v3/users)');
  console.log('3. ✅ Usar token fresh para registrar webhook');
  
  console.log('\n📝 PRÓXIMOS PASSOS:');
  console.log('1. Usuario deve desconectar conta Polar atual');
  console.log('2. Fazer nova autenticação OAuth');
  console.log('3. Garantir que o registro do usuário foi feito');
  console.log('4. Tentar registrar webhook com token novo');
  
  console.log('\n💡 ALTERNATIVA TÉCNICA:');
  console.log('• Tentar usar um dos outros tokens do banco');
  console.log('• Verificar se algum token mais antigo ainda funciona');
  
  // Testar tokens anteriores
  const oldTokens = [
    '91064df2e6454f1279b64c35f4704e66',
    '26e6002871353ecf9005ccb135e58b26',
    'aaa6f4948905ad1ad6c4847604ef368b'
  ];
  
  console.log('\n🔄 TESTANDO TOKENS ANTERIORES...');
  
  for (let i = 0; i < oldTokens.length; i++) {
    const testToken = oldTokens[i];
    try {
      console.log(`\n📍 Testando token ${i + 1}: ${testToken.substring(0, 8)}...`);
      
      const response = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        console.log(`   ✅ TOKEN FUNCIONA! Tentando registrar webhook...`);
        
        // Tentar registrar webhook com este token
        const webhookResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            url: 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook'
          })
        });
        
        console.log(`   📊 Status webhook: ${webhookResponse.status}`);
        const webhookResult = await webhookResponse.text();
        console.log(`   📝 Resultado: ${webhookResult.substring(0, 100)}...`);
        
        if (webhookResponse.ok) {
          console.log('\n🎯 SUCESSO! WEBHOOK REGISTRADO COM TOKEN ANTERIOR!');
          return;
        }
      } else {
        console.log(`   ❌ Token inválido (${response.status})`);
      }
      
    } catch (error) {
      console.log(`   💥 Erro: ${error.message}`);
    }
    
    // Pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n❌ CONCLUSÃO: Nenhum token existente funciona');
  console.log('🔄 É necessário fazer nova autenticação OAuth');
  console.log('\n' + '='.repeat(60));
};

analyzeTokenSituation();