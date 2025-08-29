import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Heart, 
  Zap, 
  Activity,
  BarChart3,
  LineChart,
  Target,
  AlertTriangle,
  Sparkles,
  MapPin,
  Trophy,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { usePremiumStats } from '@/hooks/usePremiumStats';
import { PremiumStatsCards } from '@/components/PremiumStatsCards';
import { VolumeEvolutionChart } from '@/components/VolumeEvolutionChart';
import { PaceTrendChart } from '@/components/PaceTrendChart';
import { HeartRateZonesChart } from '@/components/HeartRateZonesChart';
import { VariationAnalysisChart } from '@/components/VariationAnalysisChart';
import { EffortDistributionChart } from '@/components/EffortDistributionChart';
import { OvertrainingRiskMeter } from '@/components/OvertrainingRiskMeter';
import { PremiumAIInsights } from '@/components/PremiumAIInsights';
import { SimpleAchievementBadge } from '@/components/SimpleAchievementBadge';
import { GPSHeatmap } from '@/components/GPSHeatmap';

const PREMIUM_ALLOWED_EMAILS = [
  'admin@biopeak.com',
  'garminteste07@teste.com'
];

export const PremiumStats = () => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  const {
    weeklyStats,
    paceStats,
    heartRateStats,
    variationAnalysis,
    effortDistribution,
    overtrainingRisk,
    achievements,
    gpsData,
    loading,
    error,
    refreshInsights
  } = usePremiumStats();

  useEffect(() => {
    if (user?.email) {
      const userHasAccess = PREMIUM_ALLOWED_EMAILS.includes(user.email);
      setHasAccess(userHasAccess);
    }
    setChecking(false);
  }, [user]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Verificando acesso...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <Card className="max-w-md glass-card border-glass-border">
                <CardContent className="p-6 text-center">
                  <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                  <h2 className="text-xl font-semibold mb-2">Acesso Premium Requerido</h2>
                  <p className="text-muted-foreground mb-4">
                    Esta funcionalidade estará disponível em breve para assinantes premium.
                  </p>
                  <Badge variant="outline" className="bg-gradient-primary text-white border-0">
                    Em breve: Plano Premium
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Carregando estatísticas premium...</p>
              </div>
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
            <div className="flex items-center justify-center min-h-[400px]">
              <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar estatísticas: {error}
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <ScrollReveal>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-6 w-6 text-gradient-primary" />
                <Badge className="bg-gradient-primary text-white border-0 px-3 py-1">
                  Premium
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Painel <span className="bg-gradient-primary bg-clip-text text-transparent">Estatístico</span>
              </h1>
              <p className="text-muted-foreground">
                Análises avançadas e insights exclusivos para otimizar sua performance
              </p>
            </div>
          </ScrollReveal>

          {/* 1. Resumo Rápido - Cards no topo */}
          <ScrollReveal delay={100}>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Resumo Semanal
              </h2>
              <PremiumStatsCards 
                weeklyDistance={weeklyStats?.averageDistance}
                averagePace={paceStats?.averagePace}
                averageHeartRate={heartRateStats?.averageHR}
                cardiacEfficiency={heartRateStats?.cardiacEfficiency}
              />
            </div>
          </ScrollReveal>

          {/* 2. Gráficos de Evolução */}
          <ScrollReveal delay={200}>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Evolução de Performance
              </h2>
              <div className="grid gap-6 lg:grid-cols-2">
                <VolumeEvolutionChart data={weeklyStats?.volumeData} />
                <PaceTrendChart data={paceStats?.trendData} />
              </div>
            </div>
          </ScrollReveal>

          {/* Zonas de Frequência Cardíaca */}
          <ScrollReveal delay={250}>
            <div className="mb-8">
              <HeartRateZonesChart data={heartRateStats?.zonesData} />
            </div>
          </ScrollReveal>

          {/* 3. Análises Avançadas */}
          <ScrollReveal delay={300}>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Análises Avançadas
              </h2>
              <div className="grid gap-6 lg:grid-cols-3">
                <VariationAnalysisChart data={variationAnalysis} />
                <EffortDistributionChart data={effortDistribution} />
                <OvertrainingRiskMeter risk={overtrainingRisk} />
              </div>
            </div>
          </ScrollReveal>

          {/* 4. Insights Premium da IA */}
          <ScrollReveal delay={350}>
            <div className="mb-8">
              <PremiumAIInsights onRefresh={refreshInsights} />
            </div>
          </ScrollReveal>

          {/* 5. Medalhas e Heatmap */}
          <ScrollReveal delay={400}>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Medalhas */}
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Conquistas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {achievements?.slice(0, 6).map((achievement, index) => (
                      <SimpleAchievementBadge key={index} achievement={achievement} />
                    ))}
                  </div>
                  {!achievements?.length && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Continue treinando para desbloquear conquistas!
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* GPS Heatmap */}
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Mapa de Calor GPS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GPSHeatmap data={gpsData} />
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};