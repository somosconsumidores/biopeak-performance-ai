import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { useState } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { useAppStats } from '@/hooks/useAppStats';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { PricingPlans } from '@/components/PricingPlans';

// Hero logos for different themes
import heroLogoDark from '@/assets/biopeak-logo-dark.png';
import heroLogoLight from '@/assets/biopeak-logo-light.png';

// Footer logo imports (keeping theme-based logos for footer)
const bioPeakLogoDark = '/lovable-uploads/adcbb6e8-7310-425b-9c9b-3643e930a025.png';
const bioPeakLogoLight = '/lovable-uploads/aa28b51e-71c3-4b13-a8ae-a1bd20e98fb2.png';


export const LandingPage = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const { theme } = useTheme();
  const { stats: appStats, loading: statsLoading } = useAppStats();
  const { t } = useTranslation();

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
              <img src="https://static.wixstatic.com/media/a025ad_cf5ff4a4d6074fb7b479925857fd7130~mv2.png" alt="BioPeak Hero" className="max-h-80 sm:max-h-96 md:max-h-[28rem] lg:max-h-[32rem] w-auto max-w-full object-contain" />
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
                      src="https://video.wixstatic.com/video/a025ad_6886c1403efa47e4b2a36a4ba2d58ead/720p/mp4/file.mp4"
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

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                {t('cuttingEdgeTech').split(' ')[0]} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('cuttingEdgeTech').split(' ').slice(1).join(' ')}</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {t('techDescription')}
              </p>
            </div>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <ScrollReveal key={index} delay={index * 100}>
                <Card className="glass-card border-glass-border h-full">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full mb-3 sm:mb-4">
                      <feature.icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 leading-tight">{feature.title}</h3>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
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
              <img
                src="https://static.wixstatic.com/media/a025ad_8a38f7c5df5349a1b82fe1b45c0602a9~mv2.gif"
                alt="Demonstração BioPeak: métricas de treino em ação (GIF)"
                className="w-full h-auto rounded-xl object-contain"
                loading="lazy"
                decoding="async"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <PricingPlans />

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
                <li>{t('helpCenter')}</li>
                <li>{t('documentation')}</li>
                <li>{t('contact')}</li>
                <li>{t('status')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('company')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>{t('about')}</li>
                <li>{t('blog')}</li>
                <li>{t('careers')}</li>
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
