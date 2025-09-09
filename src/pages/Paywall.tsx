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

// Interface robusta para controle de estado do checkout
interface CheckoutState {
  isInitializing: boolean;
  isActive: boolean;
  instance: any;
  containerId: string;
  plan: 'monthly' | 'annual';
  clientSecret: string;
  timestamp: number;
}

// Sistema global robusto - Single Instance Pattern
let globalStripeInstance: Stripe | null = null;
let globalStripePublishableKey: string | null = null;
let globalCheckoutState: CheckoutState | null = null;
let globalCleanupPromise: Promise<void> | null = null;
let globalMutex: Promise<void> | null = null;
let lastInitTimestamp: number = 0;

// Debounce para inicializações (2 segundos)
const DEBOUNCE_DELAY = 2000;
const CLEANUP_TIMEOUT = 3000;
const MAX_RETRIES = 3;

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

  // Sistema de mutex robusto para evitar condições de corrida
  const acquireMutex = async () => {
    while (globalMutex) {
      console.log('[MUTEX] ⏳ Aguardando mutex global...');
      await globalMutex;
    }
  };

  // Função de cleanup global ultra robusta
  const performGlobalCleanup = useCallback(async () => {
    console.log('[GLOBAL-CLEANUP] 🧹 Iniciando cleanup global ultra robusto...');
    
    await acquireMutex();
    
    // Criar nova promessa de cleanup com timeout agressivo
    globalCleanupPromise = (async () => {
      globalMutex = (async () => {
        try {
          // Limpar todos os timeouts pendentes
          if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
          }
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = null;
          }
          
          // Cleanup agressivo da instância global
          if (globalCheckoutState?.instance) {
            try {
              console.log('[GLOBAL-CLEANUP] 🗑️ Desmontando instância global...');
              await Promise.race([
                globalCheckoutState.instance.unmount(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), CLEANUP_TIMEOUT))
              ]);
              console.log('[GLOBAL-CLEANUP] ✅ Instância global desmontada');
            } catch (error) {
              console.log('[GLOBAL-CLEANUP] ⚠️ Timeout/Erro ao desmontar (continuando):', error);
            }
          }
          
          // Resetar completamente o estado global
          globalCheckoutState = null;
          lastInitTimestamp = 0;
          
          // Limpeza agressiva do DOM
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
            // Forçar reflow para garantir limpeza
            containerRef.current.offsetHeight;
          }
          
          // Verificar se há elementos Stripe órfãos no DOM
          const orphanElements = document.querySelectorAll('[data-testid*="stripe"], .StripeElement, [id*="stripe-"]');
          orphanElements.forEach(el => {
            try {
              el.remove();
              console.log('[GLOBAL-CLEANUP] 🗑️ Removido elemento Stripe órfão:', el.className);
            } catch (e) {
              console.log('[GLOBAL-CLEANUP] ⚠️ Erro ao remover elemento órfão:', e);
            }
          });
          
          // Timeout mais agressivo para garantir cleanup completo
          await new Promise(resolve => setTimeout(resolve, CLEANUP_TIMEOUT));
          console.log('[GLOBAL-CLEANUP] ✅ Cleanup global ultra robusto concluído');
          
        } finally {
          globalMutex = null;
        }
      })();
      
      await globalMutex;
    })();
    
    await globalCleanupPromise;
    globalCleanupPromise = null;
  }, []);

  // Função para trocar de plano (com cleanup obrigatório)
  const handlePlanSwitch = useCallback(async (newPlan: 'monthly' | 'annual') => {
    console.log(`[PLAN-SWITCH] 🔄 Trocando plano de ${selectedPlan} para ${newPlan}`);
    
    if (selectedPlan === newPlan) {
      console.log('[PLAN-SWITCH] ⏸️ Mesmo plano selecionado, ignorando...');
      return;
    }
    
    // Se há um checkout ativo, fazer cleanup primeiro
    if (showEmbedded || globalCheckoutState?.instance) {
      console.log('[PLAN-SWITCH] 🧹 Fazendo cleanup antes de trocar...');
      setShowEmbedded(false);
      await performGlobalCleanup();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[PLAN-SWITCH] ✅ Trocando para plano: ${newPlan}`);
    setSelectedPlan(newPlan);
  }, [selectedPlan, showEmbedded, performGlobalCleanup]);

  const handleStartNow = useCallback(async () => {
    console.log('[START] 🚀 Botão clicado, verificando condições...');
    console.log('[START] Estado atual - loading:', loading, 'globalState:', globalCheckoutState?.isInitializing);
    
    if (loading || globalCheckoutState?.isInitializing) {
      console.log('[START] ❌ Operação já em andamento, ignorando...');
      return;
    }
    
    console.log(`[START] ✅ Iniciando checkout para plano: ${selectedPlan}`);
    setLoading(true);
    
    try {
      // Cleanup global antes de iniciar
      console.log('[START] 🧹 Fazendo cleanup global antes de iniciar...');
      await performGlobalCleanup();
      
      // Aguardar um pouco mais para garantir que tudo foi limpo
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log('[START] 📱 Mostrando modal embedded...');
      setShowEmbedded(true);
      
    } catch (error) {
      console.error('[START] ❌ Erro durante inicialização:', error);
      setLoading(false);
      toast({
        title: 'Erro',
        description: 'Falha ao inicializar checkout. Tente novamente.',
        variant: 'destructive'
      });
    }
  }, [loading, selectedPlan, performGlobalCleanup, toast]);

  // Função robusta para obter/reutilizar instância Stripe global
  const getGlobalStripeInstance = async (publishableKey: string): Promise<Stripe> => {
    if (globalStripeInstance && globalStripePublishableKey === publishableKey) {
      console.log('[STRIPE] ♻️ Reutilizando instância global do Stripe');
      return globalStripeInstance;
    }
    
    console.log('[STRIPE] 🆕 Criando nova instância global do Stripe');
    const stripe = await loadStripe(publishableKey);
    if (!stripe) {
      throw new Error('Falha ao carregar instância do Stripe');
    }
    
    globalStripeInstance = stripe;
    globalStripePublishableKey = publishableKey;
    return stripe;
  };

  // Inicialização ultra robusta do checkout com padrão Single Instance
  const initializeCheckout = useCallback(async (retryCount = 0) => {
    const now = Date.now();
    console.log(`[INIT] 🔄 Inicialização chamada (tentativa ${retryCount + 1}/${MAX_RETRIES})`);
    console.log(`[INIT] Estado - showEmbedded:${showEmbedded}, globalState:${globalCheckoutState?.isInitializing}, debounce:${now - lastInitTimestamp}ms`);
    
    // Verificação de debounce (2 segundos)
    if (now - lastInitTimestamp < DEBOUNCE_DELAY) {
      console.log(`[INIT] ⏸️ Debounce ativo, aguardando ${DEBOUNCE_DELAY - (now - lastInitTimestamp)}ms`);
      return;
    }
    
    // Verificações de estado
    if (!showEmbedded || globalCheckoutState?.isInitializing) {
      console.log('[INIT] ⏸️ Bloqueado - showEmbedded:', showEmbedded, 'globalInitializing:', globalCheckoutState?.isInitializing);
      return;
    }

    // Verificação de DOM
    if (!containerRef.current) {
      console.log('[INIT] ❌ Container DOM não disponível');
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => initializeCheckout(retryCount + 1), 500);
      }
      return;
    }
    
    await acquireMutex();
    
    const containerId = `embedded-checkout-${now}-${Math.random().toString(36).substr(2, 9)}`;
    lastInitTimestamp = now;
    
    console.log(`[INIT] 🆔 Inicializando checkout: ${containerId}, plano: ${selectedPlan}`);
    
    try {
      globalMutex = (async () => {
        // Verificar se já há um client_secret ativo para o mesmo plano
        if (globalCheckoutState?.clientSecret && globalCheckoutState.plan === selectedPlan && globalCheckoutState.isActive) {
          console.log('[INIT] ⚡ Client secret ativo encontrado, reutilizando...');
          return;
        }
        
        // Marcar como inicializando globalmente com todas as propriedades
        globalCheckoutState = {
          isInitializing: true,
          isActive: false,
          instance: null,
          containerId,
          plan: selectedPlan,
          clientSecret: '', // Será preenchido quando obtido
          timestamp: now
        };

        // 1) Buscar chave pública
        console.log('[INIT] 🔑 Buscando chave pública...');
        const { data: pkData, error: pkError } = await supabase.functions.invoke('get-stripe-publishable-key');
        console.log('[INIT] 📝 Resposta da chave pública:', { pkData, pkError });
        
        if (pkError) {
          throw new Error(`Erro ao buscar chave pública: ${pkError.message}`);
        }
        if (!pkData?.publishableKey) {
          throw new Error('Chave pública da Stripe não retornada');
        }

        // 2) Criar sessão embedded
        console.log('[INIT] 🏗️ Criando sessão embedded...');
        const functionName = selectedPlan === 'monthly' 
          ? 'create-monthly-checkout-embedded' 
          : 'create-annual-checkout-embedded';
        
        console.log('[INIT] 📞 Chamando função:', functionName);
        const { data: sessionData, error: sessionError } = await supabase.functions.invoke(functionName);
        console.log('[INIT] 📋 Resposta da sessão:', { sessionData, sessionError });
        
        if (sessionError) {
          throw new Error(`Erro ao criar sessão: ${sessionError.message}`);
        }
        if (!sessionData?.client_secret) {
          throw new Error('Client secret não retornado pela função');
        }

        // Verificar se ainda é a mesma inicialização
        if (globalCheckoutState?.containerId !== containerId) {
          console.log('[INIT] ❌ Inicialização cancelada - nova tentativa em andamento');
          return;
        }

        // Atualizar com o client_secret obtido
        globalCheckoutState.clientSecret = sessionData.client_secret;

        // 3) Obter instância Stripe global (reutilizável)
        console.log('[INIT] 📦 Obtendo instância Stripe...');
        const stripe = await getGlobalStripeInstance(pkData.publishableKey);

        // 4) Inicializar checkout embedded
        console.log('[INIT] 🎯 Criando instância embedded com client_secret:', sessionData.client_secret.substring(0, 20) + '...');
        const checkoutInstance = await stripe.initEmbeddedCheckout({
          clientSecret: sessionData.client_secret
        });

        // Verificar novamente se ainda é válido
        if (globalCheckoutState?.containerId !== containerId) {
          console.log('[INIT] ❌ Inicialização cancelada durante criação da instância');
          if (checkoutInstance) {
            try { 
              await Promise.race([
                checkoutInstance.unmount(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
              ]);
            } catch (e) { 
              console.log('[INIT] ⚠️ Erro ao desmontar instância cancelada:', e); 
            }
          }
          return;
        }

        // 5) Verificação final do DOM e montagem
        if (!containerRef.current) {
          throw new Error('Container DOM removido durante inicialização');
        }

        // Verificar se o container está vazio (sem elementos Stripe órfãos)
        const hasStripeElements = containerRef.current.querySelector('[data-testid*="stripe"], .StripeElement');
        if (hasStripeElements) {
          console.log('[INIT] 🧹 Limpando elementos Stripe órfãos...');
          containerRef.current.innerHTML = '';
        }

        console.log('[INIT] 🏗️ Montando checkout no container...');
        
        // 6) Montar com timeout de segurança
        await Promise.race([
          checkoutInstance.mount(containerRef.current),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na montagem')), 10000))
        ]);
        
        // 7) Atualizar estado global para ativo
        if (globalCheckoutState?.containerId === containerId) {
          globalCheckoutState.isInitializing = false;
          globalCheckoutState.isActive = true;
          globalCheckoutState.instance = checkoutInstance;
          console.log('[INIT] ✅ Checkout montado com sucesso!');
          setLoading(false);
        } else {
          // Se não é mais válido, desmontar
          console.log('[INIT] ⚠️ Estado inválido após montagem, desmontando...');
          try { 
            await Promise.race([
              checkoutInstance.unmount(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
          } catch (e) { 
            console.log('[INIT] ⚠️ Erro ao desmontar:', e); 
          }
        }
      })();
      
      await globalMutex;
      globalMutex = null;
      
    } catch (error) {
      globalMutex = null;
      console.error(`[INIT] ❌ Erro durante inicialização (tentativa ${retryCount + 1}):`, error);
      
      // Resetar estado global em caso de erro
      globalCheckoutState = null;
      
      // Retry com backoff exponencial
      if (retryCount < MAX_RETRIES - 1) {
        const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`[INIT] 🔄 Tentando novamente em ${backoffDelay}ms...`);
        setTimeout(() => initializeCheckout(retryCount + 1), backoffDelay);
        return;
      }
      
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
      performGlobalCleanup();
    };
  }, [performGlobalCleanup]);

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
              await performGlobalCleanup();
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