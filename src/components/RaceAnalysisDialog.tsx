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
  Calendar
} from "lucide-react";
import { TargetRace, useTargetRaces } from "@/hooks/useTargetRaces";
import { useRaceAnalysis, RaceAnalysisResult } from "@/hooks/useRaceAnalysis";

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

  useEffect(() => {
    if (open && race) {
      loadAnalysis();
    }
  }, [open, race]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      // First try to get existing analysis
      const progress = await getRaceProgress(race.id);
      const latestProgress = progress[0];

      if (latestProgress && latestProgress.estimated_time_minutes) {
        // Use existing analysis if available
        setAnalysis({
          estimated_time_minutes: latestProgress.estimated_time_minutes,
          fitness_level: latestProgress.fitness_level || 'beginner',
          readiness_score: latestProgress.readiness_score || 0,
          gap_analysis: latestProgress.gap_analysis || {},
          suggestions: latestProgress.improvement_suggestions || [],
          focus_areas: latestProgress.training_focus_areas || [],
          realistic_target: 'Análise disponível'
        });
      } else {
        // Run new analysis
        const newAnalysis = await analyzeRaceReadiness(race.id);
        if (newAnalysis) {
          setAnalysis(newAnalysis);
        }
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const runNewAnalysis = async () => {
    setLoading(true);
    const newAnalysis = await analyzeRaceReadiness(race.id);
    if (newAnalysis) {
      setAnalysis(newAnalysis);
    }
    setLoading(false);
  };

  const formatDistance = (meters: number) => {
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
                      {formatDistance(race.distance_meters)}
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

            {/* Readiness Score */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Prontidão Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Nível de Prontidão</span>
                    <Badge className={getReadinessLevel(analysis.readiness_score).color}>
                      {getReadinessLevel(analysis.readiness_score).level}
                    </Badge>
                  </div>
                  
                  <Progress value={analysis.readiness_score} className="h-3" />
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{analysis.readiness_score}% pronto</span>
                    <span>Nível: {getFitnessLevelDisplay(analysis.fitness_level)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gap Analysis */}
            {analysis.gap_analysis && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Análise de Gap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.gap_analysis.gap_minutes !== undefined && (
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
                            ({analysis.gap_analysis.gap_percentage?.toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Improvement Suggestions */}
            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Sugestões de Melhoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysis.suggestions.map((suggestion, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{suggestion.area}</h4>
                          <Badge className={getPriorityColor(suggestion.priority)}>
                            {getPriorityLabel(suggestion.priority)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {suggestion.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Focus Areas */}
            {analysis.focus_areas && analysis.focus_areas.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Áreas de Foco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.focus_areas.map((area, index) => (
                      <Badge key={index} variant="secondary">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Realistic Target */}
            {analysis.realistic_target && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Expectativa Realista</h4>
                      <p className="text-sm text-blue-700">{analysis.realistic_target}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={runNewAnalysis}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Atualizar Análise
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Análise não disponível</h3>
            <p className="text-muted-foreground mb-4">
              Não foi possível analisar sua prontidão para esta prova.
            </p>
            <Button onClick={runNewAnalysis}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Executar Análise
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}