import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Activity, 
  Brain, 
  Target, 
  TrendingUp, 
  Zap, 
  BarChart3,
  Users,
  Shield,
  ArrowRight,
  CheckCircle,
  Star
} from 'lucide-react';
import { useAppStats } from '@/hooks/useAppStats';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { PricingPlans } from '@/components/PricingPlans';

// Hero logos for different themes
import heroLogoDark from '@/assets/biopeak-logo-dark.png';
import heroLogoLight from '@/assets/biopeak-logo-light.png';
import appStoreBadge from '@/assets/app-store-badge.png';
import playStoreBadge from '@/assets/google-play-badge.png';
import integrationsLanding from '@/assets/integrations-landing.png';

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

// Hero section image
import heroSectionImage from '@/assets/hero-section.png';

// Footer logo imports (keeping theme-based logos for footer)
const bioPeakLogoDark = '/lovable-uploads/adcbb6e8-7310-425b-9c9b-3643e930a025.png';
const bioPeakLogoLight = '/lovable-uploads/aa28b51e-71c3-4b13-a8ae-a1bd20e98fb2.png';


export const LandingPage = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState(0);
  const { theme } = useTheme();
  const { stats: appStats, loading: statsLoading } = useAppStats();
  const { t } = useTranslation();

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

  // Get current effective theme
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };
  
  const currentTheme = getEffectiveTheme();
  const heroLogo = currentTheme === 'light' ? heroLogoLight : heroLogoDark;
  const footerLogo = currentTheme === 'light' ? bioPeakLogoLight : bioPeakLogoDark;

  const features = [
    {
      icon: Brain,
      title: t('intelligentAI'),
      description: t('aiDescription')
    },
    {
      icon: Activity,
      title: "Integração Multi Plataformas",
      description: "Integração com Garmin, Polar e Strava"
    },
    {
      icon: TrendingUp,
      title: t('continuousEvolution'),
      description: t('evolutionDescription')
    },
    {
      icon: Target,
      title: t('smartGoals'),
      description: t('goalsDescription')
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

  // Format number for display
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return num.toString();
  };

  const realStats = [
    { 
      value: statsLoading ? '...' : formatNumber(appStats.totalAthletes), 
      label: t('athletesRegistered')
    },
    { 
      value: statsLoading ? '...' : formatNumber(appStats.totalActivities), 
      label: t('activitiesRegistered')
    },
    { 
      value: statsLoading ? '...' : formatNumber(appStats.totalInsights), 
      label: t('insightsProvided')
    },
    { 
      value: statsLoading ? '...' : formatNumber(appStats.totalGoals), 
      label: t('goalsAssigned')
    }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="container mx-auto text-center">
          <ScrollReveal>
            <div className="flex justify-center mb-8">
              <img src={currentTheme === 'dark' ? 'https://static.wixstatic.com/media/a025ad_c1e0c16bd0ba45ab9f029a916605e9cd~mv2.png' : 'https://static.wixstatic.com/media/a025ad_ee60ef288f514496a4a23562f1ad4c03~mv2.png'} alt="BioPeak" className={`${currentTheme === 'dark' ? 'h-32 sm:h-40 md:h-48 lg:h-52' : 'h-40 sm:h-52 md:h-60 lg:h-64'} w-auto data-glow`} />
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                {t('physicalTraining')}
              </span>
              <br />
              {t('evolutionInData')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('heroDescription')}
            </p>
            <div className="flex justify-center mb-8">
              <img src={heroSectionImage} alt="BioPeak Hero" className="max-h-96 sm:max-h-[30rem] md:max-h-[36rem] lg:max-h-[42rem] w-auto max-w-full object-contain" />
            </div>
            <div className="flex justify-center mb-8">
              <img 
                src={integrationsLanding} 
                alt="Integrações: Garmin Connect, Strava, Apple Health e Polar" 
                className="max-w-3xl w-full px-4"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 min-h-[3rem]" asChild>
                <Link to="/auth">
                  <span className="truncate">{t('getStarted')}</span>
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                </Link>
              </Button>
              <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="glass-card border-glass-border text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 min-h-[3rem]">
                    <span className="truncate">{t('watchDemo')}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl p-0 bg-black/95 border-glass-border">
                  <div className="relative aspect-video w-full">
                    <video
                      className="w-full h-full rounded-lg"
                      controls
                      autoPlay
                      src="https://video.wixstatic.com/video/a025ad_37605819401f4233b39d36a53b392514/720p/mp4/file.mp4"
                    >
                      Seu navegador não suporta vídeos HTML5.
                    </video>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-4xl mx-auto">
              {realStats.map((stat, index) => (
                <div key={index} className="glass-card text-center p-4 lg:p-6 min-h-[120px] flex flex-col justify-center">
                  <div className="text-2xl lg:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm lg:text-base text-muted-foreground">{stat.label}</div>
                </div>
              ))}
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
                O BioPeak AI Coach cria planos adaptativos personalizados, controla seus treinos e te guia em cada passo da sua evolução. Tecnologia de ponta acessível a todos.
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
                        alt="BioPeak Plano de Treino"
                        className="relative w-full lg:w-64 h-auto rounded-2xl shadow-2xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Feature 3 - Details */}
            <ScrollReveal delay={300}>
              <div className="glass-card border-glass-border p-6 lg:p-8 group hover:border-primary/30 transition-all duration-300">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <Activity className="w-3 h-3" />
                      Detalhes
                    </div>
                    <h3 className="text-2xl font-bold">Objetivos Claros e Definidos</h3>
                    <p className="text-muted-foreground">
                      Veja exatamente o que espera por você. Próximos treinos organizados para máxima eficiência.
                    </p>
                  </div>
                  <div className="w-full lg:w-auto flex-shrink-0">
                    <div className="relative group-hover:scale-105 transition-transform duration-300">
                      <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
                      <img 
                        src={aiCoachDetails} 
                        alt="BioPeak Detalhes do Plano"
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

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal>
              <div>
                <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                  {t('whyBioPeak').split(' ')[0]} {t('whyBioPeak').split(' ')[1]} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('whyBioPeak').split(' ').slice(2).join(' ')}</span>
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                  {t('whyDescription')}
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

      {/* Pricing Plans Section */}
      <PricingPlans />

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
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

      {/* App Store Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="glass-card p-8 md:p-12 lg:p-16 text-center max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                BioPeak também está disponível na <span className="bg-gradient-primary bg-clip-text text-transparent">App Store e Play Store</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Monitore seus treinos, acompanhe sua evolução e receba insights de IA diretamente no seu iPhone e Android
              </p>
              <div className="flex flex-wrap justify-center items-center gap-4">
                <a 
                  href="https://apps.apple.com/us/app/biopeak-ai/id6752911184?ct=cta&mt=homepage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block transition-transform hover:scale-105"
                >
                  <img 
                    src={appStoreBadge} 
                    alt="Disponível na App Store" 
                    className="h-16 md:h-20 w-auto"
                  />
                </a>
                <a 
                  href="https://play.google.com/store/apps/details?id=com.biopeakai.performance&pcampaignid=homepage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block transition-transform hover:scale-105"
                >
                  <img 
                    src={playStoreBadge} 
                    alt="Disponível na Play Store" 
                    className="h-16 md:h-20 w-auto"
                  />
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="glass-card p-12 text-center">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                {t('readyToEvolve').split(' ')[0]} {t('readyToEvolve').split(' ')[1]} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('readyToEvolve').split(' ').slice(2).join(' ')}</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                {t('ctaDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="btn-primary text-sm sm:text-base px-4 sm:px-6 py-3 min-h-[3rem] max-w-[200px] sm:max-w-none" asChild>
                  <Link to="/auth">
                    <span className="truncate">{t('startFree')}</span>
                    <ArrowRight className="ml-1 h-4 w-4 flex-shrink-0" />
                  </Link>
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-glass-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img src={`${footerLogo}?v=${Date.now()}`} alt="BioPeak" className="h-8 w-8" />
                <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  BioPeak
                </span>
              </div>
              <p className="text-muted-foreground">
                {t('transformingTraining')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('product')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>{t('dashboard')}</li>
                <li>{t('aiAnalysis')}</li>
                <li>{t('garminIntegration')}</li>
                <li>{t('insights')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('support')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a href="/termos-condicoes" className="hover:text-foreground transition-colors">
                    Termos e Condições
                  </a>
                </li>
                <li>Contato (relacionamento@biopeak-ai.com)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('company')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>{t('about')}</li>
                <li>{t('blog')}</li>
                <li>
                  <a href="/contrato-licenca" className="hover:text-foreground transition-colors">
                    Contrato de Licença de Usuário Final
                  </a>
                </li>
                <li><a href="/privacy-policy" className="hover:text-foreground transition-colors">{t('privacy')}</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-glass-border text-center text-muted-foreground">
            <p>&copy; 2025 BioPeak. {t('allRightsReserved')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
