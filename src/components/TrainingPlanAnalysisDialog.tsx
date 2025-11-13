import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, X } from 'lucide-react';
import { TrainingPlanAnalysisResult } from '@/hooks/useTrainingPlanAnalysis';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TrainingPlanAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  result: TrainingPlanAnalysisResult | null;
  loading: boolean;
  error: string | null;
}

export const TrainingPlanAnalysisDialog: React.FC<TrainingPlanAnalysisDialogProps> = ({
  open,
  onClose,
  result,
  loading,
  error
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Análise de Progresso
          </DialogTitle>
          <DialogDescription>
            {result && result.analysis ? (
              `Baseado em ${result.completedWorkouts} treino${result.completedWorkouts > 1 ? 's' : ''} concluído${result.completedWorkouts > 1 ? 's' : ''}`
            ) : (
              'Análise detalhada do seu progresso no plano de treino'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-pulse">
                <TrendingUp className="h-12 w-12 mx-auto text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Analisando seus treinos...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-destructive mb-1">Erro na Análise</h4>
                <p className="text-sm text-destructive/90">{error}</p>
              </div>
            </div>
          )}

          {result && !result.analysis && result.message && (
            <div className="bg-muted/50 border border-border rounded-lg p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{result.message}</p>
            </div>
          )}

          {result && result.analysis && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3 text-foreground" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props} />,
                    h4: ({node, ...props}) => <h4 className="text-base font-semibold mt-3 mb-2 text-foreground" {...props} />,
                    p: ({node, ...props}) => <p className="mb-3 text-sm leading-relaxed text-foreground" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-3 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-3 space-y-1" {...props} />,
                    li: ({node, ...props}) => <li className="text-sm text-foreground" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                    em: ({node, ...props}) => <em className="italic text-foreground" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 italic my-3 text-muted-foreground" {...props} />,
                    code: ({node, ...props}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
                  }}
                >
                  {result.analysis}
                </ReactMarkdown>
              </div>
              
              {result.totalWorkouts && (
                <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Progresso do Plano</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {result.completedWorkouts} / {result.totalWorkouts}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">treinos concluídos</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} variant="outline">
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
