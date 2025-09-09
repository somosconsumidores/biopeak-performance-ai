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
import { loadStripe, Stripe } from '@stripe/stripe-js';

// Stripe Instance Isolation Strategy
interface CheckoutInstance {
  stripe: Stripe | null;
  embeddedCheckout: any;
  plan: 'monthly' | 'annual';
}

// Controle simples de instância ativa
let currentCheckoutInstance: CheckoutInstance | null = null;
let isInitializing = false;

// Timeouts para limpeza completa
const COMPLETE_CLEANUP_TIMEOUT = 5000;
const RETRY_DELAY = 1000;

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
  
  // Refs para controle direto do DOM
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

  // Cleanup completo - Destroy tudo antes de recriar
  const performCompleteDestroy = useCallback(async () => {
    console.log('[DESTROY] 🔥 Iniciando destruição completa...');
    
    // Limpar timeouts pendentes
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    
    // Destruir instância atual se existe
    if (currentCheckoutInstance?.embeddedCheckout) {
      try {
        console.log('[DESTROY] 🗑️ Desmontando embedded checkout...');
        await Promise.race([
          currentCheckoutInstance.embeddedCheckout.unmount(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        console.log('[DESTROY] ✅ Embedded checkout desmontado');
      } catch (error) {
        console.log('[DESTROY] ⚠️ Erro/timeout ao desmontar (continuando):', error);
      }
    }
    
    // Resetar instância atual
    currentCheckoutInstance = null;
    isInitializing = false;
    
    // Limpeza completa do DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      // Force DOM refresh
      containerRef.current.offsetHeight;
    }
    
    // Remover elementos Stripe órfãos
    const stripeElements = document.querySelectorAll('[data-testid*="stripe"], .StripeElement, [id*="stripe-"], [class*="stripe"]');
    stripeElements.forEach(el => {
      try {
        el.remove();
        console.log('[DESTROY] 🧹 Elemento Stripe órfão removido');
      } catch (e) {
        console.log('[DESTROY] ⚠️ Erro ao remover elemento órfão:', e);
      }
    });
    
    // Aguardar tempo suficiente para limpeza completa (5 segundos)
    console.log('[DESTROY] ⏰ Aguardando limpeza completa (5s)...');
    await new Promise(resolve => setTimeout(resolve, COMPLETE_CLEANUP_TIMEOUT));
    console.log('[DESTROY] ✅ Destruição completa finalizada');
  }, []);

  // Troca de plano - Destruir tudo e recriar
  const handlePlanSwitch = useCallback(async (newPlan: 'monthly' | 'annual') => {
    console.log(`[PLAN-SWITCH] 🔄 Mudando de ${selectedPlan} para ${newPlan}`);
    
    if (selectedPlan === newPlan) {
      console.log('[PLAN-SWITCH] ⏸️ Mesmo plano selecionado');
      return;
    }
    
    // Se há checkout ativo, destruir completamente
    if (showEmbedded || currentCheckoutInstance) {
      console.log('[PLAN-SWITCH] 🔥 Destruindo checkout ativo...');
      setShowEmbedded(false);
      await performCompleteDestroy();
    }
    
    console.log(`[PLAN-SWITCH] ✅ Plano alterado para: ${newPlan}`);
    setSelectedPlan(newPlan);
  }, [selectedPlan, showEmbedded, performCompleteDestroy]);

  const handleStartNow = useCallback(async () => {
    console.log('[START] 🚀 Iniciando checkout...');
    
    if (loading || isInitializing) {
      console.log('[START] ❌ Já em progresso, ignorando...');
      return;
    }
    
    console.log(`[START] ✅ Iniciando para plano: ${selectedPlan}`);
    setLoading(true);
    
    try {
      // Destruir completamente qualquer instância existente
      console.log('[START] 🔥 Destruindo instâncias existentes...');
      await performCompleteDestroy();
      
      console.log('[START] 📱 Exibindo modal de checkout...');
      setShowEmbedded(true);
      
    } catch (error) {
      console.error('[START] ❌ Erro:', error);
      setLoading(false);
      toast({
        title: 'Erro',
        description: 'Falha ao inicializar. Tente novamente.',
        variant: 'destructive'
      });
    }
  }, [loading, selectedPlan, performCompleteDestroy, toast]);

  // Criar nova instância Stripe isolada (NUNCA reutilizar)
  const createFreshStripeInstance = async (publishableKey: string): Promise<Stripe> => {
    console.log('[STRIPE] 🆕 Criando instância Stripe completamente nova...');
    const stripe = await loadStripe(publishableKey, {
      // Força criação de nova instância
      stripeAccount: undefined
    });
    if (!stripe) {
      throw new Error('Falha ao carregar Stripe');
    }
    console.log('[STRIPE] ✅ Nova instância Stripe criada');
    return stripe;
  };

  // Criar checkout completamente novo (Instance Isolation)
  const createFreshCheckout = useCallback(async (retryCount = 0) => {
    console.log(`[CREATE] 🆕 Criando checkout (tentativa ${retryCount + 1})`);
    
    // Verificar precondições
    if (!showEmbedded || isInitializing) {
      console.log('[CREATE] ❌ Precondições não atendidas');
      return;
    }

    if (!containerRef.current) {
      console.log('[CREATE] ❌ Container não disponível');
      if (retryCount < 3) {
        setTimeout(() => createFreshCheckout(retryCount + 1), RETRY_DELAY);
      }
      return;
    }

    isInitializing = true;
    
    try {
      console.log(`[CREATE] 🎯 Criando para plano: ${selectedPlan}`);
      
      // 1) Obter chave pública
      console.log('[CREATE] 🔑 Buscando chave pública...');
      const { data: pkData, error: pkError } = await supabase.functions.invoke('get-stripe-publishable-key');
      if (pkError || !pkData?.publishableKey) {
        throw new Error(`Erro na chave pública: ${pkError?.message || 'Chave não retornada'}`);
      }

      // 2) Criar sessão
      console.log('[CREATE] 🏗️ Criando sessão...');
      const functionName = selectedPlan === 'monthly' 
        ? 'create-monthly-checkout-embedded' 
        : 'create-annual-checkout-embedded';
      
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(functionName);
      if (sessionError || !sessionData?.client_secret) {
        throw new Error(`Erro na sessão: ${sessionError?.message || 'Client secret não retornado'}`);
      }

      // 3) Criar nova instância Stripe isolada
      console.log('[CREATE] 🔧 Criando instância Stripe isolada...');
      const stripe = await createFreshStripeInstance(pkData.publishableKey);

      // 4) Criar embedded checkout
      console.log('[CREATE] 📱 Criando embedded checkout...');
      const embeddedCheckout = await stripe.initEmbeddedCheckout({
        clientSecret: sessionData.client_secret
      });

      // 5) Verificar DOM novamente
      if (!containerRef.current || !showEmbedded) {
        console.log('[CREATE] ❌ DOM ou estado inválido, desmontando...');
        try {
          await embeddedCheckout.unmount();
        } catch (e) {
          console.log('[CREATE] ⚠️ Erro ao desmontar:', e);
        }
        return;
      }

      // 6) Limpar container e montar
      containerRef.current.innerHTML = '';
      console.log('[CREATE] 🏗️ Montando no container...');
      
      await Promise.race([
        embeddedCheckout.mount(containerRef.current),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout montagem')), 15000))
      ]);

      // 7) Salvar instância atual
      currentCheckoutInstance = {
        stripe,
        embeddedCheckout,
        plan: selectedPlan
      };

      console.log('[CREATE] ✅ Checkout criado e montado com sucesso!');
      setLoading(false);
      
    } catch (error) {
      console.error(`[CREATE] ❌ Erro (tentativa ${retryCount + 1}):`, error);
      
      // Retry com delay
      if (retryCount < 2) {
        const delay = (retryCount + 1) * RETRY_DELAY;
        console.log(`[CREATE] 🔄 Retry em ${delay}ms...`);
        setTimeout(() => createFreshCheckout(retryCount + 1), delay);
        return;
      }
      
      // Falhou definitivamente
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro no Checkout',
        description: errorMsg,
        variant: 'destructive'
      });
      
      setShowEmbedded(false);
      setLoading(false);
      
    } finally {
      isInitializing = false;
    }
  }, [showEmbedded, selectedPlan, toast, createFreshStripeInstance]);

  // Efeito para criar checkout quando modal abrir
  useEffect(() => {
    if (showEmbedded) {
      // Delay para DOM se atualizar
      initTimeoutRef.current = setTimeout(() => {
        createFreshCheckout();
      }, 200);
    }
    
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [showEmbedded, createFreshCheckout]);

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      performCompleteDestroy();
    };
  }, [performCompleteDestroy]);

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
            <CardContent className="p-0 relative">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Carregando checkout seguro...
                    </p>
                  </div>
                </div>
              )}
              <div ref={containerRef} className="min-h-[640px] w-full" />
            </CardContent>
          </Card>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await performCompleteDestroy();
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
              onClick={() => handlePlanSwitch('annual')}
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
              onClick={() => handlePlanSwitch('monthly')}
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