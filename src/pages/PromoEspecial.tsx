import React from 'react';

console.log('🔍 PromoEspecial.tsx FILE LOADING');

const PromoEspecial = () => {
  console.log('🔍 PromoEspecial FUNCTION EXECUTING');
  
  return React.createElement('div', {
    style: { 
      minHeight: '100vh', 
      backgroundColor: '#FF0000', 
      color: '#FFFFFF', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '3rem',
      fontWeight: 'bold'
    }
  }, 'PROMO ESPECIAL FUNCIONANDO - FUNDO VERMELHO');
};

console.log('🔍 Exporting PromoEspecial component');
export { PromoEspecial };