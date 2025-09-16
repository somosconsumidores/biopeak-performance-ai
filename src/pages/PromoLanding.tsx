import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PromoLanding = () => {
  console.log('🔍 PROMO_LANDING: Componente executando agora - TESTE SIMPLES');
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ff0000', 
      color: '#ffffff', 
      padding: '20px',
      textAlign: 'center',
      fontSize: '24px'
    }}>
      <h1>🎯 LANDING PAGE PROMOCIONAL</h1>
      <p>Teste simples funcionando!</p>
      <p>URL atual: {window.location.pathname}</p>
    </div>
  );
};

export default PromoLanding;