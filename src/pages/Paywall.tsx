import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePlatform } from '@/hooks/usePlatform';
import { revenueCat, RevenueCatOffering } from '@/lib/revenuecat';

function Paywall() {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<RevenueCatOffering | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription } = useSubscription();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isIOS, isNative } = usePlatform();

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({
        title: "Pagamento confirmado!",
        description: "Sua assinatura foi ativada com sucesso.",
        duration: 5000,
      });
      refreshSubscription();
      navigate('/dashboard');
    }

    if (canceled === 'true') {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente a qualquer momento.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [searchParams, navigate, refreshSubscription, toast]);

  // Carrega as ofertas do RevenueCat para iOS
  useEffect(() => {
    if (isIOS && isNative && user) {
      const loadOfferings = async () => {
        try {
          await revenueCat.initialize(user.id);
          const currentOfferings = await revenueCat.getOfferings();
          setOfferings(currentOfferings);
        } catch (error) {
          console.error('Failed to load RevenueCat offerings:', error);
        }
      };

      loadOfferings();
    }
  }, [isIOS, isNative, user]);

  const handleClose = () => {
    navigate('/sync');
  };

  const handleRevenueCatPurchase = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assinar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      await revenueCat.initialize(user.id);
      const packageId = selectedPlan === 'monthly' ? 'monthly' : 'annual';
      
      const customerInfo = await revenueCat.purchasePackage(packageId);
      
      // Verificar se a compra foi bem-sucedida
      const hasPremium = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasPremium) {
        toast({
          title: "Assinatura ativada!",
          description: "Sua assinatura foi ativada com sucesso.",
          duration: 5000,
        });
        refreshSubscription();
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('RevenueCat purchase failed:', error);
      
      // Não mostrar erro se usuário cancelou
      if (error.code !== '1' && !error.message?.includes('cancelled')) {
        toast({
          title: "Erro na compra",
          description: "Não foi possível processar a compra. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!isIOS || !isNative) return;

    setLoading(true);
    
    try {
      await revenueCat.initialize(user!.id);
      const customerInfo = await revenueCat.restorePurchases();
      
      const hasPremium = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasPremium) {
        toast({
          title: "Compras restauradas!",
          description: "Suas compras anteriores foram restauradas com sucesso.",
          duration: 5000,
        });
        refreshSubscription();
        navigate('/dashboard');
      } else {
        toast({
          title: "Nenhuma compra encontrada",
          description: "Não foram encontradas compras anteriores para restaurar.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      toast({
        title: "Erro",
        description: "Não foi possível restaurar as compras.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartNow = async () => {
    console.log('🔵 handleStartNow called', { selectedPlan, isIOS, isNative, user: !!user });
    
    if (isIOS && isNative) {
      console.log('🔵 iOS Native - calling handleRevenueCatPurchase');
      await handleRevenueCatPurchase();
      return;
    }

    // Implementação Stripe para web
    if (!user) {
      console.log('🔴 User not authenticated');
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assinar.",
        variant: "destructive",
      });
      return;
    }

    console.log('🔵 Starting Stripe checkout', { selectedPlan, userEmail: user.email });
    setLoading(true);
    
    try {
      const functionName = selectedPlan === 'monthly' 
        ? 'create-monthly-checkout' 
        : 'create-annual-checkout';
      
      console.log('🔵 Calling function:', functionName);
      
      const session = await supabase.auth.getSession();
      console.log('🔵 Session:', { hasSession: !!session.data.session, hasToken: !!session.data.session?.access_token });

      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      console.log('🔵 Function response:', { data, error });

      if (error) {
        console.log('🔴 Function error:', error);
        throw error;
      }

      if (data?.url) {
        console.log('🔵 Opening checkout URL:', data.url);
        window.open(data.url, '_blank');
      } else {
        console.log('🔴 No URL in response:', data);
        throw new Error('Nenhuma URL de checkout retornada');
      }
    } catch (error) {
      console.error('🔴 Error creating checkout:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      title: "Análises de IA Completas",
      description: "Treinos individualizados, análise do sono e insights personalizados"
    },
    {
      title: "BioPeak Fitness Score",
      description: "Acompanhe sua evolução com métricas avançadas e risco de overtraining"
    },
    {
      title: "Calendário de Provas",
      description: "Análise de IA específica sobre sua preparação para objetivos"
    },
    {
      title: "Painel Estatístico Avançado",
      description: "Acesso completo a todas as suas estatísticas individuais"
    },
    {
      title: "Monitoramento de Overtraining",
      description: "Alertas inteligentes para prevenir lesões e otimizar recuperação"
    },
    {
      title: "Insights de Performance",
      description: "Recomendações personalizadas baseadas nos seus dados"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full"
      >
        <X className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-gradient-to-r from-primary to-primary/80">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">
            Desbloqueie seu Plano Premium
          </CardTitle>
          <CardDescription>
            Acesse todas as funcionalidades avançadas do BioPeak
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">{benefit.title}</h4>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedPlan === 'monthly'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/20 hover:border-primary/50'
              }`}
              onClick={() => setSelectedPlan('monthly')}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Mensal</h3>
              </div>
              <p className="text-2xl font-bold mb-1">
                {isIOS && isNative && offerings?.monthly 
                  ? offerings.monthly.priceString 
                  : "R$ 19,90"
                }
              </p>
              <p className="text-sm text-muted-foreground">por mês</p>
            </div>

            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
                selectedPlan === 'annual'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/20 hover:border-primary/50'
              }`}
              onClick={() => setSelectedPlan('annual')}
            >
              <Badge className="absolute -top-2 -right-2 bg-green-500 text-white">
                Mais Popular
              </Badge>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Anual</h3>
              </div>
              <p className="text-2xl font-bold mb-1">
                {isIOS && isNative && offerings?.annual 
                  ? offerings.annual.priceString 
                  : "R$ 154,80"
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {isIOS && isNative 
                  ? "por ano" 
                  : "por ano (R$ 12,90/mês)"
                }
              </p>
              {!(isIOS && isNative) && (
                <p className="text-xs text-green-600 font-medium">Economize 33%</p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button 
            onClick={handleStartNow} 
            disabled={loading}
            size="lg" 
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Crown className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Processando...' : 'Começar Agora'}
          </Button>
          
          {isIOS && isNative && (
            <Button 
              variant="outline" 
              onClick={handleRestorePurchases}
              disabled={loading}
              className="w-full"
            >
              Restaurar Compras
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={loading}
            className="w-full"
          >
            Talvez mais tarde
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            {isIOS && isNative 
              ? "Assinatura gerenciada pela App Store. Pode ser cancelada nas configurações do iOS."
              : "Assinatura renovada automaticamente. Pode ser cancelada a qualquer momento."
            }
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default Paywall;