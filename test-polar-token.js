// Testar se o token Polar está funcionando
const testPolarToken = async () => {
  const token = '26e6002871353ecf9005ccb135e58b26';
  
  try {
    console.log('🧪 Testando token Polar...');
    
    // Testar com uma chamada simples para verificar se o token funciona
    const response = await fetch('https://www.polaraccesslink.com/v3/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Status da resposta:', response.status);
    const result = await response.text();
    console.log('📝 Resultado:', result);
    
    if (response.ok) {
      console.log('✅ Token está válido!');
    } else {
      console.log('❌ Token inválido ou expirado!');
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
};

testPolarToken();