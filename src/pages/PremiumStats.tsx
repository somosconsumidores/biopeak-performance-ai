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
  return (
    <ProtectedRoute>
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
        </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};