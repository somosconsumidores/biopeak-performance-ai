import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogUrl, setDialogUrl] = useState('');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogContent, setDialogContent] = useState<'iframe' | 'eula' | 'privacy'>('iframe');

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
    navigate('/sync');
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

  const openDialog = (url: string, title: string, contentType: 'iframe' | 'eula' | 'privacy' = 'iframe') => {
    // Para iOS nativo, sempre usar conteúdo estático para política de privacidade
    if (contentType === 'iframe' && isIOS && isNative && !isPWA) {
      setDialogTitle(title);
      setDialogContent('privacy');
      setDialogOpen(true);
      return;
    }
    
    // Adiciona parâmetro para indicar que está em popup
    const finalUrl = contentType === 'iframe' && url ? `${url}?popup=true` : url;
    setDialogUrl(finalUrl);
    setDialogTitle(title);
    setDialogContent(contentType);
    setDialogOpen(true);
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
    <div className={`min-h-screen bg-background flex justify-center p-4 pt-8 relative ${isIOS && isNative ? 'pb-32' : 'pb-24'}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full"
      >
        <X className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md h-fit">
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

        <CardFooter className={`flex flex-col gap-6 safe-pb-8 ${isIOS && isNative ? 'pb-6' : ''}`}>
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
          
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <button
              onClick={() => openDialog('https://biopeak-ai.com/privacy-policy', 'Política de Privacidade', 'iframe')}
              className="hover:underline cursor-pointer hover:text-primary transition-colors"
            >
              Política de Privacidade
            </button>
            <span>•</span>
            <button
              onClick={() => openDialog('', 'Contrato de Licença de Usuário Final', 'eula')}
              className="hover:underline cursor-pointer hover:text-primary transition-colors"
            >
              Contrato de Licença
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            {isIOS && isNative && !isPWA
              ? "Assinatura gerenciada pela App Store. Pode ser cancelada nas configurações do iOS."
              : "Assinatura renovada automaticamente. Pode ser cancelada a qualquer momento."
            }
          </p>
        </CardFooter>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6">
            {dialogContent === 'iframe' ? (
              <iframe
                src={dialogUrl}
                className="w-full h-full min-h-[60vh]"
                title={dialogTitle}
              />
            ) : dialogContent === 'privacy' ? (
              <div className="prose prose-sm max-w-none dark:prose-invert space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-4">Política de Privacidade do BioPeak</h2>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Introdução</h3>
                  <p className="mb-4">
                    Esta Política de Privacidade descreve como o BioPeak coleta, utiliza, compartilha e protege suas informações pessoais. Também explica os seus direitos e as opções disponíveis para controlar a sua privacidade. Ao utilizar o BioPeak, você concorda com os termos aqui descritos. Recomendamos também a leitura dos nossos Termos de Uso, que regulam o uso dos nossos serviços.
                  </p>
                  <p className="mb-4">
                    O BioPeak é um aplicativo voltado para o monitoramento e aprimoramento da performance esportiva com base em dados biométricos. Nós levamos a sua privacidade a sério e adotamos medidas para protegê-la.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Resumo de Privacidade</h3>
                  
                  <h4 className="text-base font-semibold mb-3">Coleta, uso e compartilhamento de dados</h4>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-border text-xs">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-2 text-left">Declaração</th>
                          <th className="border border-border p-2 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2">Vendemos suas informações pessoais por valor monetário?</td>
                          <td className="border border-border p-2 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Vendemos informações agregadas por valor monetário?</td>
                          <td className="border border-border p-2 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Compartilhamos suas informações pessoais com terceiros que não sejam prestadores de serviços?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Compartilhamos suas informações pessoais para publicidade direcionada?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Usamos categorias de dados confidenciais, como informações de saúde?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Oferecemos proteções de privacidade adicionais para menores de idade (usuários menores de 18 anos)?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Usamos sua lista de contatos?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Excluímos suas informações pessoais quando você solicita a exclusão da conta?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, a menos que necessário por lei</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Reteremos seus dados após a exclusão da conta?</td>
                          <td className="border border-border p-2 font-semibold text-red-600">Não, exceto se exigido por lei</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-base font-semibold mb-3">Controles de Privacidade</h4>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-border text-xs">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-2 text-left">Declaração</th>
                          <th className="border border-border p-2 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2">Você pode controlar quem vê sua atividade e conteúdo?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Você pode controlar quem vê sua atividade baseada em localização?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Seus controles de privacidade de atividade e perfil são públicos (definidos como "Todos") por padrão?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, se tiver 18 anos ou mais</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Você pode baixar e excluir suas informações pessoais?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Todos os usuários têm o mesmo conjunto de controles de privacidade?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-base font-semibold mb-3">Rastreamento e Cookies</h4>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-border text-xs">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-2 text-left">Declaração</th>
                          <th className="border border-border p-2 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2">Rastrearemos a localização do seu dispositivo enquanto você não estiver usando o app?</td>
                          <td className="border border-border p-2 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Rastrearemos a localização do seu dispositivo para oferecer os serviços do BioPeak?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Usamos cookies e tecnologias semelhantes não essenciais?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Rastrearemos suas atividades de navegação em outros sites?</td>
                          <td className="border border-border p-2 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Ouvimos você usando o microfone do dispositivo?</td>
                          <td className="border border-border p-2 font-semibold text-red-600">Não</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-base font-semibold mb-3">Comunicação com Usuários</h4>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-border text-xs">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-2 text-left">Declaração</th>
                          <th className="border border-border p-2 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2">Avisaremos antes de fazer alterações importantes nesta Política de Privacidade?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Enviaremos comunicações de marketing para você?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, exceto se recusado ou mediante consentimento expresso</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2">Enviaremos notificações push em dispositivos móveis?</td>
                          <td className="border border-border p-2 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Contato</h3>
                  <p>
                    Se você tiver dúvidas sobre esta Política de Privacidade ou quiser exercer seus direitos de privacidade, entre em contato com nossa equipe de suporte através do e-mail: <a href="mailto:relacionamento@consumo-inteligente.com" className="text-primary underline">relacionamento@consumo-inteligente.com</a>
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Atualizações</h3>
                  <p>
                    Esta Política poderá ser atualizada periodicamente. Caso façamos mudanças significativas, você será informado por meio do aplicativo ou por outros meios apropriados.
                  </p>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h2 className="text-lg font-bold mb-4">CONTRATO DE LICENÇA DE USUÁRIO FINAL DE APLICATIVO LICENCIADO</h2>
                
                <p className="mb-4">Os aplicativos disponibilizados pela App Store são licenciados, não vendidos, a você. Sua licença para cada Aplicativo está sujeita à sua aceitação prévia de um Contrato de Licença de Usuário Final de Aplicativo Licenciado ("EULA Padrão") ou de um contrato de licença de usuário final personalizado entre você e o Provedor do Aplicativo ("EULA Personalizado"), caso seja fornecido.</p>

                <p className="mb-4">Sua licença para qualquer Aplicativo Apple sob este EULA Padrão ou EULA Personalizado é concedida pela Apple, e sua licença para qualquer Aplicativo de Terceiros sob este EULA Padrão ou EULA Personalizado é concedida pelo Provedor do Aplicativo desse Aplicativo de Terceiros. Qualquer Aplicativo sujeito a este EULA Padrão é referido neste documento como "Aplicativo Licenciado". O Provedor do Aplicativo ou a Apple, conforme aplicável ("Licenciante"), reserva todos os direitos sobre o Aplicativo Licenciado que não sejam expressamente concedidos a você sob este EULA Padrão.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">a. Escopo da Licença</h3>
                <p className="mb-4">O Licenciante concede a você uma licença intransferível para usar o Aplicativo Licenciado em quaisquer produtos de marca Apple que você possua ou controle e conforme permitido pelas Regras de Uso.</p>

                <p className="mb-4">Os termos deste EULA Padrão regerão qualquer conteúdo, materiais ou serviços acessíveis a partir do Aplicativo Licenciado ou adquiridos dentro dele, bem como upgrades fornecidos pelo Licenciante que substituam ou complementem o Aplicativo Licenciado original, a menos que tal upgrade seja acompanhado de um EULA Personalizado.</p>

                <p className="mb-4">Exceto conforme previsto nas Regras de Uso, você não pode distribuir ou disponibilizar o Aplicativo Licenciado em uma rede onde possa ser usado por múltiplos dispositivos ao mesmo tempo. Você não pode transferir, redistribuir ou sublicenciar o Aplicativo Licenciado e, caso venda seu Dispositivo Apple a um terceiro, deverá remover o Aplicativo Licenciado antes de fazê-lo.</p>

                <p className="mb-4">Você não pode copiar (exceto conforme permitido por esta licença e pelas Regras de Uso), realizar engenharia reversa, desmontar, tentar derivar o código-fonte, modificar ou criar trabalhos derivados do Aplicativo Licenciado, de quaisquer updates ou de qualquer parte dele (exceto na medida em que tal restrição seja proibida pela lei aplicável ou permitida pelos termos de licenciamento de componentes de código aberto incluídos no Aplicativo Licenciado).</p>

                <h3 className="text-base font-semibold mt-6 mb-3">b. Consentimento para Uso de Dados</h3>
                <p className="mb-4">Você concorda que o Licenciante pode coletar e usar dados técnicos e informações relacionadas — incluindo, mas não se limitando, a informações técnicas sobre seu dispositivo, sistema, software do aplicativo e periféricos — que sejam coletadas periodicamente para facilitar a prestação de atualizações de software, suporte a produtos e outros serviços a você (se houver) relacionados ao Aplicativo Licenciado.</p>

                <p className="mb-4">O Licenciante poderá usar essas informações, desde que em formato que não identifique você pessoalmente, para melhorar seus produtos ou fornecer serviços ou tecnologias.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">c. Rescisão</h3>
                <p className="mb-4">Este EULA Padrão é válido até ser rescindido por você ou pelo Licenciante. Seus direitos sob este EULA Padrão serão rescindidos automaticamente caso você não cumpra com qualquer um de seus termos.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">d. Serviços Externos</h3>
                <p className="mb-4">O Aplicativo Licenciado pode permitir acesso a serviços e websites do Licenciante e/ou de terceiros (coletivamente e individualmente, "Serviços Externos"). Você concorda em usar os Serviços Externos por sua conta e risco.</p>

                <p className="mb-4">O Licenciante não é responsável por examinar ou avaliar o conteúdo ou a precisão de quaisquer Serviços Externos de terceiros e não será responsável por tais Serviços Externos.</p>

                <p className="mb-4">Dados exibidos por qualquer Aplicativo Licenciado ou Serviço Externo, incluindo, mas não se limitando a informações financeiras, médicas e de localização, são apenas para fins informativos gerais e não são garantidos pelo Licenciante ou seus agentes.</p>

                <p className="mb-4">Você não usará os Serviços Externos de maneira inconsistente com este EULA Padrão ou que infrinja direitos de propriedade intelectual do Licenciante ou de terceiros. Você concorda em não usar os Serviços Externos para assediar, abusar, perseguir, ameaçar ou difamar qualquer pessoa ou entidade, e reconhece que o Licenciante não é responsável por qualquer uso desse tipo.</p>

                <p className="mb-4">Os Serviços Externos podem não estar disponíveis em todos os idiomas ou em seu país de residência, e podem não ser apropriados ou disponíveis para uso em determinado local. Caso você opte por usá-los, será o único responsável por cumprir as leis aplicáveis.</p>

                <p className="mb-4">O Licenciante reserva o direito de alterar, suspender, remover, desabilitar ou impor restrições de acesso a quaisquer Serviços Externos a qualquer momento, sem aviso prévio ou responsabilidade.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">e. AUSÊNCIA DE GARANTIA</h3>
                <p className="mb-4">VOCÊ RECONHECE E CONCORDA EXPRESSAMENTE QUE O USO DO APLICATIVO LICENCIADO É POR SUA CONTA E RISCO.</p>

                <p className="mb-4">Na máxima extensão permitida pela lei aplicável, o Aplicativo Licenciado e quaisquer serviços prestados ou fornecidos por ele são disponibilizados "NO ESTADO EM QUE SE ENCONTRAM" e "CONFORME DISPONÍVEIS", com todas as falhas e sem garantias de qualquer tipo.</p>

                <p className="mb-4">O Licenciante se isenta de todas as garantias, expressas, implícitas ou legais, incluindo, mas não se limitando, às garantias implícitas de comercialização, qualidade satisfatória, adequação a uma finalidade específica, precisão, desfrute pacífico e não violação de direitos de terceiros.</p>

                <p className="mb-4">Nenhuma informação ou conselho, oral ou escrito, fornecido pelo Licenciante ou por representante autorizado criará qualquer garantia.</p>

                <p className="mb-4">Se o Aplicativo Licenciado ou serviços se mostrarem defeituosos, você assumirá todos os custos de manutenção, reparo ou correção necessários.</p>

                <p className="mb-4">Algumas jurisdições não permitem a exclusão de garantias implícitas, de modo que a exclusão acima pode não se aplicar a você.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">f. Limitação de Responsabilidade</h3>
                <p className="mb-4">Na medida em que não seja proibido por lei, em nenhum caso o Licenciante será responsável por lesões pessoais ou quaisquer danos incidentais, especiais, indiretos ou consequenciais de qualquer tipo, incluindo, sem limitação, perda de lucros, perda de dados, interrupção de negócios ou quaisquer outros prejuízos comerciais, decorrentes ou relacionados ao uso ou incapacidade de usar o Aplicativo Licenciado, independentemente da teoria de responsabilidade (contrato, ato ilícito ou outro), mesmo que o Licenciante tenha sido avisado da possibilidade de tais danos.</p>

                <p className="mb-4">Em nenhum caso a responsabilidade total do Licenciante para com você por todos os danos (exceto quando exigido pela lei aplicável em casos de lesão pessoal) excederá cinquenta dólares (US$ 50,00).</p>

                <p className="mb-4">As limitações acima se aplicarão mesmo que a solução apresentada não cumpra sua finalidade essencial.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">g. Exportação</h3>
                <p className="mb-4">Você não poderá usar ou exportar/reexportar o Aplicativo Licenciado, exceto conforme autorizado pela legislação dos Estados Unidos e pelas leis da jurisdição em que o Aplicativo foi obtido.</p>

                <p className="mb-4">Em particular, o Aplicativo Licenciado não pode ser exportado ou reexportado para (a) países sob embargo dos EUA ou (b) indivíduos presentes nas listas do Departamento do Tesouro dos EUA (Specially Designated Nationals) ou do Departamento de Comércio dos EUA (Denied Persons List ou Entity List).</p>

                <p className="mb-4">Ao usar o Aplicativo Licenciado, você declara e garante que não se encontra em nenhum desses países nem em tais listas. Você também concorda em não usar esses produtos para fins proibidos pela legislação dos EUA, incluindo, sem limitação, desenvolvimento, design, fabricação ou produção de armas nucleares, mísseis ou químicas/biológicas.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">h. Itens Comerciais</h3>
                <p className="mb-4">O Aplicativo Licenciado e a documentação associada são "Itens Comerciais", conforme definido em 48 C.F.R. §2.101, consistindo em "Software Comercial de Computador" e "Documentação de Software Comercial de Computador". Esses itens são licenciados a usuários finais do Governo dos EUA apenas como Itens Comerciais, com apenas os direitos concedidos a todos os outros usuários, de acordo com este EULA.</p>

                <h3 className="text-base font-semibold mt-6 mb-3">i. Lei Aplicável</h3>
                <p className="mb-4">Exceto na medida em que seja expressamente previsto no parágrafo seguinte, este EULA e a relação entre você e a Apple serão regidos pelas leis do Estado da Califórnia, EUA, excluindo suas disposições sobre conflitos de leis.</p>

                <p className="mb-4">Você e a Apple concordam em submeter-se à jurisdição pessoal e exclusiva dos tribunais localizados no condado de Santa Clara, Califórnia, para resolver qualquer disputa decorrente deste EULA.</p>

                <p className="mb-4">Se: (a) você não for cidadão dos EUA; (b) não residir nos EUA; (c) não acessar o Serviço a partir dos EUA; e (d) for cidadão de um dos países listados abaixo, então qualquer disputa decorrente deste EULA será regida pela lei aplicável estabelecida abaixo, e você se submete irrevogavelmente à jurisdição não exclusiva dos tribunais localizados no estado, província ou país correspondente:</p>

                <p className="mb-4">Se você for cidadão de qualquer país da União Europeia, Suíça, Noruega ou Islândia, a lei e o foro aplicáveis serão os de sua residência habitual.</p>

                <p className="mb-4">Fica expressamente excluída a aplicação da Convenção das Nações Unidas sobre Contratos de Venda Internacional de Mercadorias.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Paywall2;