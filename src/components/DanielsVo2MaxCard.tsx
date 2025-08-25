import { Card } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useDanielsVo2Max } from '@/hooks/useDanielsVo2Max';

export default function DanielsVo2MaxCard() {
  const { currentVo2Max, bestVo2Max, trend, change, bestActivity, loading, error } = useDanielsVo2Max();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">VO₂ Max (Daniels)</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">VO₂ Max (Daniels)</h3>
        </div>
        <p className="text-sm text-muted-foreground">Erro ao carregar dados: {error}</p>
      </Card>
    );
  }

  if (!currentVo2Max && !bestVo2Max) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">VO₂ Max (Daniels)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma corrida encontrada para calcular VO₂ Max usando a fórmula de Daniels.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Necessário corridas com distância mínima de 800m.
        </p>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTrendText = () => {
    if (!change) return null;
    
    const absChange = Math.abs(change);
    switch (trend) {
      case 'up':
        return `+${absChange.toFixed(1)} ml/kg/min`;
      case 'down':
        return `-${absChange.toFixed(1)} ml/kg/min`;
      case 'stable':
        return 'Estável';
      default:
        return null;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">VO₂ Max (Daniels)</h3>
      </div>

      <div className="space-y-4">
        {/* Current VO2 Max */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold text-primary">
              {currentVo2Max?.toFixed(1) || '--'}
            </span>
            <span className="text-sm text-muted-foreground">ml/kg/min</span>
            {getTrendIcon()}
          </div>
          
          {getTrendText() && (
            <p className="text-sm text-muted-foreground">
              {getTrendText()} nos últimos 30 dias
            </p>
          )}
          
          {!currentVo2Max && bestVo2Max && (
            <p className="text-xs text-muted-foreground">
              Sem corridas nos últimos 30 dias
            </p>
          )}
        </div>

        {/* Best VO2 Max */}
        {bestVo2Max && (
          <div className="pt-3 border-t border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Melhor VO₂ Max:</span>
              <span className="text-sm font-semibold text-primary">
                {bestVo2Max.toFixed(1)} ml/kg/min
              </span>
            </div>
            
            {bestActivity && (
              <div className="text-xs text-muted-foreground">
                <p>
                  {(bestActivity.distance / 1000).toFixed(1)}km em {Math.floor(bestActivity.time)}:{String(Math.round((bestActivity.time % 1) * 60)).padStart(2, '0')}
                </p>
                <p>{new Date(bestActivity.date).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Calculado usando a fórmula de Jack Daniels baseada na velocidade de corrida.
          </p>
        </div>
      </div>
    </Card>
  );
}