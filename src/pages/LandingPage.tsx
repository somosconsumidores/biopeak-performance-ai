import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
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
import bioPeakLogo from '@/assets/biopeak-logo.png';

export const LandingPage = () => {
  const features = [
    {
      icon: Brain,
      title: 'IA Inteligente',
      description: 'Análise avançada dos seus treinos com machine learning para insights personalizados.'
    },
    {
      icon: Activity,
      title: 'Integração Garmin',
      description: 'Sincronização automática com seus dispositivos Garmin para dados precisos.'
    },
    {
      icon: TrendingUp,
      title: 'Evolução Contínua',
      description: 'Acompanhe sua progressão com métricas detalhadas e recomendações.'
    },
    {
      icon: Target,
      title: 'Metas Inteligentes',
      description: 'Definição automática de objetivos baseados no seu perfil e performance.'
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

  const stats = [
    { value: '10,000+', label: 'Atletas Ativos' },
    { value: '95%', label: 'Melhoria na Performance' },
    { value: '24/7', label: 'Monitoramento' },
    { value: '30%', label: 'Redução de Lesões' }
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
              <img src={`${bioPeakLogo}?v=${Date.now()}`} alt="BioPeak" className="h-20 w-20 data-glow" />
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Treino é Físico.
              </span>
              <br />
              Evolução é nos Dados.
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              O primeiro app que usa IA para transformar seus dados de treino Garmin em 
              estratégias inteligentes de performance. Porque treino é físico, mas evolução é nos dados.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="btn-primary text-lg px-8 py-4" asChild>
                <Link to="/auth">
                  Começar Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="glass-card border-glass-border text-lg px-8 py-4">
                Ver Demo
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center glass-card p-6">
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
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
                Tecnologia de <span className="bg-gradient-primary bg-clip-text text-transparent">Ponta</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Combinamos inteligência artificial avançada com dados precisos do Garmin 
                para oferecer insights que nenhum outro app consegue.
              </p>
            </div>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <ScrollReveal key={index} delay={index * 100}>
                <Card className="glass-card border-glass-border h-full">
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-full mb-4">
                      <feature.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
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
                  Não somos apenas mais um app de treino. Somos a evolução 
                  da análise esportiva, transformando cada batimento cardíaco 
                  em estratégia de performance.
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
              <div className="glass-card p-8 space-y-6">
                <div className="metric-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">VO2 Max</span>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">58.4 ml/kg/min</div>
                  <div className="text-sm text-primary">+12% este mês</div>
                </div>
                
                <div className="metric-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Zona Ótima</span>
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">Zona 3-4</div>
                  <div className="text-sm text-primary">85% do tempo</div>
                </div>
                
                <div className="metric-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Recuperação</span>
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">94%</div>
                  <div className="text-sm text-primary">Pronto para treino</div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="glass-card p-12 text-center">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                Pronto para <span className="bg-gradient-primary bg-clip-text text-transparent">Evoluir?</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Junte-se a milhares de atletas que já descobriram o poder da análise 
                inteligente. Comece sua jornada para a performance máxima hoje.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="btn-primary text-lg px-8 py-4" asChild>
                  <Link to="/auth">
                    Começar Gratuitamente
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="glass-card border-glass-border text-lg px-8 py-4">
                  Falar com Especialista
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
                <img src={`${bioPeakLogo}?v=${Date.now()}`} alt="BioPeak" className="h-8 w-8" />
                <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  BioPeak
                </span>
              </div>
              <p className="text-muted-foreground">
                Transformando treinos em estratégia com inteligência artificial.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Produto</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Dashboard</li>
                <li>Análise IA</li>
                <li>Integração Garmin</li>
                <li>Insights</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Suporte</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Central de Ajuda</li>
                <li>Documentação</li>
                <li>Contato</li>
                <li>Status</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Sobre</li>
                <li>Blog</li>
                <li>Carreiras</li>
                <li>Privacidade</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-glass-border text-center text-muted-foreground">
            <p>&copy; 2024 BioPeak. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
