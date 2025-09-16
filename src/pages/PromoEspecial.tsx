import React from 'react';

export const PromoEspecial = () => {
  console.log('🔍 PromoEspecial component is rendering!');
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000000', 
      color: '#ffffff', 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center' 
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '2rem', color: '#00ff00' }}>
        ✅ PÁGINA FUNCIONANDO!
      </h1>
      <p style={{ fontSize: '2rem', marginBottom: '2rem' }}>
        PromoEspecial está carregada corretamente
      </p>
      <div style={{ 
        backgroundColor: '#16a34a', 
        padding: '2rem', 
        borderRadius: '16px',
        fontSize: '1.5rem',
        fontWeight: 'bold'
      }}>
        🎯 Oferta Especial BioPeak Pro
        <br />
        R$ 12,90/mês
      </div>
    </div>
  );
};