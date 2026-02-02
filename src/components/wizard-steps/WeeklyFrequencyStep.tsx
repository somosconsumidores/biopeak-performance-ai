import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Calendar, Minus, Plus, Activity } from 'lucide-react';

interface WeeklyFrequencyStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const FREQUENCY_RECOMMENDATIONS = {
  'Beginner': { min: 2, max: 3, recommended: 3 },
  'Intermediate': { min: 3, max: 4, recommended: 4 },
  'Advanced': { min: 4, max: 6, recommended: 5 },
  'Elite': { min: 5, max: 7, recommended: 6 },
};

// Minimum frequency requirements by goal
const GOAL_MIN_FREQUENCY: Record<string, number> = {
  'marathon': 5,
  '42k': 5,
};

export function WeeklyFrequencyStep({ wizardData, updateWizardData }: WeeklyFrequencyStepProps) {
  const recommendation = FREQUENCY_RECOMMENDATIONS[wizardData.athleteLevel];
  const goalMinFrequency = GOAL_MIN_FREQUENCY[wizardData.goal] || 1;
  const effectiveMin = Math.max(goalMinFrequency, 1);
  const isMarathon = wizardData.goal === 'marathon' || wizardData.goal === '42k';
  
  const handleFrequencyChange = (newFrequency: number) => {
    const clampedFrequency = Math.max(effectiveMin, Math.min(7, newFrequency));
    updateWizardData({ weeklyFrequency: clampedFrequency });
  };

  const frequencyOptions = [
    { value: 2, label: '2x por semana', description: 'Mínimo para manter forma' },
    { value: 3, label: '3x por semana', description: 'Ideal para iniciantes' },
    { value: 4, label: '4x por semana', description: 'Bom para progressão' },
    { value: 5, label: '5x por semana', description: 'Para corredores dedicados' },
    { value: 6, label: '6x por semana', description: 'Alto volume de treino' },
    { value: 7, label: '7x por semana', description: 'Máximo dedicação' },
  ];

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Frequência Semanal</h3>
          <p className="text-sm text-muted-foreground">
            Quantos dias por semana você quer treinar?
          </p>
        </div>
      </div>

      {/* Marathon minimum requirement warning */}
      {isMarathon && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-amber-800 dark:text-amber-200">
              Requisito para Maratona
            </span>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            Planos de maratona exigem no mínimo 5 treinos por semana para garantir volume adequado de preparação.
          </p>
        </div>
      )}

      {/* Recommendation based on level */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Recomendação para {wizardData.athleteLevel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {isMarathon ? Math.max(5, recommendation.recommended) : recommendation.recommended}x por semana
          </Badge>
          <span className="text-sm text-muted-foreground">
            (Mínimo {isMarathon ? 5 : recommendation.min}x, máximo {recommendation.max}x)
          </span>
        </div>
      </div>

      {/* Frequency selector */}
      <div className="max-w-sm mx-auto space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleFrequencyChange(wizardData.weeklyFrequency - 1)}
            disabled={wizardData.weeklyFrequency <= effectiveMin}
          >
            <Minus className="h-4 w-4" />
          </Button>
          
          <div className="text-center min-w-[120px]">
            <div className="text-3xl font-bold text-primary">{wizardData.weeklyFrequency}</div>
            <div className="text-sm text-muted-foreground">treinos/semana</div>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleFrequencyChange(wizardData.weeklyFrequency + 1)}
            disabled={wizardData.weeklyFrequency >= 7}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick select buttons */}
        <div className="grid grid-cols-3 gap-2">
          {frequencyOptions.map((option) => (
            <Button
              key={option.value}
              variant={wizardData.weeklyFrequency === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleFrequencyChange(option.value)}
              className="text-xs"
            >
              {option.value}x
            </Button>
          ))}
        </div>
      </div>

      {/* Selected frequency description */}
      {frequencyOptions.find(opt => opt.value === wizardData.weeklyFrequency) && (
        <Card className="max-w-md mx-auto">
          <CardContent className="p-4 text-center">
            <div className="font-medium text-foreground mb-1">
              {frequencyOptions.find(opt => opt.value === wizardData.weeklyFrequency)?.label}
            </div>
            <div className="text-sm text-muted-foreground">
              {frequencyOptions.find(opt => opt.value === wizardData.weeklyFrequency)?.description}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional info */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Dicas importantes
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Sempre inclua pelo menos 1 dia de descanso completo</li>
            <li>• Qualidade é mais importante que quantidade</li>
            <li>• Você pode ajustar a frequência durante o plano</li>
            <li>• Considere seu tempo disponível e compromissos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}