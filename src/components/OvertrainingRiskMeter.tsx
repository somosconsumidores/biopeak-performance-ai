import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';

interface OvertrainingRisk {
  score: number;
  level: 'baixo' | 'moderado' | 'alto';
  factors: string[];
}

interface OvertrainingRiskMeterProps {
  risk?: OvertrainingRisk | null;
}

export const OvertrainingRiskMeter = ({ risk }: OvertrainingRiskMeterProps) => {
  if (!risk) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Risco de Overtraining
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Dados insuficientes para análise
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'baixo': return { bg: 'bg-green-500', text: 'text-green-400', icon: CheckCircle };
      case 'moderado': return { bg: 'bg-yellow-500', text: 'text-yellow-400', icon: AlertTriangle };
      case 'alto': return { bg: 'bg-red-500', text: 'text-red-400', icon: AlertTriangle };
      default: return { bg: 'bg-gray-500', text: 'text-gray-400', icon: ShieldAlert };
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'baixo': return 'Risco Baixo';
      case 'moderado': return 'Risco Moderado';
      case 'alto': return 'Risco Alto';
      default: return 'Não avaliado';
    }
  };

  const riskInfo = getRiskColor(risk.level);
  const IconComponent = riskInfo.icon;
  
  // Calculate the angle for the meter (0 to 180 degrees)
  const meterAngle = (risk.score / 100) * 180;
  
  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Risco de Overtraining
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Risk Meter */}
          <div className="relative w-40 h-20 mx-auto">
            <svg className="w-40 h-20" viewBox="0 0 200 100">
              {/* Background arc */}
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
                strokeLinecap="round"
              />
              
              {/* Colored zones */}
              <defs>
                <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="url(#riskGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                opacity={0.7}
              />
              
              {/* Needle */}
              <g transform={`rotate(${meterAngle - 90} 100 80)`}>
                <line
                  x1="100"
                  y1="80"
                  x2="100"
                  y2="25"
                  stroke={riskInfo.text.replace('text-', '')}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle
                  cx="100"
                  cy="80"
                  r="4"
                  fill={riskInfo.text.replace('text-', '')}
                />
              </g>
            </svg>
            
            {/* Score display */}
            <div className="absolute inset-0 flex items-end justify-center pb-2">
              <div className="text-center">
                <div className="text-2xl font-bold">{risk.score}</div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
            </div>
          </div>

          {/* Risk Level */}
          <div className="text-center space-y-2">
            <Badge className={`${riskInfo.bg} text-white border-0`}>
              <IconComponent className="h-3 w-3 mr-1" />
              {getRiskLabel(risk.level)}
            </Badge>
          </div>

          {/* Risk Factors */}
          {risk.factors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Fatores de Risco:</h4>
              <div className="space-y-1">
                {risk.factors.map((factor, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${riskInfo.bg}`} />
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="text-xs text-muted-foreground">
              {risk.level === 'baixo' && 'Continue com o planejamento atual. Monitore sua recuperação.'}
              {risk.level === 'moderado' && 'Considere adicionar mais dias de recuperação ou reduzir a intensidade.'}
              {risk.level === 'alto' && 'Recomendamos uma semana de recuperação ativa ou descanso completo.'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};