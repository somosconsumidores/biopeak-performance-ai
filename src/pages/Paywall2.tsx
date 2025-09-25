import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlatform } from "@/hooks/usePlatform";
import { revenueCat, RevenueCatOffering } from '@/lib/revenuecat';

const Paywall2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isIOS, isNative, isWeb } = usePlatform();
  const [selectedPlan, setSelectedPlan] = useState<'monthly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<RevenueCatOffering | null>(null);
  const [revenueCatInitialized, setRevenueCatInitialized] = useState(false);

  // Detect if running as PWA
  const isPWA = isWeb && window.matchMedia('(display-mode: standalone)').matches;

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

  // RevenueCat setup for iOS native only (not PWA)
  useEffect(() => {
    if (isIOS && isNative && !isPWA && user) {
      const setupRevenueCat = async () => {
        console.log('🔵 Paywall2: Initializing RevenueCat for user:', user.id);
        try {
          await revenueCat.initialize(user.id);
          console.log('🔵 Paywall2: RevenueCat initialized, fetching offerings...');
          setRevenueCatInitialized(true);
          
          const currentOfferings = await revenueCat.getOfferings();
          console.log('🔵 Paywall2: Offerings received:', currentOfferings);
          setOfferings(currentOfferings);
          
          if (!currentOfferings) {
            console.warn('🟠 Paywall2: No offerings found - produtos podem estar aguardando aprovação da Apple');
            toast({
              title: "Usando pagamento via cartão",
              description: "Pagamentos via App Store temporariamente indisponíveis.",
              duration: 3000,
            });
          } else if (!currentOfferings.monthly) {
            console.warn('🟠 Paywall2: No monthly product found - check product ID configuration');
          }
        } catch (error: any) {
          console.error('🔴 Paywall2: RevenueCat setup error:', error);
          // Don't set error state - we'll fallback to Stripe
          setRevenueCatInitialized(false);
          
          // Check if it's a product approval issue
          if (error.message?.includes('WAITING_FOR_REVIEW') || 
              error.message?.includes('None of the products registered') ||
              error.code === '23') {
            toast({
              title: "Pagamento via cartão disponível",
              description: "Produtos da App Store aguardando aprovação. Use nosso checkout seguro.",
              duration: 4000,
            });
          } else {
            toast({
              title: "Usando checkout alternativo",
              description: "Sistema de pagamento seguro via cartão disponível.",
              duration: 3000,
            });
          }
        }
      };
      setupRevenueCat();
    } else {
      console.log('🔵 Paywall2: Skipping RevenueCat setup:', { isIOS, isNative, isPWA, hasUser: !!user });
    }
  }, [isIOS, isNative, isPWA, user, toast]);

  const handleClose = () => {
    navigate('/');
  };

  const handleRevenueCatPurchase = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assinar.",
        variant: "destructive"
      });
      return;
    }

    if (!revenueCatInitialized || !offerings) {
      console.error('🔴 Paywall2: RevenueCat not properly initialized or no offerings');
      toast({
        title: "Redirecionando para checkout",
        description: "Usando sistema de pagamento seguro via cartão.",
        duration: 2000,
      });
      // Fallback to Stripe
      await handleStripeCheckout();
      return;
    }

    console.log('🔵 Paywall2: Starting RevenueCat purchase');
    setLoading(true);
    
    // Add timeout to prevent infinite loading
    const purchaseTimeout = setTimeout(() => {
      console.error('🔴 Paywall2: Purchase timeout after 30 seconds');
      setLoading(false);
      toast({
        title: "Tempo esgotado",
        description: "A compra demorou muito. Tentando método alternativo...",
        variant: "destructive"
      });
      handleStripeCheckout();
    }, 30000);
    
    try {
      console.log('🔵 Paywall2: Attempting RevenueCat purchase with offerings:', offerings);
      
      if (!offerings.monthly) {
        throw new Error('Pacote mensal não encontrado');
      }

      console.log('🔵 Paywall2: Calling RevenueCat purchasePackage...');
      const customerInfo = await revenueCat.purchasePackage('monthly');
      console.log('🟢 Paywall2: Purchase successful:', customerInfo);
      
      clearTimeout(purchaseTimeout);
      
      // Verify purchase was successful
      const hasPremium = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasPremium) {
        toast({
          title: "🎉 Compra realizada com sucesso!",
          description: "Bem-vindo ao BioPeak Premium!",
        });
        navigate('/dashboard');
      } else {
        throw new Error('Purchase completed but premium not activated');
      }
    } catch (error: any) {
      clearTimeout(purchaseTimeout);
      console.error('🔴 Paywall2: RevenueCat purchase error:', error);
      
      // Don't show error if user cancelled
      if (error.code !== '1' && !error.message?.includes('cancelled')) {
        // Fallback to Stripe on error
        console.log('🔵 Paywall2: Falling back to Stripe checkout');
        
        // Check if it's a product approval issue
        if (error.message?.includes('WAITING_FOR_REVIEW') || 
            error.message?.includes('None of the products registered') ||
            error.code === '23') {
          toast({
            title: "Redirecionando para checkout",
            description: "Produto aguardando aprovação. Usando checkout via cartão.",
            duration: 3000,
          });
        } else {
          toast({
            title: "Usando método alternativo",
            description: "Redirecionando para checkout seguro via cartão.",
            duration: 2000,
          });
        }
        await handleStripeCheckout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!user?.email) {
      console.log('🔴 No user email, cannot proceed with Stripe');
      toast({
        title: "Erro de autenticação",
        description: "Email do usuário não encontrado",
        variant: "destructive"
      });
      return;
    }

    console.log('🔵 Starting Stripe checkout', { userEmail: user.email, isPWA, isIOS });
    setLoading(true);
    
    // Pre-open window for iOS PWA to avoid popup blocker
    let checkoutWindow: Window | null = null;
    if (isPWA && isIOS) {
      console.log('🔵 Pre-opening window for iOS PWA');
      checkoutWindow = window.open('about:blank', '_blank');
    }
    
    try {
      console.log('🔵 Calling Supabase function: create-flash-checkout');
      
      const { data, error } = await supabase.functions.invoke('create-flash-checkout', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      console.log('🔵 Supabase function response:', { data, error });

      if (error) {
        console.error('🔴 Supabase function error:', error);
        // Close pre-opened window on error
        if (checkoutWindow) {
          checkoutWindow.close();
        }
        throw new Error(error.message || 'Erro ao criar sessão de checkout');
      }

      if (data?.url) {
        console.log('🔵 Redirecting to checkout URL:', data.url);
        
        // Handle different redirect methods based on platform
        if (isPWA && isIOS) {
          // For iOS PWA, use direct redirect to avoid popup blocker
          if (checkoutWindow && !checkoutWindow.closed) {
            checkoutWindow.location.href = data.url;
          } else {
            // Fallback: direct redirect in same window
            window.location.href = data.url;
          }
        } else {
          // For other platforms, use new tab
          window.open(data.url, '_blank');
        }
      } else {
        console.error('🔴 No URL returned from function:', data);
        // Close pre-opened window on error
        if (checkoutWindow) {
          checkoutWindow.close();
        }
        throw new Error('URL de checkout não retornada');
      }
    } catch (error) {
      console.error('🔴 Error in handleStripeCheckout:', error);
      
      // Close pre-opened window on error
      if (checkoutWindow) {
        checkoutWindow.close();
      }
      
      toast({
        title: "Erro no checkout",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!isIOS || !isNative || isPWA) return;

    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para restaurar compras.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      await revenueCat.initialize(user.id);
      const customerInfo = await revenueCat.restorePurchases();
      console.log('🔵 Restored purchases:', customerInfo);
      
      const hasPremium = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasPremium) {
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
      console.error('🔴 Restore error:', error);
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
    console.log('🔵 handleStartNow called', { 
      selectedPlan, 
      isIOS, 
      isNative, 
      isPWA, 
      user: !!user,
      revenueCatInitialized,
      hasOfferings: !!offerings 
    });
    
    // Always use Stripe for PWA, regardless of platform
    if (isPWA) {
      console.log('🔵 PWA detected - using Stripe checkout');
      await handleStripeCheckout();
      return;
    }
    
    // Use RevenueCat only for native iOS apps
    if (isIOS && isNative && !isPWA) {
      console.log('🔵 iOS Native - attempting RevenueCat purchase');
      await handleRevenueCatPurchase();
      return;
    }

    // Default to Stripe for web and other platforms
    if (!user) {
      console.log('🔵 No user, redirecting to auth with plan');
      navigate('/auth?plan=monthly');
      return;
    }

    console.log('🔵 Using Stripe checkout for web/other platforms');
    await handleStripeCheckout();
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
                {isIOS && isNative && !isPWA && offerings?.monthly 
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
          
          {isIOS && isNative && !isPWA && (
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
            {isIOS && isNative && !isPWA
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