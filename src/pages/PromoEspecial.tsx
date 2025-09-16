import React from 'react';

console.log('🔍 PromoEspecial.tsx FILE LOADING');

const PromoEspecial = () => {
  console.log('🔍 PromoEspecial FUNCTION EXECUTING - RENDERING NOW');
  
  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: '#FF0000', 
        color: '#FFFFFF', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '2rem'
      }}
    >
      <div style={{ marginBottom: '2rem', fontSize: '3rem' }}>
        🎯 PROMO ESPECIAL BIOPEAK
      </div>
      <div style={{ marginBottom: '2rem', fontSize: '2rem', color: '#00FF00' }}>
        ✅ PÁGINA CARREGADA COM SUCESSO!
      </div>
      <div style={{ backgroundColor: '#00AA00', padding: '1rem', borderRadius: '8px' }}>
        Oferta Especial: R$ 12,90/mês
      </div>
      <div style={{ marginTop: '2rem', fontSize: '1rem' }}>
        URL atual: {window.location.pathname}
      </div>
    </div>
  );
};

console.log('🔍 Exporting PromoEspecial component');
export { PromoEspecial };