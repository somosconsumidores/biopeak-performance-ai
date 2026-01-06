import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEvolutionStats } from '@/hooks/useEvolutionStats';
import { VO2EvolutionChart } from '@/components/evolution/VO2EvolutionChart';
import { WeeklyDistanceChart } from '@/components/evolution/WeeklyDistanceChart';
import { PaceEvolutionChart } from '@/components/evolution/PaceEvolutionChart';
import { HeartRateEvolutionChart } from '@/components/evolution/HeartRateEvolutionChart';
import { WeeklyCaloriesChart } from '@/components/evolution/WeeklyCaloriesChart';
import { ActivityDistributionChart } from '@/components/evolution/ActivityDistributionChart';
import { Skeleton } from '@/components/ui/skeleton';

export default function Evolution() {
  const navigate = useNavigate();
  const { stats, loading, error, refresh, hasData } = useEvolutionStats();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const lastUpdate = stats?.calculatedAt 
    ? new Date(stats.calculatedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Minha Evolução
                </h1>
                {lastUpdate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Atualizado: {lastUpdate}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
              Tentar novamente
            </Button>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : !hasData ? (
          <EmptyState onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Row 1: VO2 and Distance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <VO2EvolutionChart data={stats?.vo2Evolution || []} />
              <WeeklyDistanceChart data={stats?.distanceEvolution || []} />
            </div>

            {/* Row 2: Pace Evolution (full width) */}
            <PaceEvolutionChart data={stats?.paceEvolution || {}} />

            {/* Row 3: Heart Rate Evolution (full width) */}
            <HeartRateEvolutionChart data={stats?.heartRateEvolution || []} />

            {/* Row 4: Calories and Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <WeeklyCaloriesChart data={stats?.caloriesEvolution || []} />
              <ActivityDistributionChart data={stats?.activityDistribution || []} />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

function EmptyState({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <TrendingUp className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Nenhum dado de evolução</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Ainda não há dados suficientes para calcular sua evolução. 
        Continue treinando e sincronizando suas atividades.
      </p>
      <Button onClick={onRefresh} disabled={isRefreshing} className="gap-2">
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Calcular agora
      </Button>
    </motion.div>
  );
}
