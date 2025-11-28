import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Zap, 
  Brain, 
  TrendingUp, 
  Award, 
  Heart,
  ArrowRight,
  Check,
  Star,
  Apple,
  Chrome
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Download() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: 'IA Personal Coach',
      description: 'Treinamento inteligente adaptado ao seu nível e objetivos',
    },
    {
      icon: Zap,
      title: 'Sem Relógios Caros',
      description: 'Use apenas seu smartphone para treinar e evoluir',
    },
    {
      icon: TrendingUp,
      title: 'Fitness Score',
      description: 'Acompanhe sua evolução com métricas precisas',
    },
    {
      icon: Award,
      title: 'Planos Adaptativos',
      description: 'Periodização inteligente para corrida, ciclismo e natação',
    },
    {
      icon: Heart,
      title: 'Análise Completa',
      description: 'Estatísticas avançadas e detecção de overtraining',
    },
    {
      icon: Star,
      title: 'Insights em Tempo Real',
      description: 'Feedback personalizado durante seus treinos',
    },
  ];

  const stats = [
    { value: '10k+', label: 'Atletas' },
    { value: '50k+', label: 'Treinos' },
    { value: '4.8★', label: 'Avaliação' },
  ];

  const handleAppStoreClick = () => {
    window.open('https://apps.apple.com/br/app/biopeak-ai-coach/id6740126598', '_blank');
  };

  const handleGooglePlayClick = () => {
    window.open('https://play.google.com/store/apps/details?id=com.biopeakai.performance', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="absolute inset-0 bg-grid-white/[0.02]" />
        
        <div className="relative container mx-auto px-4 pt-20 pb-32">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {/* Text Content */}
            <div className="text-center md:text-left space-y-8">
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                <Smartphone className="h-3 w-3 mr-1" />
                Disponível para iOS e Android
              </Badge>

              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                Seu{' '}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
                  Personal Coach
                </span>
                {' '}de Bolso
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground">
                Treine, analise e evolua com IA. Sem relógios caros. Sem complicação.
              </p>

              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start items-center pt-8">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto text-lg h-14 px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                  onClick={handleAppStoreClick}
                >
                  <Apple className="h-5 w-5 mr-2" />
                  App Store
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full sm:w-auto text-lg h-14 px-8 border-2"
                  onClick={handleGooglePlayClick}
                >
                  <Chrome className="h-5 w-5 mr-2" />
                  Google Play
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 pt-16">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center md:text-left">
                    <div className="text-3xl md:text-4xl font-bold text-primary">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* App Screenshot */}
            <div className="flex justify-center md:justify-end">
              <img 
                src="https://grcwlmltlcltmwbhdpky.supabase.co/storage/v1/object/public/app-screenshots/1.png"
                alt="BioPeak App Screenshot"
                className="w-full max-w-sm md:max-w-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Tudo que você precisa para evoluir
          </h2>
          <p className="text-xl text-muted-foreground">
            Tecnologia de ponta ao alcance das suas mãos
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="glass-card border-glass-border p-6 hover:scale-105 transition-transform duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <Card className="glass-card border-glass-border p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-3xl font-bold mb-6">
                  Por que escolher BioPeak?
                </h3>
                <div className="space-y-4">
                  {[
                    'Planos de treino personalizados com IA',
                    'Análise inteligente de performance',
                    'Detecção automática de overtraining',
                    'Suporte para corrida, ciclismo e natação',
                    'Feedback em tempo real durante treinos',
                    'Estatísticas avançadas e insights profundos'
                  ].map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="p-1 rounded-full bg-primary/10 mt-0.5">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl p-8 text-center">
                  <div className="text-5xl font-bold mb-2">R$ 12,90</div>
                  <div className="text-lg text-muted-foreground mb-6">/mês</div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>✓ 7 dias grátis</p>
                    <p>✓ Cancele quando quiser</p>
                    <p>✓ Todas as funcionalidades</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Final CTA */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Pronto para começar sua evolução?
          </h2>
          <p className="text-xl text-muted-foreground">
            Junte-se a milhares de atletas que já transformaram seus treinos com BioPeak
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              size="lg" 
              className="w-full sm:w-auto text-lg h-14 px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              onClick={handleAppStoreClick}
            >
              <Apple className="h-5 w-5 mr-2" />
              Baixar no iPhone
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="w-full sm:w-auto text-lg h-14 px-8 border-2"
              onClick={handleGooglePlayClick}
            >
              <Chrome className="h-5 w-5 mr-2" />
              Baixar no Android
            </Button>
          </div>

          <div className="pt-12">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <button 
                onClick={() => navigate('/auth')}
                className="text-primary hover:underline font-medium"
              >
                Faça login aqui
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-muted-foreground space-y-4">
            <div className="flex justify-center gap-6">
              <button 
                onClick={() => navigate('/privacy-policy')}
                className="hover:text-primary transition-colors"
              >
                Política de Privacidade
              </button>
              <button 
                onClick={() => navigate('/termos-condicoes')}
                className="hover:text-primary transition-colors"
              >
                Termos de Uso
              </button>
            </div>
            <p>© 2024 BioPeak. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
