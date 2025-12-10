import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Calendar } from 'lucide-react';

interface StrengthFrequencyStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const FREQUENCY_OPTIONS = [
  {
    frequency: 2,
    title: '2x por semana',
    description: 'Ideal para manutenção ou quando treino aeróbico é prioridade',
    recommendation: 'Recomendado para iniciantes ou alto volume aeróbico',
  },
  {
    frequency: 3,
    title: '3x por semana',
    description: 'Ótimo para ganhos consistentes de força e performance',
    recommendation: 'Recomendado para ganhos de força significativos',
  },
] as const;

export function StrengthFrequencyStep({ wizardData, updateWizardData }: StrengthFrequencyStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Quantas vezes por semana você quer fazer treino de força?
      </p>

      <RadioGroup 
        value={wizardData.strengthFrequency?.toString() || ''} 
        onValueChange={(value) => updateWizardData({ strengthFrequency: parseInt(value, 10) as 2 | 3 })}
        className="space-y-4"
      >
        {FREQUENCY_OPTIONS.map((option) => {
          const isSelected = wizardData.strengthFrequency === option.frequency;
          
          return (
            <Card 
              key={option.frequency}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ strengthFrequency: option.frequency })}
            >
              <CardContent className="p-6 flex items-start space-x-4">
                <RadioGroupItem value={option.frequency.toString()} id={`freq-${option.frequency}`} className="mt-1" />
                <Calendar className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`freq-${option.frequency}`} className="cursor-pointer">
                    <div className="font-semibold text-lg">{option.title}</div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                    <p className="text-xs text-primary/70 mt-2">{option.recommendation}</p>
                  </Label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <strong>Importante:</strong> Os treinos de força serão programados em dias que não conflitem 
        com seus treinos aeróbicos mais intensos, priorizando dias de descanso ou treinos leves.
      </div>
    </div>
  );
}
