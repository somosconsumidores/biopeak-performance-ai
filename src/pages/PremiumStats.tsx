import { useState, useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
  'garminteste07@teste.com',
  'sandro.leao@biopeak-ai.com'
];

export const PremiumStats = () => {
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
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

  if (subscriptionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Premium Necessário</h2>
          <p className="text-muted-foreground mb-4">
            Este conteúdo é exclusivo para assinantes premium.
          </p>
          <Button onClick={() => window.location.href = '/paywall'}>
            Assinar Agora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        
        <div className="pt-20 sm:pt-24 pb-24 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-7xl">
            {/* Header */}
            <ScrollReveal>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-6 w-6 text-primary" />
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

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">Carregando estatísticas premium...</p>
                </div>
              </div>
            ) : error ? (
              <Alert className="mb-8">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar estatísticas: {error}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshInsights}
                    className="ml-4"
                  >
                    Tentar Novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-8">
                {/* Stats Cards */}
                {weeklyStats && paceStats && heartRateStats && (
                  <ScrollReveal>
                    <PremiumStatsCards 
                      weeklyDistance={weeklyStats.averageDistance}
                      averagePace={paceStats.averagePace}
                      averageHeartRate={heartRateStats.averageHR}
                      cardiacEfficiency={heartRateStats.cardiacEfficiency}
                    />
                  </ScrollReveal>
                )}

                {/* Charts Grid - Melhor visualização mobile */}
                <div className="space-y-6 lg:space-y-0 lg:grid lg:gap-6 lg:grid-cols-2">
                  {/* Volume Evolution */}
                  {weeklyStats?.volumeData && (
                    <ScrollReveal>
                      <Card className="glass-card border-glass-border">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Evolução do Volume
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-80 sm:h-64">
                            <VolumeEvolutionChart data={weeklyStats.volumeData} />
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  )}

                  {/* Pace Trend */}
                  {paceStats?.trendData && (
                    <ScrollReveal>
                      <Card className="glass-card border-glass-border">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <LineChart className="h-5 w-5 text-primary" />
                            Tendência de Pace
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-80 sm:h-64">
                            <PaceTrendChart data={paceStats.trendData} />
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  )}

                  {/* Heart Rate Zones */}
                  {heartRateStats?.zonesData && (
                    <ScrollReveal>
                      <Card className="glass-card border-glass-border">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Heart className="h-5 w-5 text-primary" />
                            Zonas de Frequência Cardíaca
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-80 sm:h-64">
                            <HeartRateZonesChart data={heartRateStats.zonesData} />
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  )}

                  {/* Effort Distribution */}
                  {effortDistribution && (
                    <ScrollReveal>
                      <Card className="glass-card border-glass-border">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Zap className="h-5 w-5 text-primary" />
                            Distribuição de Esforço
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-80 sm:h-64">
                            <EffortDistributionChart data={effortDistribution} />
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  )}
                </div>

                {/* Advanced Analytics - Organização mobile-first */}
                <div className="space-y-6 lg:space-y-0 lg:grid lg:gap-6 lg:grid-cols-3">
                  {/* Variation Analysis */}
                  {variationAnalysis && (
                    <ScrollReveal>
                      <Card className="glass-card border-glass-border">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Activity className="h-5 w-5 text-primary" />
                            Análise de Variação
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-72 sm:h-64">
                            <VariationAnalysisChart data={variationAnalysis} />
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  )}

                  {/* Overtraining Risk */}
                  {overtrainingRisk && (
                    <ScrollReveal>
                      <Card className="glass-card border-glass-border">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            Risco de Overtraining
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-72 sm:h-64 flex items-center justify-center">
                            <OvertrainingRiskMeter risk={overtrainingRisk} />
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  )}

                  {/* Achievements */}
                  <ScrollReveal>
                    <Card className="glass-card border-glass-border">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Trophy className="h-5 w-5 text-primary" />
                          Conquistas Recentes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {achievements?.length > 0 ? achievements.slice(0, 5).map((achievement, index) => (
                            <SimpleAchievementBadge 
                              key={index}
                              achievement={achievement}
                            />
                          )) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              Nenhuma conquista recente
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </ScrollReveal>
                </div>

                {/* GPS Heatmap - Altura otimizada para mobile */}
                {gpsData && (
                  <ScrollReveal>
                    <Card className="glass-card border-glass-border">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <MapPin className="h-5 w-5 text-primary" />
                          Mapa de Calor das Atividades
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="h-80 sm:h-96">
                          <GPSHeatmap data={gpsData} />
                        </div>
                      </CardContent>
                    </Card>
                  </ScrollReveal>
                )}

                {/* AI Insights */}
                <ScrollReveal>
                  <PremiumAIInsights onRefresh={refreshInsights} />
                </ScrollReveal>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};