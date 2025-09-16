import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Zap, Clock, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Purchases } from '@revenuecat/purchases-capacitor';

const Paywall2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
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
      const packageToPurchase = selectedPlan === 'monthly' 
        ? offerings.current.monthly 
        : offerings.current.annual;
        
      if (!packageToPurchase) {
        throw new Error(`Pacote ${selectedPlan} não encontrado`);
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

  const handlePlanClick = async (plan: 'monthly' | 'annual') => {
    console.log('🔵 Plan card clicked:', plan);
    setSelectedPlan(plan);
    
    // Chama handleStartNow diretamente com o plano selecionado
    await handleStartNowWithPlan(plan);
  };

  const handleStartNowWithPlan = async (planType?: 'monthly' | 'annual') => {
    const currentPlan = planType || selectedPlan;
    console.log('🔵 handleStartNow called', { currentPlan, isIOS, isNative, user: !!user });
    
    if (isIOS && isNative) {
      console.log('🔵 iOS Native - calling handleRevenueCatPurchase');
      await handleRevenueCatPurchase();
      return;
    }

    if (!user) {
      console.log('🔵 No user, redirecting to auth with plan');
      navigate(`/auth?plan=${currentPlan}`);
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

    console.log('🔵 Starting Stripe checkout', { currentPlan, userEmail: user.email });
    setLoading(true);
    
    try {
      const functionName = currentPlan === 'monthly' 
        ? 'create-monthly-checkout' 
        : 'create-annual-checkout';
      
      console.log('🔵 Calling Supabase function:', functionName);
      
      const { data, error } = await supabase.functions.invoke(functionName, {
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

  const handleStartNow = () => handleStartNowWithPlan();

  const benefits = [
    {
      icon: <Check className="w-5 h-5 text-green-500" />,
      text: "Análises avançadas de performance"
    },
    {
      icon: <Check className="w-5 h-5 text-green-500" />,
      text: "Comparações detalhadas de treinos"
    },
    {
      icon: <Check className="w-5 h-5 text-green-500" />,
      text: "Insights personalizados"
    },
    {
      icon: <Check className="w-5 h-5 text-green-500" />,
      text: "Sincronização ilimitada"
    },
    {
      icon: <Check className="w-5 h-5 text-green-500" />,
      text: "Relatórios completos"
    },
    {
      icon: <Check className="w-5 h-5 text-green-500" />,
      text: "Suporte prioritário"
    }
  ];

  // Preços promocionais - 50% OFF
  const monthlyPrice = isIOS && isNative && offerings?.current?.monthly 
    ? `R$ ${(offerings.current.monthly.product.price * 0.5).toFixed(2).replace('.', ',')}`
    : "R$ 9,90";
  
  const monthlyOriginalPrice = isIOS && isNative && offerings?.current?.monthly 
    ? `R$ ${offerings.current.monthly.product.price.toFixed(2).replace('.', ',')}`
    : "R$ 19,90";

  const annualPrice = isIOS && isNative && offerings?.current?.annual 
    ? `R$ ${(offerings.current.annual.product.price * 0.5).toFixed(2).replace('.', ',')}`
    : "R$ 99,00";
    
  const annualOriginalPrice = isIOS && isNative && offerings?.current?.annual 
    ? `R$ ${offerings.current.annual.product.price.toFixed(2).replace('.', ',')}`
    : "R$ 199,00";

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-background to-orange-950 p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5 animate-pulse" />
      
      {/* Flash Sale Header */}
      <div className="relative z-10 text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold animate-bounce mb-4">
          <Flame className="w-4 h-4" />
          OFERTA RELÂMPAGO
          <Flame className="w-4 h-4" />
        </div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
          50% OFF por tempo limitado!
        </h1>
        <div className="flex items-center justify-center gap-2 text-red-400">
          <Clock className="w-5 h-5 animate-pulse" />
          <span className="font-semibold">Apenas hoje - não perca!</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <Button
            variant="ghost" 
            className="absolute top-0 left-0 text-white hover:bg-white/10" 
            onClick={handleClose}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <h2 className="text-2xl font-bold mb-4 text-white">Desbloqueie todo o potencial do BioPeak</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                {benefit.icon}
                <span className="text-white">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Monthly Plan */}
          <Card 
            className={`cursor-pointer transition-all duration-300 border-2 bg-black/50 backdrop-blur-sm relative overflow-hidden ${
              selectedPlan === 'monthly'
                ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                : 'border-white/20 hover:border-red-500/50'
            }`}
            onClick={() => handlePlanClick('monthly')}
          >
            <div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-bl-lg text-xs font-bold">
              50% OFF
            </div>
            <CardHeader>
              <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-white">Mensal</CardTitle>
                <Zap className="w-6 h-6 text-red-500" />
              </div>
              <CardDescription className="text-white/70">Flexibilidade máxima</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-white/50 line-through text-lg">{monthlyOriginalPrice}</div>
                <div className="text-3xl font-bold text-red-400 mb-2">{monthlyPrice}</div>
                <div className="text-white/70">por mês</div>
              </div>
            </CardContent>
          </Card>

          {/* Annual Plan */}
          <Card 
            className={`cursor-pointer transition-all duration-300 border-2 bg-black/50 backdrop-blur-sm relative overflow-hidden ${
              selectedPlan === 'annual'
                ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                : 'border-white/20 hover:border-red-500/50'
            }`}
            onClick={() => handlePlanClick('annual')}
          >
            <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse">
              Mais Popular + 50% OFF
            </Badge>
            <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-br-lg text-xs font-bold">
              SUPER DESCONTO
            </div>
            <CardHeader className="pt-8">
              <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-white">Anual</CardTitle>
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <CardDescription className="text-white/70">Melhor custo-benefício</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-white/50 line-through text-lg">{annualOriginalPrice}</div>
                <div className="text-3xl font-bold text-orange-400 mb-2">{annualPrice}</div>
                <div className="text-white/70">por ano</div>
                <div className="text-green-400 text-sm font-semibold mt-2">
                  💰 Economize mais de R$ 100!
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-4">
          <Button 
            className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg animate-pulse"
            onClick={handleStartNow}
            disabled={loading}
          >
            {loading ? (
              "Processando..."
            ) : (
              <>
                <Flame className="w-5 h-5 mr-2" />
                Aproveitar Oferta Agora
              </>
            )}
          </Button>

          {isIOS && isNative && (
            <Button 
              variant="outline" 
              className="border-white/30 text-white hover:bg-white/10"
              onClick={handleRestorePurchases}
              disabled={loading}
            >
              Restaurar Compras
            </Button>
          )}

          <Button 
            variant="ghost" 
            className="text-white/70 hover:text-white"
            onClick={handleClose}
          >
            Talvez mais tarde
          </Button>

          <div className="text-xs text-white/50 max-w-md mx-auto">
            {isIOS && isNative ? (
              "Gerenciado pela App Store. Cancele a qualquer momento nas configurações da App Store."
            ) : (
              "Gerenciado pelo Stripe. Cancele a qualquer momento no painel de assinatura."
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paywall2;