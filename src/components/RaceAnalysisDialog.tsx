
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
  Route,
  Bot,
  RefreshCw
} from "lucide-react";
import { TargetRace, useTargetRaces } from "@/hooks/useTargetRaces";
import { useRaceAnalysis, RaceAnalysisResult } from "@/hooks/useRaceAnalysis";
import { useAthleteStats } from "@/hooks/useAthleteStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RaceAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: TargetRace;
}

export function RaceAnalysisDialog({ open, onOpenChange, race }: RaceAnalysisDialogProps) {
  const [analysis, setAnalysis] = useState<RaceAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCached, setAiCached] = useState(false);
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
  const { toast } = useToast();

  useEffect(() => {
    if (open && race) {
      loadAnalysis();
      loadCachedAiAnalysis();
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

  const loadCachedAiAnalysis = async () => {
    try {
      // Check for cached AI analysis
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from('race_progress_snapshots')
        .select('ai_analysis, created_at')
        .eq('race_id', race.id)
        .not('ai_analysis', 'is', null)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.ai_analysis) {
        setAiResponse(data.ai_analysis);
        setAiCached(true);
        console.log('Loaded cached AI analysis');
      }
    } catch (error) {
      console.error('Error loading cached AI analysis:', error);
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

  const handleAskAI = async (forceRegenerate = false) => {
    setAiLoading(true);
    setAiCached(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-goal-with-ai', {
        body: { 
          raceId: race.id,
          forceRegenerate 
        }
      });

      if (error) {
        console.error('Error calling AI analysis:', error);
        setAiResponse('Erro ao solicitar análise da IA. Tente novamente.');
        toast({
          title: 'Erro',
          description: 'Não foi possível solicitar a análise da IA. Tente novamente.',
          variant: 'destructive'
        });
      } else {
        const response = data.ai_comment || 'Análise não disponível no momento.';
        setAiResponse(response);
        setAiCached(data.cached || false);
        
        if (data.cached) {
          toast({
            title: 'Análise carregada',
            description: 'Exibindo análise salva dos últimos 7 dias.',
          });
        } else {
          toast({
            title: 'Nova análise gerada',
            description: 'Veja o parecer atualizado da IA abaixo.',
          });
        }
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
      setAiResponse('Erro ao conectar com a IA. Tente novamente.');
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar com a IA.',
        variant: 'destructive'
      });
    } finally {
      setAiLoading(false);
    }
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

                    {/* AI Analysis Buttons */}
                    <div className="mt-4 space-y-2">
                      {!aiResponse ? (
                        <Button 
                          onClick={() => handleAskAI(false)} 
                          disabled={aiLoading}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          {aiLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Analisando...
                            </>
                          ) : (
                            <>
                              <Bot className="h-4 w-4 mr-2" />
                              🤖 Peça para a IA analisar meu objetivo
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleAskAI(false)} 
                            disabled={aiLoading}
                            variant="outline"
                            className="flex-1"
                          >
                            {aiLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                Analisando...
                              </>
                            ) : (
                              <>
                                <Bot className="h-4 w-4 mr-2" />
                                Análise da IA
                              </>
                            )}
                          </Button>
                          <Button 
                            onClick={() => handleAskAI(true)} 
                            disabled={aiLoading}
                            variant="secondary"
                            className="flex-1"
                          >
                            {aiLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                Regenerando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regerar análise
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Response Card */}
            {aiResponse && (
              <Card className="bg-purple-50 border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-800">
                    <Bot className="h-5 w-5" />
                    Parecer da IA
                    {aiCached && (
                      <Badge variant="secondary" className="text-xs">
                        Análise salva
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-purple-900 whitespace-pre-line leading-relaxed">
                    {aiResponse}
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
