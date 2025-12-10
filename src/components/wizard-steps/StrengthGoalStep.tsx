import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData, STRENGTH_GOALS } from '@/hooks/useTrainingPlanWizard';
import { Shield, TrendingUp, Dumbbell, Target } from 'lucide-react';

interface StrengthGoalStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Shield,
  TrendingUp,
  Dumbbell,
  Target,
};

const GOAL_DETAILS: Record<string, { description: string; focus: string }> = {
  strength_injury_prevention: {
    description: 'Fortaleça músculos estabilizadores e corrija desequilíbrios',
    focus: 'Exercícios unilaterais, propriocepção, mobilidade',
  },
  strength_performance: {
    description: 'Aumente força e potência para melhorar seu desempenho',
    focus: 'Força máxima, explosão, resistência muscular',
  },
  strength_general: {
    description: 'Desenvolva força equilibrada em todo o corpo',
    focus: 'Exercícios compostos, progressão gradual',
  },
  strength_core: {
    description: 'Fortaleça core e lombar para melhor postura e eficiência',
    focus: 'Prancha, rotação, anti-extensão, estabilidade',
  },
};

export function StrengthGoalStep({ wizardData, updateWizardData }: StrengthGoalStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Qual é o principal objetivo do seu treino de força?
      </p>

      <RadioGroup 
        value={wizardData.strengthGoal || ''} 
        onValueChange={(value) => updateWizardData({ strengthGoal: value as 'injury_prevention' | 'performance' | 'general' | 'core' })}
        className="space-y-4"
      >
        {STRENGTH_GOALS.map((goal) => {
          const Icon = ICON_MAP[goal.icon] || Dumbbell;
          const details = GOAL_DETAILS[goal.id];
          const isSelected = wizardData.strengthGoal === goal.id.replace('strength_', '');
          
          return (
            <Card 
              key={goal.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ strengthGoal: goal.id.replace('strength_', '') as 'injury_prevention' | 'performance' | 'general' | 'core' })}
            >
              <CardContent className="p-4 flex items-start space-x-4">
                <RadioGroupItem value={goal.id.replace('strength_', '')} id={goal.id} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={goal.id} className="cursor-pointer">
                    <div className="flex items-center space-x-2 mb-1">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{goal.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{details.description}</p>
                    <p className="text-xs text-primary/70 mt-1">
                      <strong>Foco:</strong> {details.focus}
                    </p>
                  </Label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>
    </div>
  );
}
