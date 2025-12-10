import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Activity, Bike, Waves, Dumbbell } from 'lucide-react';

interface SportSelectionStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const SPORTS = [
  {
    id: 'running',
    label: 'Corrida',
    description: 'Planos de 5K até Maratona baseados em ritmo e frequência cardíaca',
    icon: Activity,
  },
  {
    id: 'cycling',
    label: 'Ciclismo',
    description: 'Planos baseados em potência (FTP), TSS e zonas de treino',
    icon: Bike,
  },
  {
    id: 'swimming',
    label: 'Natação',
    description: 'Planos baseados em CSS, técnica e zonas de treino em piscina',
    icon: Waves,
  },
  {
    id: 'strength',
    label: 'Força',
    description: 'Treino complementar para prevenção de lesões e performance',
    icon: Dumbbell,
  },
] as const;

export function SportSelectionStep({ wizardData, updateWizardData }: SportSelectionStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Escolha o esporte para o qual deseja criar um plano de treino personalizado
      </p>

      <RadioGroup 
        value={wizardData.sportType} 
        onValueChange={(value) => updateWizardData({ sportType: value as 'running' | 'cycling' | 'swimming' | 'strength' })}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {SPORTS.map((sport) => {
          const Icon = sport.icon;
          const isSelected = wizardData.sportType === sport.id;
          const isStrength = sport.id === 'strength';
          
          return (
            <Card 
              key={sport.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ sportType: sport.id as 'running' | 'cycling' | 'swimming' | 'strength' })}
            >
              <CardContent className="p-4 flex items-center space-x-4">
                <RadioGroupItem value={sport.id} id={sport.id} />
                <div className="flex-1">
                  <Label htmlFor={sport.id} className="flex items-center space-x-3 cursor-pointer">
                    <Icon className="h-6 w-6 text-primary" />
                    <div>
                      <div className="font-semibold text-lg flex items-center gap-2">
                        {sport.label}
                        {isStrength && (
                          <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full">
                            Complementar
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {sport.description}
                      </div>
                    </div>
                  </Label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>

      {wizardData.sportType === 'strength' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400">
          <strong>Nota:</strong> O treino de força é complementar e será sincronizado com seu plano de treino aeróbico existente (corrida, ciclismo ou natação).
        </div>
      )}
    </div>
  );
}