import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCommitments } from '@/hooks/useCommitments';
import { CheckCircle2, Target, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CommitmentsCard = () => {
  const { commitments, loading, error, markAsCompleted } = useCommitments();

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Compromissos de Melhoria</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Compromissos de Melhoria</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <span className="ml-2 text-sm text-muted-foreground">Erro ao carregar</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <span className="text-sm sm:text-base">Compromissos de Melhoria</span>
          </div>
          {commitments.length > 0 && (
            <Badge variant="secondary" className="text-xs">{commitments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {commitments.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <Target className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Nenhum compromisso ativo</h3>
            <p className="text-xs sm:text-sm text-muted-foreground px-4 leading-relaxed">
              Vá para Insights e aplique recomendações da IA para começar sua jornada de melhoria
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {commitments.slice(0, 3).map((commitment) => (
              <div key={commitment.id} className="p-3 sm:p-4 glass-card rounded-lg space-y-2 sm:space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs sm:text-sm leading-tight">{commitment.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {commitment.description}
                    </p>
                  </div>
                  <Badge 
                    variant={commitment.priority === 'high' ? 'destructive' : 'secondary'}
                    className="ml-2 text-xs flex-shrink-0"
                  >
                    {commitment.priority === 'high' ? 'Alta' : 'Média'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex-1 min-w-0">
                    Aplicado {formatDistanceToNow(new Date(commitment.applied_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsCompleted(commitment.id)}
                    className="h-6 sm:h-7 px-2 sm:px-3 text-xs flex-shrink-0"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Concluir</span>
                    <span className="sm:hidden">OK</span>
                  </Button>
                </div>
              </div>
            ))}
            
            {commitments.length > 3 && (
              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground">
                  +{commitments.length - 3} compromissos adicionais
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};