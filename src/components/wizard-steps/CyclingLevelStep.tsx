import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { User, Users, Award } from 'lucide-react';

const CYCLING_LEVELS = [
  {
    id: 'beginner',
    title: 'Iniciante',
    description: '1-2 treinos por semana, sem medidor de potência',
    icon: User,
    details: '~150-250W FTP estimado'
  },
  {
    id: 'intermediate',
    title: 'Intermediário',
    description: '3-4 treinos por semana, familiarizado com treinos estruturados',
    icon: Users,
    details: '~250-320W FTP estimado'
  },
  {
    id: 'advanced',
    title: 'Avançado',
    description: '5+ treinos por semana, usa medidor de potência',
    icon: Award,
    details: '~320W+ FTP estimado'
  }
];

interface CyclingLevelStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function CyclingLevelStep({ wizardData, updateWizardData }: CyclingLevelStepProps) {
  return (
    <div className="space-y-6">
      <RadioGroup
        value={wizardData.cyclingLevel}
        onValueChange={(value) => updateWizardData({ cyclingLevel: value as 'beginner' | 'intermediate' | 'advanced' })}
        className="space-y-4"
      >
        {CYCLING_LEVELS.map((level) => {
          const Icon = level.icon;
          return (
            <Card
              key={level.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                wizardData.cyclingLevel === level.id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ cyclingLevel: level.id as 'beginner' | 'intermediate' | 'advanced' })}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={level.id} className="flex items-center space-x-3 cursor-pointer">
                      <Icon className="h-6 w-6 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{level.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {level.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 font-mono">
                          {level.details}
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>
    </div>
  );
}