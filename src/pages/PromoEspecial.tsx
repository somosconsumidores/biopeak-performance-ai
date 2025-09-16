import React, { useEffect } from 'react';

console.log('🔍 PromoEspecial.tsx FILE LOADING');

const PromoEspecial = () => {
  console.log('🔍 PromoEspecial FUNCTION EXECUTING - RENDERING NOW');
  
  useEffect(() => {
    console.log('🔍 PromoEspecial useEffect EXECUTANDO');
    
    // Força criação do elemento diretamente no DOM
    const createPromoElement = () => {
      // Remove qualquer elemento existente
      const existing = document.getElementById('promo-especial-direct');
      if (existing) {
        existing.remove();
      }
      
      // Cria um novo elemento diretamente no body
      const promoDiv = document.createElement('div');
      promoDiv.id = 'promo-especial-direct';
      promoDiv.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 999999 !important;
        background-color: #FF0000 !important;
        color: #FFFFFF !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 2rem !important;
        font-weight: bold !important;
        text-align: center !important;
        padding: 2rem !important;
        font-family: Arial, sans-serif !important;
        box-sizing: border-box !important;
        width: 100vw !important;
        height: 100vh !important;
      `;
      
      promoDiv.innerHTML = `
        <div style="margin-bottom: 2rem; font-size: 3rem;">
          🎯 PROMO ESPECIAL BIOPEAK
        </div>
        <div style="margin-bottom: 2rem; font-size: 2rem; color: #00FF00;">
          ✅ PÁGINA CARREGADA COM SUCESSO!
        </div>
        <div style="background-color: #00AA00; padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
          Oferta Especial: R$ 12,90/mês
        </div>
        <div style="font-size: 1rem;">
          URL atual: ${window.location.pathname}
        </div>
        <div style="font-size: 1rem; margin-top: 1rem;">
          Timestamp: ${new Date().toLocaleTimeString()}
        </div>
      `;
      
      // Adiciona ao body
      document.body.appendChild(promoDiv);
      
      // Force hide other elements
      document.body.style.overflow = 'hidden';
      
      console.log('🔍 PromoEspecial - Elemento criado diretamente no DOM!');
    };
    
    // Executa imediatamente
    createPromoElement();
    
    // Cleanup
    return () => {
      const existing = document.getElementById('promo-especial-direct');
      if (existing) {
        existing.remove();
      }
      document.body.style.overflow = 'auto';
    };
  }, []);
  
  // Também retorna um elemento React como fallback
  return (
    <div 
      id="promo-especial-react"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 888888,
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
      }}
    >
      <div style={{ marginBottom: '2rem', fontSize: '3rem' }}>
        🎯 PROMO ESPECIAL BIOPEAK (REACT)
      </div>
      <div style={{ marginBottom: '2rem', fontSize: '2rem', color: '#00FF00' }}>
        ✅ VERSÃO REACT FUNCIONANDO!
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