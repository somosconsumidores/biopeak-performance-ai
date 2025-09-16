import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, TrendingUp, Shield, Brain, Calendar, Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

export const PromoEspecial = () => {
  console.log('🔍 PromoEspecial component rendering...');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ hours: 23, minutes: 59, seconds: 59 });

  console.log('🔍 PromoEspecial component loaded successfully');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1e293b', color: 'white', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>🎯 TESTE - Página Promoção Especial</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Se você está vendo esta mensagem, a página está funcionando!</p>
      <div style={{ backgroundColor: '#16a34a', padding: '1rem', borderRadius: '8px', display: 'inline-block' }}>
        <strong>Oferta Especial: R$ 12,90/mês</strong>
      </div>
    </div>
  );
};