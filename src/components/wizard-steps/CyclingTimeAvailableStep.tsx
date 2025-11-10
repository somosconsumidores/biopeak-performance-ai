import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Clock } from 'lucide-react';

const TIME_OPTIONS = [2, 4, 6, 8, 10, 12, 15];

interface CyclingTimeAvailableStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function CyclingTimeAvailableStep({ wizardData, updateWizardData }: CyclingTimeAvailableStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Clock className="h-5 w-5" />
        <p className="text-sm">
          Quanto tempo por semana você tem disponível para treinar?
        </p>
      </div>

      <RadioGroup
        value={wizardData.availableHoursPerWeek?.toString()}
        onValueChange={(value) => updateWizardData({ 
          availableHoursPerWeek: parseInt(value) 
        })}
        className="space-y-3"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {TIME_OPTIONS.map(hours => (
            <Card 
              key={hours}
              className={`cursor-pointer transition-all hover:shadow-md ${
                wizardData.availableHoursPerWeek === hours 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ availableHoursPerWeek: hours })}
            >
              <CardContent className="p-4 text-center">
                <RadioGroupItem 
                  value={hours.toString()} 
                  id={`hours-${hours}`}
                  className="sr-only"
                />
                <Label 
                  htmlFor={`hours-${hours}`} 
                  className="cursor-pointer block"
                >
                  <div className="font-bold text-2xl text-primary">{hours}h</div>
                  <div className="text-xs text-muted-foreground mt-1">por semana</div>
                </Label>
              </CardContent>
            </Card>
          ))}
        </div>
      </RadioGroup>

      {wizardData.availableHoursPerWeek && (
        <div className="p-4 bg-muted/50 rounded-lg text-sm">
          <div className="font-medium mb-1">Distribuição sugerida:</div>
          <div className="text-muted-foreground">
            {wizardData.availableHoursPerWeek <= 4 && '2-3 treinos por semana, focados em qualidade'}
            {wizardData.availableHoursPerWeek > 4 && wizardData.availableHoursPerWeek <= 8 && '3-4 treinos por semana, mix de base e intensidade'}
            {wizardData.availableHoursPerWeek > 8 && '4-6 treinos por semana, desenvolvimento completo'}
          </div>
        </div>
      )}
    </div>
  );
}