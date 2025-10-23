import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Clock, Minus, Plus, Target } from 'lucide-react';
import { addWeeks, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PlanDurationStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const DURATION_RECOMMENDATIONS = {
  'general_fitness': { weeks: 12, label: 'Condicionamento geral' },
  'weight_loss': { weeks: 16, label: 'Perda de peso sustentável' },
  '5k': { weeks: 8, label: 'Preparação para 5K' },
  '10k': { weeks: 12, label: 'Preparação para 10K' },
  'half_marathon': { weeks: 16, label: 'Preparação para meia maratona' },
  'marathon': { weeks: 20, label: 'Preparação para maratona' },
  'improve_times': { weeks: 12, label: 'Melhoria de performance' },
  'return_running': { weeks: 10, label: 'Retorno gradual' },
  'maintenance': { weeks: 12, label: 'Manutenção da forma' },
};

const PRESET_DURATIONS = [
  { weeks: 4, label: '1 mês', description: 'Plano curto e intensivo' },
  { weeks: 8, label: '2 meses', description: 'Ideal para objetivos específicos' },
  { weeks: 12, label: '3 meses', description: 'Duração clássica e efetiva' },
  { weeks: 16, label: '4 meses', description: 'Transformação completa' },
  { weeks: 20, label: '5 meses', description: 'Preparação para grandes desafios' },
  { weeks: 24, label: '6 meses', description: 'Mudança de lifestyle completa' },
];

export function PlanDurationStep({ wizardData, updateWizardData }: PlanDurationStepProps) {
  const recommendation = DURATION_RECOMMENDATIONS[wizardData.goal as keyof typeof DURATION_RECOMMENDATIONS];
  
  const handleDurationChange = (newDuration: number) => {
    const clampedDuration = Math.max(4, Math.min(52, newDuration));
    updateWizardData({ planDurationWeeks: clampedDuration });
  };

  const endDate = wizardData.startDate ? addWeeks(wizardData.startDate, wizardData.planDurationWeeks) : null;

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Duração do Plano</h3>
          <p className="text-sm text-muted-foreground">
            Por quantas semanas você quer seguir este plano de treino?
          </p>
        </div>
      </div>

      {/* Recommendation based on goal */}
      {recommendation && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Recomendação para seu objetivo</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {recommendation.weeks} semanas
            </Badge>
            <span className="text-sm text-muted-foreground">
              {recommendation.label}
            </span>
          </div>
        </div>
      )}

      {/* Duration selector */}
      <div className="max-w-sm mx-auto space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDurationChange(wizardData.planDurationWeeks - 1)}
            disabled={wizardData.planDurationWeeks <= 4}
          >
            <Minus className="h-4 w-4" />
          </Button>
          
          <div className="text-center min-w-[120px]">
            <div className="text-3xl font-bold text-primary">{wizardData.planDurationWeeks}</div>
            <div className="text-sm text-muted-foreground">semanas</div>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDurationChange(wizardData.planDurationWeeks + 1)}
            disabled={wizardData.planDurationWeeks >= 52}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* End date display */}
        {endDate && (
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <div className="text-sm text-muted-foreground">Término previsto</div>
              <div className="font-medium text-foreground">
                {format(endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Preset duration options */}
      <div className="max-w-md mx-auto space-y-3">
        <Label className="text-sm font-medium">Opções rápidas</Label>
        <div className="grid grid-cols-2 gap-3">
          {PRESET_DURATIONS.map((preset) => {
            const isSelected = wizardData.planDurationWeeks === preset.weeks;
            const isRecommended = recommendation && preset.weeks === recommendation.weeks;
            
            return (
              <Card 
                key={preset.weeks}
                className={`cursor-pointer transition-all hover:shadow-md relative ${
                  isSelected 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                } ${isRecommended ? 'border-green-200 dark:border-green-800' : ''}`}
                onClick={() => handleDurationChange(preset.weeks)}
              >
                {isRecommended && (
                  <Badge 
                    variant="outline" 
                    className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                  >
                    Recomendado
                  </Badge>
                )}
                <CardContent className="p-3 text-center">
                  <div className="font-medium text-foreground">
                    {preset.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {preset.description}
                  </div>
                  <div className="text-xs text-primary font-medium mt-1">
                    {preset.weeks} semanas
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Additional information */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Considerações importantes
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Planos mais longos permitem progressão mais gradual</li>
            <li>• Resultados significativos geralmente aparecem após 8-12 semanas</li>
            <li>• Você pode estender ou renovar o plano após o término</li>
            <li>• Planos muito curtos podem ser muito intensos para iniciantes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}