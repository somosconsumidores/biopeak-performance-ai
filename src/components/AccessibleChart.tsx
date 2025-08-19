import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
  description?: string;
}

interface AccessibleChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
  type: 'line' | 'bar' | 'pie' | 'area';
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  children: React.ReactNode; // O gráfico real (Recharts, etc.)
  className?: string;
  summary?: string;
  showDataTable?: boolean;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus
};

const TREND_COLORS = {
  up: 'text-green-500',
  down: 'text-red-500',
  stable: 'text-blue-500'
};

const TREND_LABELS = {
  up: 'Tendência de alta',
  down: 'Tendência de baixa',
  stable: 'Tendência estável'
};

export const AccessibleChart: React.FC<AccessibleChartProps> = ({
  title,
  description,
  data,
  type,
  trend,
  trendValue,
  children,
  className,
  summary,
  showDataTable = false
}) => {
  const [showTable, setShowTable] = React.useState(false);
  const TrendIcon = trend ? TREND_ICONS[trend] : null;
  
  // Gerar ID único para acessibilidade
  const chartId = React.useId();
  const tableId = React.useId();
  
  // Calcular estatísticas básicas
  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  
  // Gerar descrição acessível
  const getAccessibleDescription = () => {
    let desc = `Gráfico ${type === 'line' ? 'de linha' : type === 'bar' ? 'de barras' : type === 'pie' ? 'de pizza' : 'de área'} mostrando ${title.toLowerCase()}.`;
    
    if (description) {
      desc += ` ${description}`;
    }
    
    if (summary) {
      desc += ` ${summary}`;
    } else {
      desc += ` Contém ${data.length} pontos de dados. Valor máximo: ${max.toFixed(1)}, mínimo: ${min.toFixed(1)}, média: ${average.toFixed(1)}.`;
    }
    
    if (trend && trendValue) {
      desc += ` ${TREND_LABELS[trend]} com variação de ${trendValue}.`;
    }
    
    return desc;
  };

  return (
    <Card className={cn("glass-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              {title}
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
          
          {/* Indicadores de tendência e acessibilidade */}
          <div className="flex items-center gap-2">
            {trend && TrendIcon && (
              <Badge 
                variant="outline" 
                className={cn("gap-1", TREND_COLORS[trend])}
                aria-label={`${TREND_LABELS[trend]}${trendValue ? `: ${trendValue}` : ''}`}
              >
                <TrendIcon className="h-3 w-3" />
                {trendValue}
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTable(!showTable)}
              className="h-8 w-8 p-0"
              aria-label={showTable ? "Ocultar tabela de dados" : "Mostrar tabela de dados"}
              aria-expanded={showTable}
              aria-controls={tableId}
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Gráfico principal */}
        <div 
          role="img" 
          aria-labelledby={chartId}
          aria-describedby={`${chartId}-desc`}
          className="relative"
        >
          <span id={chartId} className="sr-only">{title}</span>
          <span id={`${chartId}-desc`} className="sr-only">
            {getAccessibleDescription()}
          </span>
          {children}
        </div>
        
        {/* Tabela de dados acessível */}
        {showTable && (
          <div 
            id={tableId}
            className="mt-4 overflow-hidden rounded-lg border border-glass-border"
            role="region"
            aria-label="Dados do gráfico em formato de tabela"
          >
            <div className="bg-muted/50 px-4 py-2 border-b border-glass-border">
              <h4 className="font-medium text-sm">Dados do Gráfico</h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-right p-3 font-medium">Valor</th>
                    {data.some(d => d.description) && (
                      <th className="text-left p-3 font-medium">Descrição</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr 
                      key={index} 
                      className="border-t border-glass-border/50 hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {item.color && (
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: item.color }}
                              aria-hidden="true"
                            />
                          )}
                          {item.name}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono">
                        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                      </td>
                      {data.some(d => d.description) && (
                        <td className="p-3 text-muted-foreground">
                          {item.description || '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Resumo estatístico */}
            <div className="bg-muted/30 px-4 py-3 border-t border-glass-border text-xs text-muted-foreground">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="font-medium">Máximo:</span> {max.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Mínimo:</span> {min.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Média:</span> {average.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessibleChart;