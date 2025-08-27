import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  Target, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Lightbulb,
  Calendar,
  Activity,
  Heart,
  Route
} from "lucide-react";
import { TargetRace, useTargetRaces } from "@/hooks/useTargetRaces";
import { useRaceAnalysis, RaceAnalysisResult } from "@/hooks/useRaceAnalysis";
import { useAthleteStats } from "@/hooks/useAthleteStats";

interface RaceAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: TargetRace;
}

export function RaceAnalysisDialog({ open, onOpenChange, race }: RaceAnalysisDialogProps) {
  const [analysis, setAnalysis] = useState<RaceAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { getRaceProgress } = useTargetRaces();
  const { 
    analyzeRaceReadiness, 
    formatTime, 
    getReadinessLevel,
    getFitnessLevelDisplay 
  } = useRaceAnalysis();
  const { 
    stats, 
    loading: statsLoading, 
    formatPace, 
    formatDistance, 
    formatHeartRate, 
    formatVo2Max 
  } = useAthleteStats();

  useEffect(() => {
    if (open && race) {
      loadAnalysis();
    }
  }, [open, race]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      // Run analysis with current race data
      const newAnalysis = await analyzeRaceReadiness({
        distance_meters: race.distance_meters,
        target_time_minutes: race.target_time_minutes
      });
      if (newAnalysis) {
        setAnalysis(newAnalysis);
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const runNewAnalysis = async () => {
    setLoading(true);
    const newAnalysis = await analyzeRaceReadiness({
      distance_meters: race.distance_meters,
      target_time_minutes: race.target_time_minutes
    });
    if (newAnalysis) {
      setAnalysis(newAnalysis);
    }
    setLoading(false);
  };

  const formatRaceDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(0)}K`;
    }
    return `${meters}m`;
  };

  const getDaysUntilRace = () => {
    const today = new Date();
    const raceDate = new Date(race.race_date);
    const diffTime = raceDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntil = getDaysUntilRace();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-500/10 text-green-700 border-green-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análise de Prontidão - {race.race_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p>Analisando seus dados...</p>
            </div>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Race Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Resumo da Prova</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatRaceDistance(race.distance_meters)}
                    </div>
                    <p className="text-muted-foreground">Distância</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {daysUntil}
                    </div>
                    <p className="text-muted-foreground">Dias</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {race.target_time_minutes ? formatTime(race.target_time_minutes) : 'N/A'}
                    </div>
                    <p className="text-muted-foreground">Meta</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatTime(analysis.estimated_time_minutes)}
                    </div>
                    <p className="text-muted-foreground">Estimativa</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fitness Level with Athlete Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Nível Atlético
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">
                      {getFitnessLevelDisplay(analysis.fitness_level)}
                    </div>
                    <p className="text-muted-foreground">
                      Baseado no seu histórico de treinos
                    </p>
                  </div>
                  
                  {/* Athlete Stats Grid */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Estatísticas das Últimas 30 Corridas
                      {stats && stats.totalActivities > 0 && (
                        <span className="ml-2">({stats.totalActivities} atividades)</span>
                      )}
                    </h4>
                    
                    {statsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-pulse text-sm text-muted-foreground">
                          Carregando estatísticas...
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-1">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-sm font-medium">
                            {formatPace(stats?.avgPaceMinKm || null)}
                          </div>
                          <div className="text-xs text-muted-foreground">Pace Médio</div>
                        </div>
                        
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-1">
                            <Heart className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-sm font-medium">
                            {formatHeartRate(stats?.avgHeartRate || null)}
                          </div>
                          <div className="text-xs text-muted-foreground">FC Média</div>
                        </div>
                        
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-1">
                            <Route className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-sm font-medium">
                            {formatDistance(stats?.avgDistanceKm || null)}
                          </div>
                          <div className="text-xs text-muted-foreground">Dist. Média</div>
                        </div>
                        
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-1">
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-sm font-medium">
                            {formatVo2Max(stats?.avgVo2MaxDaniels || null)}
                          </div>
                          <div className="text-xs text-muted-foreground">VO₂ Médio</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gap Analysis */}
            {race.target_time_minutes && analysis.gap_analysis && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Comparação com Meta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        {analysis.gap_analysis.gap_minutes > 0 ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        <span className="font-medium">
                          Diferença para a meta:
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${
                          analysis.gap_analysis.gap_minutes > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {analysis.gap_analysis.gap_minutes > 0 ? '+' : ''}
                          {formatTime(Math.abs(analysis.gap_analysis.gap_minutes))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ({Math.abs(analysis.gap_analysis.gap_percentage).toFixed(1)}% {analysis.gap_analysis.gap_minutes > 0 ? 'mais lento' : 'mais rápido'})
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-4">
              <Button onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Dados insuficientes</h3>
            <p className="text-muted-foreground">
              Você precisa ter pelo menos algumas corridas registradas para ver as estimativas.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
