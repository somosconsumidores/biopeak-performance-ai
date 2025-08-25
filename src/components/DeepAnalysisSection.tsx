import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollReveal } from '@/components/ScrollReveal';
import { 
  Brain, 
  FileText, 
  Download, 
  AlertTriangle, 
  Trophy, 
  TrendingUp,
  Heart,
  Target,
  Microscope,
  Lightbulb,
  BarChart3,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivityHistory';
import { useAuth } from '@/hooks/useAuth';

interface DeepAnalysisSectionProps {
  activity: UnifiedActivity;
}

interface DeepAnalysisData {
  analysis: {
    whatWorked: string[];
    toImprove: string[];
    recommendations: string[];
    performanceInsights: {
      efficiency: string;
      pacing: string;
      heartRateAnalysis: string;
      effortDistribution: string;
    };
    recoveryGuidance: {
      estimatedRecoveryTime: string;
      nextWorkoutSuggestions: string;
      nutritionTips: string;
    };
    deepAnalysis: {
      consistencyDiagnosis: {
        heartRateConsistency: string;
        paceConsistency: string;
        overallConsistency: string;
      };
      segmentAnalysis: {
        problemSegments: Array<{
          segmentNumber: number;
          issue: string;
          recommendation: string;
        }>;
        bestSegments: Array<{
          segmentNumber: number;
          strength: string;
        }>;
      };
      variationInsights: {
        paceVariation: string;
        heartRateVariation: string;
        diagnosis: string;
        recommendations: string[];
      };
      technicalInsights: {
        runningEconomy: string;
        fatiguePattern: string;
        tacticalAnalysis: string;
      };
    };
  };
}

export const DeepAnalysisSection = ({ activity }: DeepAnalysisSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Check if user is admin
  const isAdmin = user?.email === 'admin@biopeak.com';

  const generateDeepAnalysis = async () => {
    if (!activity) return;

    setLoading(true);
    try {
      console.log('🤖 Generating deep analysis for activity:', activity.activity_id);
      
      const { data, error } = await supabase.functions.invoke('analyze-workout', {
        body: { activityId: activity.activity_id }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.analysis) {
        setDeepAnalysis(data);
        toast({
          title: "Análise Profunda Concluída",
          description: "A análise completa foi gerada com sucesso!",
        });
      }
    } catch (error) {
      console.error('Error generating deep analysis:', error);
      toast({
        title: "Erro na Análise",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePremiumReport = async () => {
    if (!activity || !isAdmin) return;

    setGeneratingReport(true);
    try {
      console.log('📊 Generating premium report for activity:', activity.activity_id);
      
      const { data, error } = await supabase.functions.invoke('generate-premium-report', {
        body: { activityId: activity.activity_id }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.reportHTML) {
        // Create and download HTML file
        const blob = new Blob([data.reportHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `biopeak-premium-report-${activity.activity_id}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Relatório Premium Gerado",
          description: "O relatório HTML foi baixado com sucesso!",
        });
      }
    } catch (error) {
      console.error('Error generating premium report:', error);
      toast({
        title: "Erro no Relatório",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <ScrollReveal delay={250}>
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-primary" />
              <span>Análise IA Profunda</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={generateDeepAnalysis}
                disabled={loading}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Microscope className="h-4 w-4" />
                )}
                <span>{loading ? 'Analisando...' : 'Gerar Análise'}</span>
              </Button>
              
              {isAdmin && (
                <Button
                  onClick={generatePremiumReport}
                  disabled={generatingReport}
                  variant="default"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  {generatingReport ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span>{generatingReport ? 'Gerando...' : 'Relatório Premium'}</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!deepAnalysis ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <Brain className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Análise Profunda com IA</h3>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  Gere uma análise completa usando dados de histograma, segmentos de 1km, 
                  análise de variação e insights técnicos avançados.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <Badge variant="secondary" className="text-xs">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Histograma de Consistência
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  Segmentos Problemáticos
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Análise de Variação
                </Badge>
                {isAdmin && (
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    Relatório Premium PDF
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Consistency Diagnosis */}
              <div className="space-y-4">
                <h3 className="text-lg flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-primary" />
                  <span>Diagnóstico de Consistência</span>
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Frequência Cardíaca</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.consistencyDiagnosis.heartRateConsistency}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Ritmo (Pace)</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.consistencyDiagnosis.paceConsistency}
                    </p>
                  </Card>
                </div>
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <h4 className="font-medium text-sm mb-2 text-primary">Avaliação Geral</h4>
                  <p className="text-sm">
                    {deepAnalysis.analysis.deepAnalysis.consistencyDiagnosis.overallConsistency}
                  </p>
                </Card>
              </div>

              {/* Segment Analysis */}
              {(deepAnalysis.analysis.deepAnalysis.segmentAnalysis.problemSegments.length > 0 || 
                deepAnalysis.analysis.deepAnalysis.segmentAnalysis.bestSegments.length > 0) && (
                <div className="space-y-4">
                  <h3 className="text-lg flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Análise por Segmentos</span>
                  </h3>
                  
                  {deepAnalysis.analysis.deepAnalysis.segmentAnalysis.problemSegments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>Segmentos Problemáticos</span>
                      </h4>
                      <div className="space-y-2">
                        {deepAnalysis.analysis.deepAnalysis.segmentAnalysis.problemSegments.map((segment, index) => (
                          <Card key={index} className="p-3 border-l-4 border-l-destructive bg-destructive/5">
                            <div className="text-sm">
                              <span className="font-medium">Segmento {segment.segmentNumber}:</span> {segment.issue}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Recomendação:</span> {segment.recommendation}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {deepAnalysis.analysis.deepAnalysis.segmentAnalysis.bestSegments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center space-x-2">
                        <Trophy className="h-4 w-4 text-yellow-600" />
                        <span>Melhores Segmentos</span>
                      </h4>
                      <div className="space-y-2">
                        {deepAnalysis.analysis.deepAnalysis.segmentAnalysis.bestSegments.map((segment, index) => (
                          <Card key={index} className="p-3 border-l-4 border-l-green-500 bg-green-50/50">
                            <div className="text-sm">
                              <span className="font-medium">Segmento {segment.segmentNumber}:</span> {segment.strength}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Variation Insights */}
              <div className="space-y-4">
                <h3 className="text-lg flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>Insights de Variação</span>
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Variação do Pace</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.variationInsights.paceVariation}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Variação da FC</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.variationInsights.heartRateVariation}
                    </p>
                  </Card>
                </div>
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <h4 className="font-medium text-sm mb-2 text-primary">Diagnóstico</h4>
                  <p className="text-sm mb-3">
                    {deepAnalysis.analysis.deepAnalysis.variationInsights.diagnosis}
                  </p>
                  {deepAnalysis.analysis.deepAnalysis.variationInsights.recommendations.length > 0 && (
                    <div>
                      <h5 className="font-medium text-xs mb-1">Recomendações:</h5>
                      <ul className="text-xs space-y-1">
                        {deepAnalysis.analysis.deepAnalysis.variationInsights.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-primary">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </div>

              {/* Technical Insights */}
              <div className="space-y-4">
                <h3 className="text-lg flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <span>Insights Técnicos</span>
                </h3>
                <div className="space-y-3">
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Economia de Movimento</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.technicalInsights.runningEconomy}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Padrão de Fadiga</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.technicalInsights.fatiguePattern}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-2">Análise Tática</h4>
                    <p className="text-sm text-muted-foreground">
                      {deepAnalysis.analysis.deepAnalysis.technicalInsights.tacticalAnalysis}
                    </p>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ScrollReveal>
  );
};