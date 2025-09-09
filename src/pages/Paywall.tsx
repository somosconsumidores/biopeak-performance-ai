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

export const Paywall = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { refreshSubscription } = useSubscription();
  
  // Ler plano da URL
  const selectedPlan = (searchParams.get('plan') === 'monthly') ? 'monthly' : 'annual';
  
  const [loading, setLoading] = useState(false);
  const [showEmbedded, setShowEmbedded] = useState(false);
  
  // Ref para container do checkout
  const containerRef = useRef<HTMLDivElement>(null);

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
    navigate('/sync');
  };

  // Navigation-based plan switching
  const handlePlanSwitch = useCallback((newPlan: 'monthly' | 'annual') => {
    if (selectedPlan === newPlan) return;
    
    // Navigate to new URL with plan parameter - this triggers a fresh page load
    navigate(`/paywall?plan=${newPlan}`, { replace: true });
  }, [selectedPlan, navigate]);

  const handleStartNow = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setShowEmbedded(true);
  }, [loading]);

  // Create checkout - simple approach with fresh page context
  const createCheckout = useCallback(async () => {
    if (!showEmbedded || !containerRef.current) return;
    
    try {
      // Get publishable key
      const { data: pkData, error: pkError } = await supabase.functions.invoke('get-stripe-publishable-key');
      if (pkError || !pkData?.publishableKey) {
        throw new Error(`Erro na chave pública: ${pkError?.message}`);
      }

      // Create session
      const functionName = selectedPlan === 'monthly' 
        ? 'create-monthly-checkout-embedded' 
        : 'create-annual-checkout-embedded';
      
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(functionName);
      if (sessionError || !sessionData?.client_secret) {
        throw new Error(`Erro na sessão: ${sessionError?.message}`);
      }

      // Create Stripe instance and embedded checkout
      const stripe = await loadStripe(pkData.publishableKey);
      if (!stripe) throw new Error('Falha ao carregar Stripe');

      const embeddedCheckout = await stripe.initEmbeddedCheckout({
        clientSecret: sessionData.client_secret
      });

      // Mount to container
      if (containerRef.current && showEmbedded) {
        containerRef.current.innerHTML = '';
        await embeddedCheckout.mount(containerRef.current);
        setLoading(false);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro no Checkout',
        description: errorMsg,
        variant: 'destructive'
      });
      
      setShowEmbedded(false);
      setLoading(false);
    }
  }, [showEmbedded, selectedPlan, toast]);

  // Create checkout when modal opens
  useEffect(() => {
    if (showEmbedded) {
      const timer = setTimeout(() => {
        createCheckout();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showEmbedded, createCheckout]);

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
            onClick={() => {
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