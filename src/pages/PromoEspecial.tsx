import React from 'react';

// LOG IMEDIATO NA IMPORTAÇÃO
console.log('🚨 PROMO ESPECIAL - ARQUIVO CARREGADO AGORA:', new Date().toISOString());

const PromoEspecial = () => {
  console.log('🚨 PROMO ESPECIAL - COMPONENTE EXECUTADO AGORA:', new Date().toISOString());
  console.log('🚨 PROMO ESPECIAL - WINDOW LOCATION:', window.location.href);
  
  // CRIAR ELEMENTO DIRETO NO BODY - FORÇADO
  React.useEffect(() => {
    console.log('🚨 PROMO ESPECIAL - USE EFFECT EXECUTADO');
    
    // Remove TUDO do body e coloca só nossa div
    const originalBodyContent = document.body.innerHTML;
    
    document.body.innerHTML = `
      <div id="PROMO_FORCE" style="
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: red !important;
        color: white !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 999999 !important;
        font-size: 3rem !important;
        font-family: Arial !important;
        flex-direction: column !important;
      ">
        <div>🎯 PROMO ESPECIAL FUNCIONANDO!</div>
        <div style="font-size: 2rem; margin-top: 20px;">URL: ${window.location.pathname}</div>
        <div style="font-size: 1.5rem; margin-top: 20px;">Timestamp: ${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    
    console.log('🚨 PROMO ESPECIAL - CONTEÚDO FORÇADO NO BODY');
    
    // Cleanup - restaura conteúdo original quando o componente for desmontado
    return () => {
      document.body.innerHTML = originalBodyContent;
    };
  }, []);
  
  // Retorna também um componente React como backup
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'blue',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 888888,
      fontSize: '3rem',
      fontFamily: 'Arial'
    }}>
      BACKUP REACT - PROMO ESPECIAL
    </div>
  );
};

console.log('🚨 PROMO ESPECIAL - EXPORTANDO COMPONENTE');
export { PromoEspecial };