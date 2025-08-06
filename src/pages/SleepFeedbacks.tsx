import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Brain, Calendar, BarChart3 } from 'lucide-react';
import { useSleepFeedback } from '@/hooks/useSleepFeedback';
import { useToast } from '@/hooks/use-toast';
import { ScrollReveal } from '@/components/ScrollReveal';

export const SleepFeedbacks = () => {
  const { savedFeedbacks, loading, error, loadFeedbacks, deleteFeedback } = useSleepFeedback();
  const { toast } = useToast();

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const handleDeleteFeedback = async (id: string) => {
    if (window.confirm('Tem certeza que deseja deletar este feedback?')) {
      try {
        await deleteFeedback(id);
        toast({
          title: "Feedback deletado",
          description: "O feedback foi removido com sucesso.",
        });
      } catch (err) {
        toast({
          title: "Erro ao deletar",
          description: "Não foi possível deletar o feedback. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  };

  const formatAnalysis = (text: string) => {
    return text
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '') // Remove asteriscos
      .split('\n')
      .map((line, index) => {
        if (line.trim() === '') return null;
        
        // Detectar seções numeradas
        if (/^\d+\.\s/.test(line.trim())) {
          return (
            <div key={index} className="mb-4">
              <h3 className="font-semibold text-foreground mb-2">{line.trim()}</h3>
            </div>
          );
        }
        
        // Detectar insight final
        if (line.toLowerCase().includes('insight') || line.toLowerCase().includes('citado')) {
          return (
            <div key={index} className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">💡 Insight Científico</h4>
              <p className="text-foreground italic">{line.trim()}</p>
            </div>
          );
        }
        
        return (
          <p key={index} className="text-muted-foreground mb-2 leading-relaxed">
            {line.trim()}
          </p>
        );
      })
      .filter(Boolean);
  };

  if (loading && savedFeedbacks.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <Brain className="h-8 w-8 text-primary animate-pulse mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando feedbacks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ScrollReveal>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Meus Feedbacks de Sono
          </h1>
          <p className="text-muted-foreground">
            Histórico das suas análises de sono geradas por IA
          </p>
        </div>
      </ScrollReveal>

      {error && (
        <ScrollReveal>
          <Card className="mb-6 border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        </ScrollReveal>
      )}

      {savedFeedbacks.length === 0 ? (
        <ScrollReveal>
          <Card className="glass-card border-glass-border">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum feedback salvo
                </h3>
                <p className="text-muted-foreground mb-6">
                  Você ainda não salvou nenhuma análise de sono. Vá para o dashboard e peça para a IA analisar seu sono!
                </p>
                <Button
                  onClick={() => window.location.href = '/dashboard'}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Ir para Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      ) : (
        <div className="space-y-6">
          {savedFeedbacks.map((feedback, index) => (
            <ScrollReveal key={feedback.id} delay={index * 100}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="text-lg">Análise de Sono</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(feedback.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFeedback(feedback.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Dados de contexto */}
                  <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium text-foreground mb-3">Dados da Análise</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Score do Sono:</span>
                        <div className="font-medium">{feedback.sleep_data.sleepScore}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total de Sono:</span>
                        <div className="font-medium">{feedback.sleep_data.totalSleep}min</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Overtraining:</span>
                        <div className="font-medium">{feedback.overtraining_data.level} ({feedback.overtraining_data.score}/100)</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sono REM:</span>
                        <div className="font-medium">{feedback.sleep_data.remSleep}min</div>
                      </div>
                    </div>
                  </div>

                  {/* Análise formatada */}
                  <div className="space-y-4">
                    {formatAnalysis(feedback.analysis_text)}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
};