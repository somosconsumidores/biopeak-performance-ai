import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { User, Users, Award } from 'lucide-react';

const SWIMMING_LEVELS = [
  {
    id: 'beginner',
    title: 'Iniciante',
    description: 'Consigo nadar 50-200m contínuos com técnica básica',
    icon: User,
    cssEstimate: '2:30-3:00/100m',
  },
  {
    id: 'intermediate',
    title: 'Intermediário',
    description: 'Nado 1000m+ contínuos, domino crawl e costas',
    icon: Users,
    cssEstimate: '1:45-2:15/100m',
  },
  {
    id: 'advanced',
    title: 'Avançado',
    description: 'Nado 2000m+ com técnica refinada, treino regular',
    icon: Award,
    cssEstimate: '1:20-1:45/100m',
  },
] as const;

interface SwimmingLevelStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function SwimmingLevelStep({ wizardData, updateWizardData }: SwimmingLevelStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Qual é o seu nível atual na natação?
      </p>

      <RadioGroup 
        value={wizardData.swimmingLevel || ''} 
        onValueChange={(value) => updateWizardData({ swimmingLevel: value as 'beginner' | 'intermediate' | 'advanced' })}
        className="space-y-4"
      >
        {SWIMMING_LEVELS.map((level) => {
          const Icon = level.icon;
          const isSelected = wizardData.swimmingLevel === level.id;
          
          return (
            <Card 
              key={level.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ swimmingLevel: level.id })}
            >
              <CardContent className="p-4 flex items-start space-x-4">
                <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={level.id} className="cursor-pointer">
                    <div className="flex items-center space-x-3 mb-1">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{level.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{level.description}</p>
                    <p className="text-xs text-primary/70 mt-1">CSS estimado: {level.cssEstimate}</p>
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
