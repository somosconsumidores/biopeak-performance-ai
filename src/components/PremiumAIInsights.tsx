import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, RefreshCw } from 'lucide-react';

interface PremiumAIInsightsProps {
  onRefresh: () => Promise<void>;
}

export const PremiumAIInsights = ({ onRefresh }: PremiumAIInsightsProps) => {
  const mockInsights = [
    "Nos últimos 30 dias você aumentou seu volume em 18%.",
    "Seu pace médio melhorou de 6:05 para 5:50, mas a variabilidade do HR indica recuperação insuficiente.",
    "Sugestão: adicione 1 treino regenerativo extra na semana."
  ];

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Insights Premium da IA
          <Badge className="bg-gradient-primary text-white border-0 ml-auto">
            <Sparkles className="h-3 w-3 mr-1" />
            IA
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-2">
              {mockInsights.map((insight, index) => (
                <p key={index} className="text-sm leading-relaxed">
                  {insight}
                </p>
              ))}
            </div>
          </div>
          
          <Button onClick={onRefresh} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Gerar Novo Insight
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};