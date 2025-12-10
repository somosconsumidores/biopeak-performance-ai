import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData, SWIMMING_GOALS } from '@/hooks/useTrainingPlanWizard';
import { Activity, Scale, Medal, Waves, Trophy, Target, Heart } from 'lucide-react';

interface SwimmingGoalSelectionStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Activity,
  Scale,
  Medal,
  Waves,
  Trophy,
  Target,
  Heart,
};

export function SwimmingGoalSelectionStep({ wizardData, updateWizardData }: SwimmingGoalSelectionStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Escolha o objetivo principal do seu plano de natação
      </p>

      <RadioGroup 
        value={wizardData.goal} 
        onValueChange={(value) => updateWizardData({ goal: value })}
        className="grid grid-cols-1 gap-3"
      >
        {SWIMMING_GOALS.map((goal) => {
          const Icon = ICON_MAP[goal.icon] || Activity;
          const isSelected = wizardData.goal === goal.id;
          
          return (
            <Card 
              key={goal.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ goal: goal.id })}
            >
              <CardContent className="p-4 flex items-center space-x-4">
                <RadioGroupItem value={goal.id} id={goal.id} />
                <Label htmlFor={goal.id} className="flex items-center space-x-3 cursor-pointer flex-1">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-medium">{goal.label}</span>
                </Label>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>
    </div>
  );
}
