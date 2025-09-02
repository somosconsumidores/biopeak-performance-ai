import { useState, useEffect } from 'react';
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

export const SalesLandingPage = () => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);

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
    { number: "10K+", label: "Treinos Analisados" },
    { number: "2.5K+", label: "Atletas Ativos" },
    { number: "98%", label: "Satisfação" },
    { number: "45%", label: "Melhora Média" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ParticleBackground />
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-card border-0 rounded-none">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">BioPeak</span>
          </div>
          <Link to="/auth">
            <Button variant="outline" size="sm">
              Entrar
            </Button>
          </Link>
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
              Leve sua corrida para o
              <span className="bg-gradient-primary bg-clip-text text-transparent"> próximo nível</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Análises inteligentes, coaching personalizado e insights profissionais para transformar sua performance na corrida.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link to="/auth?plan=pro">
                <Button size="lg" className="btn-primary min-w-[200px]">
                  Começar Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setVideoModalOpen(true)}
                className="min-w-[180px]"
              >
                <Play className="mr-2 h-5 w-5" />
                Ver Demo
              </Button>
            </div>
          </ScrollReveal>

          {/* Hero Image/Mockup */}
          <ScrollReveal delay={400}>
            <div className="relative max-w-4xl mx-auto">
              <div className="glass-card p-8 rounded-2xl">
                <img 
                  src="/lovable-uploads/biopeak-hero-light-new.png" 
                  alt="BioPeak App Interface" 
                  className="w-full rounded-lg shadow-glow"
                />
              </div>
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
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Escolha o plano ideal para você
              </h2>
              <p className="text-lg text-muted-foreground">
                Comece grátis e evolua quando estiver pronto
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <ScrollReveal delay={100}>
              <Card className="glass-card relative">
                <CardContent className="p-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">Gratuito</h3>
                    <div className="text-4xl font-bold mb-6">R$ 0<span className="text-lg text-muted-foreground">/mês</span></div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {[
                      "Até 5 treinos por mês",
                      "Análises básicas",
                      "Sincronização manual",
                      "Suporte por email"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-primary mr-3" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link to="/auth" className="block">
                    <Button variant="outline" className="w-full" size="lg">
                      Começar Grátis
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Pro Plan */}
            <ScrollReveal delay={200}>
              <Card className="glass-card relative border-primary/50">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-primary text-white border-0 px-4 py-1">
                    Mais Popular
                  </Badge>
                </div>
                <CardContent className="p-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">BioPeak Pro</h3>
                    <div className="text-4xl font-bold mb-6">R$ 29<span className="text-lg text-muted-foreground">/mês</span></div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {[
                      "Treinos ilimitados",
                      "IA Coaching avançada",
                      "Sincronização automática",
                      "Analytics profissionais",
                      "Planos personalizados",
                      "Suporte prioritário"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-primary mr-3" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link to="/auth?plan=pro" className="block">
                    <Button className="w-full btn-primary" size="lg">
                      Começar Pro
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </section>

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