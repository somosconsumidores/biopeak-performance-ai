import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, TrendingUp, Shield, Brain, Calendar, Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

export const PromoEspecial = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ hours: 23, minutes: 59, seconds: 59 });

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCTAClick = () => {
    // Navigate to auth with promotional plan
    navigate('/auth?plan=promo_special');
  };

  const benefits = [
    {
      icon: Brain,
      title: "Análises exclusivas com IA",
      description: "Treinos individuais, análise do sono, BioPeak Fitness Score"
    },
    {
      icon: Shield,
      title: "Risco de Overtraining",
      description: "Monitoramento inteligente para prevenir lesões"
    },
    {
      icon: TrendingUp,
      title: "Insights avançados",
      description: "Histórico de atividades e painel estatístico completo"
    },
    {
      icon: Calendar,
      title: "Análise de preparação",
      description: "Análise de sua preparação para as provas agendadas"
    }
  ];

  const testimonials = [
    {
      name: "Carlos Silva",
      activity: "Maratonista",
      text: "Evitei lesões e consegui bater meu RP nos 10k em apenas 6 semanas!",
      image: "/api/placeholder/48/48"
    },
    {
      name: "Ana Rodrigues",
      activity: "Triatleta",
      text: "O BioPeak Pro me ajudou a otimizar meus treinos e melhorar 15% minha performance.",
      image: "/api/placeholder/48/48"
    },
    {
      name: "João Santos",
      activity: "Runner",
      text: "Finalmente entendo meu corpo! Os insights são incríveis e muito precisos.",
      image: "/api/placeholder/48/48"
    }
  ];

  const freeFeatures = [
    "Atividades básicas",
    "Contagem de passos",
    "Cálculo de calorias",
    "Histórico limitado"
  ];

  const proFeatures = [
    "Tudo do plano Free",
    "Risco de Overtraining",
    "Análises preditivas com IA",
    "Métricas avançadas",
    "Insights personalizados",
    "Análise do sono",
    "BioPeak Fitness Score",
    "Preparação para provas",
    "Suporte prioritário"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-16 pb-8">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-purple-900/50 to-black/70 z-10"></div>
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&h=1080&fit=crop")'
          }}
        ></div>
        
        <div className="relative z-20 text-center max-w-4xl mx-auto">
          <Badge className="mb-6 bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm font-semibold animate-pulse">
            🔥 OFERTA ESPECIAL POR TEMPO LIMITADO
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Hoje é sua chance de evoluir com o{' '}
            <span className="bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
              BioPeak Pro
            </span>{' '}
            por apenas{' '}
            <span className="text-green-400">R$ 12,90/mês</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Oferta especial por tempo limitado. Aproveite agora e treine com inteligência de dados.
          </p>

          {/* Countdown Timer */}
          <div className="flex justify-center items-center gap-4 mb-8">
            <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-purple-500/30">
              <div className="text-2xl md:text-3xl font-bold text-white">
                {String(timeRemaining.hours).padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-300">HORAS</div>
            </div>
            <div className="text-purple-400 text-2xl">:</div>
            <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-purple-500/30">
              <div className="text-2xl md:text-3xl font-bold text-white">
                {String(timeRemaining.minutes).padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-300">MIN</div>
            </div>
            <div className="text-purple-400 text-2xl">:</div>
            <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-purple-500/30">
              <div className="text-2xl md:text-3xl font-bold text-white">
                {String(timeRemaining.seconds).padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-300">SEG</div>
            </div>
          </div>

          <Button 
            onClick={handleCTAClick}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 text-lg rounded-full shadow-2xl hover:shadow-green-500/25 transform hover:scale-105 transition-all duration-300"
            size="lg"
          >
            🚀 Liberar meu Plano Pro agora
          </Button>
          
          <p className="text-sm text-gray-400 mt-4">
            ⏰ Contador regressivo ativo - não perca essa oportunidade!
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Por que vale a pena migrar para o Pro?
            </h2>
            <p className="text-gray-300 text-lg">
              Desbloqueie todo o potencial do seu treinamento
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-black/30 backdrop-blur border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:transform hover:scale-105">
                <CardContent className="p-6 text-center">
                  <benefit.icon className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-3">{benefit.title}</h3>
                  <p className="text-gray-300 text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Special Offer Section */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 via-purple-800/60 to-green-900/80"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-yellow-500 text-black font-bold px-6 py-2 animate-bounce">
            ⚡ SOMENTE NESTA PÁGINA
          </Badge>
          
          <div className="mb-8">
            <div className="flex justify-center items-center gap-4 mb-4">
              <span className="text-2xl md:text-3xl text-gray-400 line-through">
                De R$ 19,90
              </span>
              <span className="text-4xl md:text-6xl font-bold text-green-400">
                → apenas R$ 12,90/mês
              </span>
            </div>
            <p className="text-gray-200 text-lg">
              Economia de R$ 7,00 por mês - menos que o preço de um café!
            </p>
          </div>

          {/* Secondary Countdown */}
          <div className="flex justify-center items-center gap-2 mb-8 text-sm">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-yellow-400 font-semibold">
              Oferta expira em: {String(timeRemaining.hours).padStart(2, '0')}:
              {String(timeRemaining.minutes).padStart(2, '0')}:
              {String(timeRemaining.seconds).padStart(2, '0')}
            </span>
          </div>

          <Button 
            onClick={handleCTAClick}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 text-xl rounded-full shadow-2xl hover:shadow-green-500/25 transform hover:scale-105 transition-all duration-300"
            size="lg"
          >
            🎯 Quero desbloquear meu Plano Pro
          </Button>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Atletas já estão evoluindo com o BioPeak Pro
            </h2>
            <div className="flex justify-center items-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
              ))}
              <span className="text-gray-300 ml-2">4.9/5 ⭐ (2.847 avaliações)</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-black/30 backdrop-blur border-purple-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-purple-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{testimonial.name}</div>
                      <div className="text-gray-400 text-sm">{testimonial.activity}</div>
                    </div>
                  </div>
                  <p className="text-gray-300 italic">"{testimonial.text}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Free vs Pro: Veja a diferença
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <Card className="bg-black/30 backdrop-blur border-gray-500/20">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-300 mb-2">Plano Gratuito</h3>
                  <div className="text-3xl font-bold text-gray-400">R$ 0</div>
                  <div className="text-gray-500">por mês</div>
                </div>
                <ul className="space-y-3">
                  {freeFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-gray-500" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-gradient-to-br from-purple-900/50 to-green-900/30 backdrop-blur border-green-500/40 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Badge className="bg-green-500 text-white font-bold">🔥 POPULAR</Badge>
              </div>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">BioPeak Pro</h3>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg text-gray-400 line-through">R$ 19,90</span>
                    <div className="text-3xl font-bold text-green-400">R$ 12,90</div>
                  </div>
                  <div className="text-gray-300">por mês</div>
                </div>
                <ul className="space-y-3">
                  {proFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-400" />
                      <span className="text-white font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleCTAClick}
                  className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg"
                >
                  🚀 Começar agora
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 bg-green-500"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Não deixe essa oportunidade passar!
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Apenas R$ 12,90/mês, por tempo limitado.
          </p>
          
          <Button 
            onClick={handleCTAClick}
            className="bg-white text-green-600 hover:bg-gray-100 font-bold py-4 px-12 text-xl rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300"
            size="lg"
          >
            💎 Assinar Pro agora
          </Button>
          
          <p className="text-green-100 text-sm mt-6">
            Promoção exclusiva - válida somente enquanto o contador estiver ativo.
          </p>
        </div>
      </section>

      {/* Fixed CTA for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-green-500 p-4">
        <Button 
          onClick={handleCTAClick}
          className="w-full bg-white text-green-600 hover:bg-gray-100 font-bold py-3 rounded-lg"
        >
          🚀 Assinar Pro R$ 12,90/mês
        </Button>
      </div>
    </div>
  );
};