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
      title: "Planos de Treino por IA",
      description: "Criação automática de treinos personalizados baseados nos seus dados"
    },
    {
      icon: Activity,
      title: "BioPeak Fitness Score",
      description: "Acompanhe sua evolução com métricas avançadas e risco de overtraining"
    },
    {
      icon: Calendar,
      title: "Calendário de Provas",
      description: "Análise de IA específica sobre sua preparação para objetivos"
    },
    {
      icon: BarChart3,
      title: "Painel Estatístico Avançado",
      description: "Acesso completo a todas as suas estatísticas individuais"
    },
    {
      icon: TrendingUp,
      title: "Monitoramento de Overtraining",
      description: "Alertas inteligentes para prevenir lesões e otimizar recuperação"
    },
    {
      icon: Zap,
      title: "Insights de Performance",
      description: "Recomendações personalizadas baseadas nos seus dados"
    }
  ];

  const handleCheckout = async () => {
    // Redirecionar para auth com parâmetro do plano selecionado
    // Depois o auth vai redirecionar para paywall
    navigate(`/auth?plan=monthly`);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-muted/5 to-background">
      <div className="container mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Benefícios do <span className="bg-gradient-primary bg-clip-text text-transparent">Plano Pro</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Desbloqueie todas as análises de IA e evolua de forma contínua e consistente
            </p>
          </div>
        </ScrollReveal>

        <div className="flex justify-center max-w-2xl mx-auto">
          {/* Pro Plan */}
          <ScrollReveal delay={100}>
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
                
                <div className="mb-4">
                  <span className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    R$ 12,90
                  </span>
                  <span className="text-muted-foreground">/mês</span>
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