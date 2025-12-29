import { useState, useEffect } from 'react';
import { PricingPlans } from '@/components/PricingPlans';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ParticleBackground } from '@/components/ParticleBackground';
import { 
  Play, 
  CheckCircle, 
  TrendingUp, 
  Brain, 
  Zap, 
  Target,
  Users,
  Star,
  ArrowRight,
  Activity,
  BarChart3,
  Smartphone,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import bioPeakIcon from '@/assets/biopeak-icon.png';
import integrationsBanner from '@/assets/integrations-banner.png';

// AI Coach screenshots
import aiCoachDashboard from '@/assets/ai-coach-dashboard.png';
import aiCoachPlan from '@/assets/ai-coach-plan.png';
import aiCoachDetails from '@/assets/ai-coach-details.png';
import aiCoachCalendar from '@/assets/ai-coach-calendar.png';

// Why BioPeak screenshots
import whyBiopeak1 from '@/assets/why-biopeak-1.png';
import whyBiopeak2 from '@/assets/why-biopeak-2.png';
import whyBiopeak3 from '@/assets/why-biopeak-3.png';
import whyBiopeak4 from '@/assets/why-biopeak-4.png';
import whyBiopeak5 from '@/assets/why-biopeak-5.png';

export const SalesLandingPage = () => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState(0);

  const whyBiopeakScreenshots = [
    whyBiopeak1,
    whyBiopeak2,
    whyBiopeak3,
    whyBiopeak4,
    whyBiopeak5
  ];

  // Auto-rotate screenshots
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentScreenshot((prev) => (prev + 1) % whyBiopeakScreenshots.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // SEO optimization
  useEffect(() => {
    document.title = "BioPeak - Análise Inteligente de Performance para Corrida | IA Coach";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Transforme sua corrida com análises de IA, coaching personalizado e insights profissionais. Conecte Garmin, Polar e Strava. Teste grátis!');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Transforme sua corrida com análises de IA, coaching personalizado e insights profissionais. Conecte Garmin, Polar e Strava. Teste grátis!';
      document.head.appendChild(meta);
    }
  }, []);

  const features = [
    {
      icon: Brain,
      title: "IA Coaching Avançada",
      description: "Análises inteligentes dos seus treinos com insights personalizados baseados em IA."
    },
    {
      icon: Activity,
      title: "Monitoramento Completo",
      description: "Frequência cardíaca, pace, distância e métricas avançadas em tempo real."
    },
    {
      icon: BarChart3,
      title: "Analytics Profissionais",
      description: "Dashboards detalhados com evolução de performance e tendências."
    },
    {
      icon: Target,
      title: "Planos Personalizados",
      description: "Treinos adaptados ao seu nível e objetivos específicos."
    },
    {
      icon: Zap,
      title: "Sincronização Automática",
      description: "Conecte com Garmin, Polar e Strava automaticamente."
    },
    {
      icon: Smartphone,
      title: "App Móvel Nativo",
      description: "Interface otimizada para iOS e Android com modo offline."
    }
  ];

  const benefits = [
    'Análise de overtraining em tempo real',
    'Recomendações personalizadas de treino',
    'Comparativo detalhado de sessões',
    'Insights de recuperação muscular',
    'Otimização de zonas de treino',
    'Previsão de picos de performance'
  ];

  const testimonials = [
    {
      name: "Carlos Mendes",
      role: "Triatleta Amador",
      image: "/lovable-uploads/aa28b51e-71c3-4b13-a8ae-a1bd20e98fb2.png",
      content: "O BioPeak transformou minha forma de treinar. As análises de IA me ajudaram a melhorar meu pace em 30 segundos em apenas 2 meses.",
      rating: 5
    },
    {
      name: "Ana Silva",
      role: "Corredora de Rua",
      image: "/lovable-uploads/3dba3af8-cea5-4fda-8621-8da7e87686be.png",
      content: "Finalmente encontrei uma plataforma que entende minhas necessidades. Os insights são incríveis e me mantêm motivada.",
      rating: 5
    },
    {
      name: "Roberto Santos",
      role: "Maratonista",
      image: "/lovable-uploads/9db8aa58-3e45-4e91-81a9-1e132feb4593.png",
      content: "A análise de recuperação do BioPeak é fantástica. Consegui evitar lesões e melhorar consistentemente.",
      rating: 5
    }
  ];

  const stats = [
    { number: "+ 32K", label: "Treinos Analisados" },
    { number: "+ 1.1K", label: "Atletas Ativos" },
    { number: "+2.5K", label: "Insights Fornecidos" },
    { number: "+ 1.2 K", label: "Metas Atribuídas" }
  ];

  const whyBioPeakSlides = [
    {
      id: "overtraining",
      image: "/lovable-uploads/fd514276-aa01-465a-954c-580e5641de95.png",
      title: "Overtraining",
      fullTitle: "Risco de Overtraining",
      description: "Monitore sinais de fadiga excessiva e previna lesões antes que aconteçam. Nossa IA analisa variabilidade da frequência cardíaca, qualidade do sono e percepção de esforço para alertar quando você precisa de mais recuperação."
    },
    {
      id: "fitness-score",
      image: "/lovable-uploads/617223a4-cfde-4217-9adf-12facb3501aa.png",
      title: "BioPeak Fitness Score",
      fullTitle: "BioPeak Fitness Score",
      description: "Uma métrica única que consolida todos os seus dados de treino em um score compreensível. Acompanhe sua evolução de forma global e entenda como cada treino contribui para seu desenvolvimento atlético."
    },
    {
      id: "calendario",
      image: "/lovable-uploads/01d672b4-2333-4e3e-b726-36dfe80c93d3.png",
      title: "Calendário de Provas",
      fullTitle: "Calendário de Provas + IA Avançada",
      description: "Planeje suas provas e deixe nossa IA criar a periodização perfeita. Analise sua preparação em tempo real, ajuste cargas de treino e chegue no dia da prova no seu melhor momento de forma."
    },
    {
      id: "insights",
      image: "/lovable-uploads/38a689f7-74f6-4a67-aa7c-b06d82048f9c.png",
      title: "Insights",
      fullTitle: "Insights sobre Performance Geral",
      description: "Descubra padrões ocultos nos seus dados que só uma IA avançada pode identificar. Receba recomendações personalizadas sobre ritmo, zonas de treino e estratégias para maximizar seus resultados."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ParticleBackground />
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-card border-0 rounded-none">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src={bioPeakIcon} alt="BioPeak Logo" className="w-8 h-8" />
            <span className="text-xl font-bold">BioPeak</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <ScrollReveal>
            <Badge className="mb-6 bg-gradient-primary text-white border-0">
              🚀 Agora com IA Avançada
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Leve seu treino para o
              <span className="bg-gradient-primary bg-clip-text text-transparent"> próximo nível</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Coaching personalizado com planos de treino de Corrida, Ciclismo, Natação e Força (complementar), além de Plano Nutricional e insights profissionais para transformar sua performance como atleta.
            </p>
            <div className="flex justify-center my-4">
              <img 
                src={integrationsBanner} 
                alt="Integrações: Garmin Connect, Strava, Apple Health e Polar" 
                className="max-w-3xl w-full px-4"
              />
            </div>
          </ScrollReveal>


          {/* Hero Image/Mockup */}
          <ScrollReveal delay={400}>
            <div className="relative max-w-6xl mx-auto">
              <img 
                src="https://grcwlmltlcltmwbhdpky.supabase.co/storage/v1/object/public/Geral/HeroSection.png" 
                alt="BioPeak App - Análise Inteligente de Performance para Corrida" 
                className="w-full"
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* AI Coach Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto relative">
          <ScrollReveal>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Seu Personal Coach Inteligente</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                Treine <span className="bg-gradient-primary bg-clip-text text-transparent">Sem Relógios Caros</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                O BioPeak AI Coach cria planos adaptativos personalizados, controla seus treinos e te guia em cada passo da sua evolução. E ainda fornece um Plano Nutricional de acordo com o seu Plano de Treino. BioPeak cumpre o ciclo completo para que sua performance alcance o patamar máximo.
              </p>
            </div>
          </ScrollReveal>

          {/* AI Coach Features Grid */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-7xl mx-auto">
            {/* Feature 1 - Dashboard */}
            <ScrollReveal delay={100}>
              <div className="glass-card border-glass-border p-6 lg:p-8 group hover:border-primary/30 transition-all duration-300">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <Zap className="w-3 h-3" />
                      Dashboard
                    </div>
                    <h3 className="text-2xl font-bold">Treino de Hoje, Sempre Pronto</h3>
                    <p className="text-muted-foreground">
                      Seu treino do dia esperando por você. Planejamento inteligente que se adapta à sua rotina e evolução.
                    </p>
                  </div>
                  <div className="w-full lg:w-auto flex-shrink-0">
                    <div className="relative group-hover:scale-105 transition-transform duration-300">
                      <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
                      <img 
                        src={aiCoachDashboard} 
                        alt="BioPeak Dashboard - Treino de Hoje"
                        className="relative w-full lg:w-64 h-auto rounded-2xl shadow-2xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Feature 2 - Training Plan */}
            <ScrollReveal delay={200}>
              <div className="glass-card border-glass-border p-6 lg:p-8 group hover:border-primary/30 transition-all duration-300">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <Target className="w-3 h-3" />
                      Plano Adaptativo
                    </div>
                    <h3 className="text-2xl font-bold">Plano Personalizado por IA</h3>
                    <p className="text-muted-foreground">
                      Dezenas de treinos criados especificamente para você. Acompanhe seu progresso e alcance seus objetivos.
                    </p>
                  </div>
                  <div className="w-full lg:w-auto flex-shrink-0">
                    <div className="relative group-hover:scale-105 transition-transform duration-300">
                      <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
                      <img 
                        src={aiCoachPlan} 
                        alt="BioPeak Plano de Treinos"
                        className="relative w-full lg:w-64 h-auto rounded-2xl shadow-2xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Feature 3 - Workout Details */}
            <ScrollReveal delay={300}>
              <div className="glass-card border-glass-border p-6 lg:p-8 group hover:border-primary/30 transition-all duration-300">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <Activity className="w-3 h-3" />
                      Nutrição
                    </div>
                    <h3 className="text-2xl font-bold">Plano Nutricional de Acordo com Seu Plano de Treino</h3>
                    <p className="text-muted-foreground">
                      Receba um Plano Nutricional criado com base em seu plano de treino para maximizar sua performance.
                    </p>
                  </div>
                  <div className="w-full lg:w-auto flex-shrink-0">
                    <div className="relative group-hover:scale-105 transition-transform duration-300">
                      <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
                      <img 
                        src="https://grcwlmltlcltmwbhdpky.supabase.co/storage/v1/object/public/Geral/PlanoNutricional.png" 
                        alt="BioPeak Plano Nutricional"
                        className="relative w-full lg:w-64 h-auto rounded-2xl shadow-2xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Feature 4 - Calendar */}
            <ScrollReveal delay={400}>
              <div className="glass-card border-glass-border p-6 lg:p-8 group hover:border-primary/30 transition-all duration-300">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <TrendingUp className="w-3 h-3" />
                      Calendário
                    </div>
                    <h3 className="text-2xl font-bold">Visualize Sua Jornada</h3>
                    <p className="text-muted-foreground">
                      Calendário inteligente com tipos de treino coloridos. Acompanhe seu progresso e planeje sua evolução.
                    </p>
                  </div>
                  <div className="w-full lg:w-auto flex-shrink-0">
                    <div className="relative group-hover:scale-105 transition-transform duration-300">
                      <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
                      <img 
                        src={aiCoachCalendar} 
                        alt="BioPeak Calendário de Treinos"
                        className="relative w-full lg:w-64 h-auto rounded-2xl shadow-2xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* CTA */}
          <ScrollReveal delay={500}>
            <div className="text-center mt-16">
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Comece hoje mesmo e descubra como a IA pode transformar seus treinos
              </p>
              <Link to="/auth">
                <Button size="lg" className="group">
                  Começar Gratuitamente
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {stats.map((stat, index) => (
                <div key={index} className="glass-card p-6">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                    {stat.number}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Tudo que você precisa para evoluir
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Uma plataforma completa com as ferramentas mais avançadas para análise e melhoria da performance.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <ScrollReveal key={index} delay={index * 100}>
                <Card className="glass-card h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal>
              <div>
                <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                  Por que <span className="bg-gradient-primary bg-clip-text text-transparent">BioPeak?</span>
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                  A plataforma mais completa de análise de performance para corrida
                </p>
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                      <span className="text-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            
            <ScrollReveal delay={300}>
              <div className="relative">
                {/* Main display area with phone mockup effect */}
                <div className="relative mx-auto max-w-sm">
                  {/* Phone frame effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/20 to-accent/20 rounded-[3rem] blur-2xl animate-pulse" />
                  
                  {/* Screenshot carousel */}
                  <div className="relative bg-background/10 backdrop-blur-sm rounded-[2.5rem] p-3 border-2 border-primary/30 shadow-2xl">
                    <div className="relative overflow-hidden rounded-[2rem] aspect-[9/19.5] bg-background">
                      {whyBiopeakScreenshots.map((screenshot, index) => (
                        <img
                          key={index}
                          src={screenshot}
                          alt={`BioPeak app demonstration ${index + 1}`}
                          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                            index === currentScreenshot 
                              ? 'opacity-100 scale-100' 
                              : 'opacity-0 scale-95'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Dot indicators */}
                  <div className="flex justify-center gap-2 mt-6">
                    {whyBiopeakScreenshots.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentScreenshot(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          index === currentScreenshot 
                            ? 'bg-primary w-8' 
                            : 'bg-primary/30 hover:bg-primary/50'
                        }`}
                        aria-label={`View screenshot ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Floating elements for visual interest */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                O que nossos atletas dizem
              </h2>
              <p className="text-lg text-muted-foreground">
                Milhares de corredores já transformaram sua performance com o BioPeak
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <ScrollReveal key={index} delay={index * 100}>
                <Card className="glass-card h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4 italic">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center">
                      <img 
                        src={testimonial.image} 
                        alt={testimonial.name}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="font-semibold">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingPlans />

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Perguntas Frequentes
              </h2>
              <p className="text-lg text-muted-foreground">
                Tudo que você precisa saber sobre o BioPeak
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-6">
            {[
              {
                q: "Como funciona a análise de IA?",
                a: "Nossa IA analisa seus dados de treino (frequência cardíaca, pace, distância) e compara com milhares de outros atletas para fornecer insights personalizados sobre sua performance e sugestões de melhoria."
              },
              {
                q: "Quais dispositivos são compatíveis?",
                a: "O BioPeak sincroniza automaticamente com Garmin, Polar e Strava. Também suportamos importação manual de arquivos GPX de qualquer dispositivo."
              },
              {
                q: "Posso cancelar a qualquer momento?",
                a: "Sim, você pode cancelar sua assinatura a qualquer momento. Não há contratos ou taxas de cancelamento."
              },
              {
                q: "Os dados ficam seguros?",
                a: "Absolutamente. Usamos criptografia de nível bancário e seguimos as melhores práticas de segurança. Seus dados nunca são compartilhados com terceiros."
              },
              {
                q: "Funciona offline?",
                a: "Sim, o app móvel funciona offline para registrar treinos. Os dados são sincronizados quando você volta a ter conexão."
              }
            ].map((faq, index) => (
              <ScrollReveal key={index} delay={index * 50}>
                <Card className="glass-card">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-3">{faq.q}</h3>
                    <p className="text-muted-foreground">{faq.a}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary text-white">
        <div className="container mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para elevar sua performance?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Junte-se a milhares de corredores que já estão usando o BioPeak para alcançar seus objetivos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?plan=pro">
                <Button size="lg" variant="secondary" className="min-w-[200px]">
                  Começar Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="min-w-[180px] border-white text-white hover:bg-white hover:text-primary">
                  Teste Grátis
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-background border-t">
        <div className="container mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">BioPeak</span>
            </div>
            <p className="text-muted-foreground mb-6">
              A plataforma mais avançada para análise de performance na corrida
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy-policy" className="hover:text-primary">
                Política de Privacidade
              </Link>
              <span>•</span>
              <Link to="/auth" className="hover:text-primary">
                Suporte
              </Link>
              <span>•</span>
              <span>© 2024 BioPeak. Todos os direitos reservados.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Play className="h-16 w-16 text-primary mb-4 mx-auto" />
              <p className="text-lg font-semibold">Demo do BioPeak</p>
              <p className="text-muted-foreground">Vídeo demonstrativo em breve</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};