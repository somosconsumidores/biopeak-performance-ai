import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Loader2, Save, Check } from 'lucide-react';
import { useSleepAIAnalysis, SleepAnalysisData, OvertrainingAnalysisData } from '@/hooks/useSleepAIAnalysis';
import { useSleepFeedback } from '@/hooks/useSleepFeedback';
import { useToast } from '@/hooks/use-toast';

interface SleepAnalysisDialogProps {
  sleepData: SleepAnalysisData;
  overtrainingData: OvertrainingAnalysisData;
}

export const SleepAnalysisDialog = ({ sleepData, overtrainingData }: SleepAnalysisDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const { analysis, loading, error, analyzeSleep, clearAnalysis } = useSleepAIAnalysis();
  const { saveFeedback, loading: saving } = useSleepFeedback();
  const { toast } = useToast();

  const handleAnalyze = async () => {
    clearAnalysis();
    setSaved(false);
    await analyzeSleep(sleepData, overtrainingData);
  };

  const handleSaveFeedback = async () => {
    if (!analysis) return;

    try {
      await saveFeedback(analysis.analysis, sleepData, overtrainingData);
      setSaved(true);
      toast({
        title: "Feedback salvo!",
        description: "Sua análise foi salva em 'Meus feedbacks de sono'",
      });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o feedback. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formatAnalysis = (text: string) => {
    // Remove asteriscos e formatação markdown desnecessária
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center space-x-2 hover:bg-primary/10"
        >
          <Brain className="h-4 w-4" />
          <span>Peça a IA para analisar seu sono</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Análise de Sono por IA</span>
          </DialogTitle>
          <DialogDescription>
            Análise detalhada do seu sono e correlação com risco de overtraining
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!analysis && !loading && (
            <Card className="glass-card border-glass-border">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Brain className="h-12 w-12 text-primary mx-auto" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      Análise Inteligente do Sono
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Nossa IA especializada analisará seus dados de sono e overtraining para fornecer insights personalizados
                    </p>
                    <Button 
                      onClick={handleAnalyze}
                      className="w-full"
                    >
                      Iniciar Análise
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="glass-card border-glass-border">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                  <div>
                    <h3 className="font-semibold text-foreground">Analisando...</h3>
                    <p className="text-muted-foreground text-sm">
                      A IA está processando seus dados. Isso pode levar alguns segundos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="glass-card border-red-200 bg-red-50/50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="text-red-600">
                    <h3 className="font-semibold">Erro na Análise</h3>
                    <p className="text-sm mt-2">{error}</p>
                  </div>
                  <Button 
                    onClick={handleAnalyze}
                    variant="outline"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {analysis && (
            <div className="space-y-4">
              <Card className="glass-card border-glass-border">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {formatAnalysis(analysis.analysis)}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center pt-4 border-t border-glass-border">
                <div className="text-sm text-muted-foreground">
                  Análise gerada em {new Date(analysis.analyzedAt).toLocaleString('pt-BR')}
                </div>
                
                <Button
                  onClick={handleSaveFeedback}
                  disabled={saving || saved}
                  variant={saved ? "default" : "outline"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar em Meus Feedbacks'}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};