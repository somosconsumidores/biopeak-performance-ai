import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Purchases } from '@revenuecat/purchases-capacitor';

const Paywall2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'monthly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);

  // Check if it's iOS and native
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor;

  useEffect(() => {
    // Check for payment success/cancel from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    
    if (success === 'true') {
      toast({
        title: "🎉 Pagamento realizado com sucesso!",
        description: "Bem-vindo ao BioPeak Premium! Aproveitando todos os recursos.",
      });
      navigate('/dashboard');
      return;
    }
    
    if (canceled === 'true') {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive"
      });
    }
  }, [toast, navigate]);

  // RevenueCat setup for iOS native
  useEffect(() => {
    if (isIOS && isNative) {
      const setupRevenueCat = async () => {
        try {
          await Purchases.configure({ apiKey: 'appl_CFaOBXjJvboUQakGWvqECJqHwEj' });
          const offerings = await Purchases.getOfferings();
          console.log('RevenueCat offerings:', offerings);
          setOfferings(offerings);
        } catch (error) {
          console.error('RevenueCat setup error:', error);
        }
      };
      setupRevenueCat();
    }
  }, [isIOS, isNative]);

  const handleClose = () => {
    navigate('/');
  };

  const handleRevenueCatPurchase = async () => {
    if (!offerings?.current) {
      console.error('No offerings available');
      toast({
        title: "Erro",
        description: "Ofertas não disponíveis no momento. Tente novamente.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const packageToPurchase = offerings.current.monthly;
        
      if (!packageToPurchase) {
        throw new Error('Pacote mensal não encontrado');
      }

      const purchaseResult = await Purchases.purchasePackage({ aPackage: packageToPurchase });
      console.log('Purchase successful:', purchaseResult);
      
      toast({
        title: "🎉 Compra realizada com sucesso!",
        description: "Bem-vindo ao BioPeak Premium!",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: "Erro na compra",
        description: "Não foi possível processar a compra. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!isIOS || !isNative) return;
    
    setLoading(true);
    try {
      const restoredPurchases = await Purchases.restorePurchases();
      console.log('Restored purchases:', restoredPurchases);
      
      if (restoredPurchases.customerInfo.activeSubscriptions.length > 0) {
        toast({
          title: "✅ Compras restauradas!",
          description: "Suas assinaturas foram restauradas com sucesso.",
        });
        navigate('/dashboard');
      } else {
        toast({
          title: "Nenhuma compra encontrada",
          description: "Não encontramos assinaturas ativas para restaurar.",
        });
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        title: "Erro ao restaurar",
        description: "Não foi possível restaurar as compras.",
        variant: "destructive"
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

    if (!user) {
      console.log('🔵 No user, redirecting to auth with plan');
      navigate('/auth?plan=monthly');
      return;
    }

    if (!user.email) {
      console.log('🔵 No email, cannot proceed');
      toast({
        title: "Erro de autenticação",
        description: "Email do usuário não encontrado",
        variant: "destructive"
      });
      return;
    }

    console.log('🔵 Starting Stripe checkout', { selectedPlan, userEmail: user.email });
    setLoading(true);
    
    try {
      console.log('🔵 Calling Supabase function: create-monthly-checkout');
      
      const { data, error } = await supabase.functions.invoke('create-monthly-checkout', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      console.log('🔵 Supabase function response:', { data, error });

      if (error) {
        console.error('🔴 Supabase function error:', error);
        throw new Error(error.message || 'Erro ao criar sessão de checkout');
      }

      if (data?.url) {
        console.log('🔵 Redirecting to checkout URL:', data.url);
        window.open(data.url, '_blank');
      } else {
        console.error('🔴 No URL returned from function:', data);
        throw new Error('URL de checkout não retornada');
      }
    } catch (error) {
      console.error('🔴 Error in handleStartNow:', error);
      toast({
        title: "Erro no checkout",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
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

          <div className="mb-6">
            <div
              className="p-4 border rounded-lg cursor-pointer transition-colors border-primary bg-primary/5 relative"
              onClick={handleStartNow}
            >
              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white animate-pulse">
                Oferta Relâmpago
              </Badge>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Plano Mensal</h3>
              </div>
              <p className="text-2xl font-bold mb-1">
                {isIOS && isNative && offerings?.monthly 
                  ? offerings.monthly.priceString 
                  : "R$ 12,90"
                }
              </p>
              <p className="text-sm text-muted-foreground">por mês</p>
              <p className="text-xs text-red-600 font-medium mt-2">Preço promocional especial!</p>
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
};

export default Paywall2;