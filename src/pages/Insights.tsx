import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { useEffect } from 'react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useInsights } from '@/hooks/useInsights';
import { useCommitments } from '@/hooks/useCommitments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import TrainingRecommendationsCard from '@/components/TrainingRecommendationsCard';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Target,
  Heart,
  Activity,
  Zap,
  Award,
  BarChart3,
  Calendar,
  Clock,
  ArrowRight,
  Lightbulb,
  Star,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Info
} from 'lucide-react';

export const Insights = () => {
  const { insights, loading, error, refreshInsights } = useInsights();
  const { applyRecommendation } = useCommitments();
  const { overtrainingRisk, loading: dashboardLoading } = useDashboardMetrics();

  console.log('🔍 INSIGHTS PAGE DEBUG:', { insights, loading, error });

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Gerando Insights com IA</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Analisando seus dados de treino dos últimos 60 dias para criar insights personalizados...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex flex-col items-center justify-center py-32">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro ao Carregar Insights</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">{error}</p>
              <Button onClick={refreshInsights} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        
        <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="text-center mb-8 md:mb-12">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4">
                    Insights <span className="bg-gradient-primary bg-clip-text text-transparent">Personalizados</span>
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    Análise inteligente da sua performance com recomendações baseadas em IA 
                    para maximizar seus resultados
                  </p>
                </div>
                <Button 
                  onClick={refreshInsights} 
                  variant="outline" 
                  className="self-center sm:self-start h-10 sm:h-auto px-4 text-sm touch-manipulation"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </ProtectedRoute>
  );
};