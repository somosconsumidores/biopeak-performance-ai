import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Activity, Bike } from 'lucide-react';

interface SportSelectionStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function SportSelectionStep({ wizardData, updateWizardData }: SportSelectionStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Escolha o esporte para o qual deseja criar um plano de treino personalizado
      </p>

      <RadioGroup 
        value={wizardData.sportType} 
        onValueChange={(value) => updateWizardData({ sportType: value as 'running' | 'cycling' })}
        className="space-y-4"
      >
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            wizardData.sportType === 'running' 
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateWizardData({ sportType: 'running' })}
        >
          <CardContent className="p-6 flex items-center space-x-4">
            <RadioGroupItem value="running" id="running" />
            <div className="flex-1">
              <Label htmlFor="running" className="flex items-center space-x-3 cursor-pointer">
                <Activity className="h-6 w-6 text-primary" />
                <div>
                  <div className="font-semibold text-lg">Corrida</div>
                  <div className="text-sm text-muted-foreground">
                    Planos de 5K até Maratona baseados em ritmo e frequência cardíaca
                  </div>
                </div>
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            wizardData.sportType === 'cycling' 
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateWizardData({ sportType: 'cycling' })}
        >
          <CardContent className="p-6 flex items-center space-x-4">
            <RadioGroupItem value="cycling" id="cycling" />
            <div className="flex-1">
              <Label htmlFor="cycling" className="flex items-center space-x-3 cursor-pointer">
                <Bike className="h-6 w-6 text-primary" />
                <div>
                  <div className="font-semibold text-lg">Ciclismo</div>
                  <div className="text-sm text-muted-foreground">
                    Planos baseados em potência (FTP), TSS e zonas de treino
                  </div>
                </div>
              </Label>
            </div>
          </CardContent>
        </Card>
      </RadioGroup>
    </div>
  );
}