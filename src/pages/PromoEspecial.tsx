import React from 'react';

console.log('🔍 PromoEspecial.tsx FILE LOADING');

const PromoEspecial = () => {
  console.log('🔍 PromoEspecial FUNCTION EXECUTING - RENDERING NOW');
  
  // Forçar erro se algo estiver interferindo
  try {
    // Use useEffect to ensure we override any global styles
    React.useEffect(() => {
      console.log('🔍 PromoEspecial useEffect EXECUTANDO');
      // Hide any potential interfering elements
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);
    
    console.log('🔍 PromoEspecial CHEGANDO NO RETURN');
    
    return React.createElement('div', {
      id: 'promo-especial-container',
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        backgroundColor: '#FF0000', 
        color: '#FFFFFF', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '2rem',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
        width: '100vw',
        height: '100vh'
      }
    }, [
      React.createElement('div', {
        key: 'title',
        style: { marginBottom: '2rem', fontSize: '3rem' }
      }, '🎯 PROMO ESPECIAL BIOPEAK'),
      React.createElement('div', {
        key: 'success',
        style: { marginBottom: '2rem', fontSize: '2rem', color: '#00FF00' }
      }, '✅ PÁGINA CARREGADA COM SUCESSO!'),
      React.createElement('div', {
        key: 'offer',
        style: { backgroundColor: '#00AA00', padding: '1rem', borderRadius: '8px' }
      }, 'Oferta Especial: R$ 12,90/mês'),
      React.createElement('div', {
        key: 'url',
        style: { marginTop: '2rem', fontSize: '1rem' }
      }, `URL atual: ${typeof window !== 'undefined' ? window.location.pathname : 'unknown'}`)
    ]);
    
  } catch (error) {
    console.error('🔍 ERRO NO PromoEspecial:', error);
    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        backgroundColor: '#FF0000',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '3rem'
      }
    }, `ERRO: ${error.message}`);
  }
};

console.log('🔍 Exporting PromoEspecial component');
export { PromoEspecial };