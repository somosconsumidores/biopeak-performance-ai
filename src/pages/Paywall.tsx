import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, X, BarChart3, Brain, Calendar, Activity, Target, TrendingUp, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { loadStripe } from '@stripe/stripe-js';

// Interface para controle de estado do checkout
interface CheckoutState {
  isInitializing: boolean;
  isActive: boolean;
  instance: any;
  containerId: string;
  plan: 'monthly' | 'annual';
}

export const Paywall = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { refreshSubscription } = useSubscription();
  
  // Estado robusto para controle do checkout
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>(() => {
    const planParam = new URLSearchParams(window.location.search).get('plan');
    return (planParam === 'monthly' || planParam === 'annual') ? planParam : 'annual';
  });
  
  const [loading, setLoading] = useState(false);
  const [showEmbedded, setShowEmbedded] = useState(false);
  
  // Refs para controle direto do DOM e instâncias
  const checkoutStateRef = useRef<CheckoutState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle successful payment redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success) {
      // Refresh subscription status and redirect to dashboard
      refreshSubscription().then(() => {
        toast({
          title: "Pagamento confirmado!",
          description: "Sua assinatura foi ativada com sucesso. Redirecionando...",
        });
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      });
    } else if (canceled) {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive"
      });
    }
  }, [searchParams, refreshSubscription, navigate, toast]);

  const handleClose = () => {
    // Navegar para /sync após fechar o paywall
    navigate('/sync');
  };

  // Função de cleanup definitiva
  const performAdvancedCleanup = useCallback(async () => {
    console.log('[CLEANUP] Iniciando cleanup avançado...');
    
    // Limpar timeouts pendentes
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    
    // Cleanup da instância atual
    if (checkoutStateRef.current?.instance) {
      try {
        console.log('[CLEANUP] Desmontando instância atual...');
        await checkoutStateRef.current.instance.unmount();
        console.log('[CLEANUP] Instância desmontada com sucesso');
      } catch (error) {
        console.log('[CLEANUP] Erro ao desmontar (esperado):', error);
      }
    }
    
    // Limpar DOM completamente
    if (containerRef.current) {
      console.log('[CLEANUP] Limpando DOM...');
      containerRef.current.innerHTML = '';
    }
    
    // Resetar estado
    checkoutStateRef.current = null;
    
    // Aguardar um tempo para garantir cleanup completo
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[CLEANUP] Cleanup concluído');
  }, []);

  const handleStartNow = useCallback(async () => {
    if (loading || (checkoutStateRef.current?.isInitializing)) {
      console.log('[START] Operação já em andamento, ignorando...');
      return;
    }
    
    console.log(`[START] Iniciando checkout para plano: ${selectedPlan}`);
    setLoading(true);
    
    try {
      // Cleanup completo antes de iniciar
      await performAdvancedCleanup();
      
      // Aguardar um pouco mais para garantir que tudo foi limpo
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setShowEmbedded(true);
    } catch (error) {
      console.error('[START] Erro durante inicialização:', error);
      setLoading(false);
      toast({
        title: 'Erro',
        description: 'Falha ao inicializar checkout. Tente novamente.',
        variant: 'destructive'
      });
    }
  }, [loading, selectedPlan, performAdvancedCleanup, toast]);

  // Inicialização robusta do checkout
  const initializeCheckout = useCallback(async () => {
    if (!showEmbedded || checkoutStateRef.current?.isInitializing) {
      console.log('[INIT] Bloqueado - showEmbedded:', showEmbedded, 'isInitializing:', checkoutStateRef.current?.isInitializing);
      return;
    }
    
    const containerId = `embedded-checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[INIT] Inicializando checkout: ${containerId}, plano: ${selectedPlan}`);
    
    // Marcar como inicializando
    checkoutStateRef.current = {
      isInitializing: true,
      isActive: false,
      instance: null,
      containerId,
      plan: selectedPlan
    };

    try {
      // 1) Buscar chave pública
      console.log('[INIT] Buscando chave pública...');
      const { data: pkData, error: pkError } = await supabase.functions.invoke('get-stripe-publishable-key');
      console.log('[INIT] Resposta da chave pública:', { pkData, pkError });
      
      if (pkError) {
        throw new Error(`Erro ao buscar chave pública: ${pkError.message}`);
      }
      if (!pkData?.publishableKey) {
        throw new Error('Chave pública da Stripe não retornada');
      }

      // 2) Criar sessão embedded
      console.log('[INIT] Criando sessão embedded...');
      const functionName = selectedPlan === 'monthly' 
        ? 'create-monthly-checkout-embedded' 
        : 'create-annual-checkout-embedded';
      
      console.log('[INIT] Chamando função:', functionName);
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(functionName);
      console.log('[INIT] Resposta da sessão:', { sessionData, sessionError });
      
      if (sessionError) {
        throw new Error(`Erro ao criar sessão: ${sessionError.message}`);
      }
      if (!sessionData?.client_secret) {
        throw new Error('Client secret não retornado pela função');
      }

      // Verificar se ainda é a mesma inicialização
      if (checkoutStateRef.current?.containerId !== containerId) {
        console.log('[INIT] Inicialização cancelada - nova tentativa em andamento');
        return;
      }

      // 3) Carregar Stripe
      console.log('[INIT] Carregando Stripe com chave:', pkData.publishableKey.substring(0, 20) + '...');
      const stripe = await loadStripe(pkData.publishableKey);
      if (!stripe) {
        throw new Error('Falha ao carregar instância do Stripe');
      }

      // 4) Inicializar checkout embedded
      console.log('[INIT] Criando instância embedded com client_secret:', sessionData.client_secret.substring(0, 20) + '...');
      const checkoutInstance = await stripe.initEmbeddedCheckout({
        clientSecret: sessionData.client_secret
      });

      // Verificar novamente se ainda é válido
      if (checkoutStateRef.current?.containerId !== containerId) {
        console.log('[INIT] Inicialização cancelada durante criação da instância');
        if (checkoutInstance) {
          try { await checkoutInstance.unmount(); } catch (e) { console.log('[INIT] Erro ao desmontar instância cancelada:', e); }
        }
        return;
      }

      // 5) Preparar container DOM
      if (containerRef.current) {
        console.log('[INIT] Preparando container DOM...');
        containerRef.current.innerHTML = `<div id="${containerId}" class="min-h-[640px] w-full"></div>`;
        
        // Aguardar o DOM estar pronto
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verificar se o elemento existe
        const targetElement = document.getElementById(containerId);
        if (!targetElement) {
          throw new Error(`Elemento DOM ${containerId} não encontrado`);
        }
        
        // 6) Montar o checkout
        console.log('[INIT] Montando checkout no DOM elemento:', containerId);
        await checkoutInstance.mount(`#${containerId}`);
        
        // Atualizar estado para ativo
        if (checkoutStateRef.current?.containerId === containerId) {
          checkoutStateRef.current.isInitializing = false;
          checkoutStateRef.current.isActive = true;
          checkoutStateRef.current.instance = checkoutInstance;
          console.log('[INIT] ✅ Checkout montado com sucesso!');
          setLoading(false);
        } else {
          // Se não é mais válido, desmontar
          console.log('[INIT] Estado inválido após montagem, desmontando...');
          try { await checkoutInstance.unmount(); } catch (e) { console.log('[INIT] Erro ao desmontar:', e); }
        }
      } else {
        throw new Error('Container ref não está disponível');
      }
      
    } catch (error) {
      console.error('[INIT] ❌ Erro durante inicialização:', error);
      
      // Resetar estado em caso de erro
      checkoutStateRef.current = null;
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao inicializar checkout';
      toast({
        title: 'Erro no Checkout',
        description: errorMessage,
        variant: 'destructive'
      });
      
      setShowEmbedded(false);
      setLoading(false);
    }
  }, [showEmbedded, selectedPlan, toast]);

  // Efeito para inicializar checkout
  useEffect(() => {
    if (showEmbedded) {
      // Usar timeout para permitir que o DOM se atualize
      initTimeoutRef.current = setTimeout(() => {
        initializeCheckout();
      }, 100);
    }
    
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [showEmbedded, initializeCheckout]);

  // Cleanup quando componente desmonta
  useEffect(() => {
    return () => {
      performAdvancedCleanup();
    };
  }, [performAdvancedCleanup]);

  const benefits = [
    {
      icon: <Brain className="h-5 w-5 text-primary" />,
      title: "Análises de IA Completas",
      description: "Treinos individualizados, análise do sono e insights personalizados sobre sua performance"
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-primary" />,
      title: "BioPeak Fitness Score",
      description: "Acompanhe sua evolução com métricas avançadas e risco de overtraining"
    },
    {
      icon: <Calendar className="h-5 w-5 text-primary" />,
      title: "Calendário de Provas",
      description: "Análise de IA específica sobre sua preparação para objetivos e competições"
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-primary" />,
      title: "Painel Estatístico Avançado",
      description: "Acesso completo a todas as suas estatísticas individuais detalhadas"
    },
    {
      icon: <Activity className="h-5 w-5 text-primary" />,
      title: "Monitoramento de Overtraining",
      description: "Alertas inteligentes para prevenir lesões e otimizar recuperação"
    },
    {
      icon: <Target className="h-5 w-5 text-primary" />,
      title: "Insights de Performance",
      description: "Recomendações personalizadas baseadas nos seus dados e objetivos"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-muted/20 hover:bg-muted/40 z-10"
      >
        <X className="h-5 w-5" />
      </Button>

      {showEmbedded && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-0">
              <div ref={containerRef} className="min-h-[640px]">
                {loading && (
                  <div className="flex items-center justify-center h-[640px]">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Carregando checkout seguro...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await performAdvancedCleanup();
              setShowEmbedded(false);
              setLoading(false);
            }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-muted/20 hover:bg-muted/40"
            aria-label="Fechar checkout"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <Card className="glass-card static-dialog w-full max-w-md mx-auto">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-gradient-primary">
                <Crown className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold leading-tight">
              Desbloqueie seu plano de treino personalizado
            </h1>
            <p className="text-muted-foreground text-sm">
              Acesse todas as funcionalidades premium do BioPeak
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {benefit.icon}
                    <h3 className="font-semibold text-sm">{benefit.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Options */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Opções de Assinatura
              </h3>
            </div>

            {/* Annual Plan */}
            <Card 
              className={`cursor-pointer transition-all ${
                selectedPlan === 'annual' 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/20'
              }`}
              onClick={() => setSelectedPlan('annual')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold">Anual</span>
                    <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                      ECONOMIZE 35%
                    </Badge>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-lg font-bold">R$ 12,90</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Cobrado R$ 154,80 anualmente
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedPlan === 'annual' 
                    ? 'bg-primary border-primary' 
                    : 'border-muted-foreground'
                }`}>
                  {selectedPlan === 'annual' && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Plan */}
            <Card 
              className={`cursor-pointer transition-all ${
                selectedPlan === 'monthly' 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/20'
              }`}
              onClick={() => setSelectedPlan('monthly')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold">Mensal</span>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-lg font-bold">R$ 19,90</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Faturado mensalmente
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedPlan === 'monthly' 
                    ? 'bg-primary border-primary' 
                    : 'border-muted-foreground'
                }`}>
                  {selectedPlan === 'monthly' && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA Button */}
          <Button 
            onClick={handleStartNow}
            disabled={loading}
            className="w-full btn-primary text-base font-semibold py-3 h-12"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Começar Agora'
            )}
          </Button>

          {/* Secondary Action - Skip for now */}
          <Button 
            variant="ghost"
            onClick={handleClose}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Talvez mais tarde
          </Button>

          {/* Footer Text */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Todos os preços em BRL • Cancele a qualquer momento
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};