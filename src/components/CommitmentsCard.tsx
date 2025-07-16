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
            <Target className="h-5 w-5 text-primary" />
            <span>Compromissos de Melhoria</span>
          </div>
          {commitments.length > 0 && (
            <Badge variant="secondary">{commitments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {commitments.length === 0 ? (
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Nenhum compromisso ativo</h3>
            <p className="text-sm text-muted-foreground">
              Vá para Insights e aplique recomendações da IA para começar sua jornada de melhoria
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {commitments.slice(0, 3).map((commitment) => (
              <div key={commitment.id} className="p-4 glass-card rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{commitment.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {commitment.description}
                    </p>
                  </div>
                  <Badge 
                    variant={commitment.priority === 'high' ? 'destructive' : 'secondary'}
                    className="ml-2"
                  >
                    {commitment.priority === 'high' ? 'Alta' : 'Média'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Aplicado {formatDistanceToNow(new Date(commitment.applied_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsCompleted(commitment.id)}
                    className="h-7 px-3 text-xs"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Concluir
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