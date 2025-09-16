import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckIcon, Star, Clock, Shield, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';

const PromoLanding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isIOS, isNative } = usePlatform();
  const [loading, setLoading] = useState(false);
  
  // Extrair parâmetros da URL
  const campaign = searchParams.get('campaign') || 'especial';
  const promoPrice = searchParams.get('price') || '12.90';
  const discount = searchParams.get('discount') || '67';
  const originalPrice = '29.90';
  
  useEffect(() => {
    // Analytics tracking
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'page_view', {
        page_title: `Promo Landing - ${campaign}`,
        page_location: window.location.href,
        campaign: campaign
      });
    }
  }, [campaign]);

  const handleCheckout = async () => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      // Track conversion intent
      if (typeof (window as any).gtag !== 'undefined') {
        (window as any).gtag('event', 'begin_checkout', {
          currency: 'BRL',
          value: parseFloat(promoPrice),
          campaign: campaign
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to auth with promo parameters
        const authUrl = `/auth?promo=${campaign}&price=${promoPrice}&plan=monthly`;
        navigate(authUrl);
        return;
      }

      // For logged users, call checkout directly
      const { data, error } = await supabase.functions.invoke('create-promo-checkout', {
        body: { 
          campaign,
          promoPrice: parseFloat(promoPrice),
          returnUrl: window.location.href
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
      
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Erro no checkout",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: "IA Avançada",
      description: "Análise inteligente dos seus treinos com insights personalizados"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Sincronização Total",
      description: "Conecte Garmin, Strava, Polar e Apple Watch automaticamente"
    },
    {
      icon: <Star className="h-6 w-6" />,
      title: "Métricas Avançadas",
      description: "VO2 Max, zonas de FC, análise de performance e muito mais"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card/20 to-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Clock className="h-4 w-4" />
            Oferta por tempo limitado
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-4">
            BioPeak PRO
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto">
            Transforme seus treinos com inteligência artificial avançada e análises que só atletas profissionais tinham acesso
          </p>
        </div>

        {/* Pricing Card */}
        <Card className="max-w-md mx-auto mb-12 border-primary/20 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="text-sm text-muted-foreground line-through mb-1">
                De R$ {originalPrice}/mês
              </div>
              <div className="text-5xl font-bold text-primary mb-1">
                R$ {promoPrice}
              </div>
              <div className="text-sm text-muted-foreground">
                por mês • Economia de {discount}%
              </div>
            </div>
            
            <Button 
              onClick={handleCheckout}
              disabled={loading}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 transform hover:scale-[1.02]"
            >
              {loading ? 'Processando...' : 'GARANTIR DESCONTO AGORA'}
            </Button>
            
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Cancele quando quiser • Garantia de 7 dias
            </div>
          </CardContent>
        </Card>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          {benefits.map((benefit, index) => (
            <Card key={index} className="text-center p-6 border-muted/20 hover:border-primary/20 transition-colors">
              <CardContent className="p-0">
                <div className="flex justify-center mb-4 text-primary">
                  {benefit.icon}
                </div>
                <h3 className="font-bold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features List */}
        <Card className="max-w-3xl mx-auto mb-12">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-center mb-8">
              O que você vai ter acesso:
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                'Análises de IA personalizadas',
                'Sincronização automática com dispositivos',
                'Métricas avançadas de performance',
                'Planos de treino inteligentes',
                'Análise de recuperação',
                'Predição de lesões',
                'Comparação com atletas similares',
                'Suporte prioritário'
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <CheckIcon className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Social Proof */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
            ))}
          </div>
          <p className="text-muted-foreground">
            Mais de <strong>2.500 atletas</strong> já transformaram seus treinos
          </p>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <Button 
            onClick={handleCheckout}
            disabled={loading}
            size="lg"
            className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 transform hover:scale-[1.02] mb-4"
          >
            {loading ? 'Processando...' : 'QUERO MEU DESCONTO AGORA'}
          </Button>
          
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Ao continuar, você concorda com nossos termos de uso e política de privacidade.
            Cobrança recorrente mensal. Cancele a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PromoLanding;