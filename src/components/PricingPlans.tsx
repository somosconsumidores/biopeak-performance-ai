import React, { useState } from 'react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  Crown, 
  Activity, 
  Brain,
  BarChart3,
  Calendar,
  Target,
  TrendingUp,
  HeartHandshake,
  Zap
} from 'lucide-react';

export const PricingPlans = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const navigate = useNavigate();
  const freePlanFeatures = [
    {
      icon: Activity,
      title: "Integração com Garmin, Strava, Polar e Arquivos GPX",
      description: "Conecte seus dispositivos Strava e Zepp"
    },
    {
      icon: BarChart3,
      title: "Estatísticas básicas de treinos",
      description: "Resumo, histogramas, segmentos de 1km, indicadores de performance, análise de variação e distribuição de zona FC"
    },
    {
      icon: Target,
      title: "Dashboard completo",
      description: "Conquistas pessoais, VO2max, FC média, % recuperação, distribuição dos treinos, pico de performance, score de sono e treinos recentes"
    },
    {
      icon: Calendar,
      title: "Calendário de provas",
      description: "Registre suas provas e objetivos"
    }
  ];

  const proPlanFeatures = [
    {
      icon: Brain,
      title: "Análises exclusivas com IA",
      description: "Treinos de forma individual, análise do sono, BioPeak Fitness Score"
    },
    {
      icon: TrendingUp,
      title: "Risco de Overtraining",
      description: "Monitoramento inteligente para prevenir lesões"
    },
    {
      icon: Zap,
      title: "Insights avançados",
      description: "Insights sobre seu histórico de atividades e painel estatístico do atleta"
    },
    {
      icon: HeartHandshake,
      title: "Análise de preparação",
      description: "Análise de sua preparação para as provas agendadas"
    }
  ];

  const handleCheckout = async () => {
    // Direcionar todos os usuários para o paywall com o plano selecionado
    // O ProtectedRoute do paywall vai garantir que o usuário esteja autenticado
    navigate(`/paywall?plan=${selectedPlan}`);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-muted/5 to-background">
      <div className="container mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Escolha seu <span className="bg-gradient-primary bg-clip-text text-transparent">Plano</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comece gratuitamente e evolua com funcionalidades premium powered by IA
            </p>
          </div>
        </ScrollReveal>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <ScrollReveal delay={100}>
            <Card className="glass-card border-glass-border relative h-full">
              <CardHeader className="text-center pb-8">
                <div className="flex justify-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-muted to-muted/80 rounded-full">
                    <Activity className="h-8 w-8 text-foreground" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">Plano Gratuito</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">R$ 0</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-muted-foreground">
                  Perfeito para começar sua jornada de evolução
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {freePlanFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <feature.icon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-6">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full border-primary/20 hover:bg-primary/5"
                    asChild
                  >
                    <Link to="/auth">
                      Começar Grátis
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Pro Plan */}
          <ScrollReveal delay={200}>
            <Card className="glass-card border-primary/20 relative h-full bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-primary text-white border-0 px-4 py-1">
                  <Crown className="h-3 w-3 mr-1" />
                  Mais Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-8">
                <div className="flex justify-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-full">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">BioPeak Pro</h3>
                
                {/* Toggle between Annual and Monthly */}
                <div className="flex items-center justify-center bg-muted/20 rounded-full p-1 mb-4 max-w-[280px] mx-auto">
                  <button
                    onClick={() => setSelectedPlan('annual')}
                    className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedPlan === 'annual'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Anual
                    {selectedPlan === 'annual' && (
                      <Badge className="absolute -top-2 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 border-0">
                        Economize 35%
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedPlan('monthly')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedPlan === 'monthly'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Mensal
                  </button>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    R$ {selectedPlan === 'annual' ? '12,90' : '19,90'}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                  {selectedPlan === 'annual' && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Cobrado R$ 154,80 anualmente
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground">
                  Análises avançadas com inteligência artificial
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 text-sm font-medium text-primary mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Todos os benefícios do Plano Gratuito</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inclui todas as funcionalidades básicas
                  </p>
                </div>
                
                {proPlanFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-primary rounded-full">
                        <feature.icon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-6">
                  <Button 
                    size="lg" 
                    className="w-full bg-gradient-primary hover:opacity-90 text-white border-0"
                    onClick={handleCheckout}
                  >
                    Assinar BioPeak Pro
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Cancele a qualquer momento
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>

        {/* Additional Benefits Section */}
        <ScrollReveal delay={300}>
          <div className="mt-16 text-center">
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/10 rounded-full mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <h4 className="font-semibold mb-2">Sem Compromisso</h4>
                <p className="text-sm text-muted-foreground">Cancele a qualquer momento, sem taxas ocultas</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-full mb-4">
                  <Brain className="h-6 w-6 text-blue-500" />
                </div>
                <h4 className="font-semibold mb-2">IA Avançada</h4>
                <p className="text-sm text-muted-foreground">Modelos exclusivos para análise esportiva</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/10 rounded-full mb-4">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
                <h4 className="font-semibold mb-2">Sempre Evoluindo</h4>
                <p className="text-sm text-muted-foreground">Novas funcionalidades adicionadas mensalmente</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};