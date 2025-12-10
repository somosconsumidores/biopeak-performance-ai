import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Waves } from 'lucide-react';

interface PoolLengthStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const POOL_OPTIONS = [
  {
    length: 25,
    title: 'Piscina de 25 metros',
    description: 'Piscina curta - padrão para academias e clubes',
  },
  {
    length: 50,
    title: 'Piscina de 50 metros',
    description: 'Piscina olímpica - menos viradas, ritmo mais constante',
  },
] as const;

export function PoolLengthStep({ wizardData, updateWizardData }: PoolLengthStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Em qual tamanho de piscina você treina regularmente?
      </p>

      <RadioGroup 
        value={wizardData.poolLength?.toString() || ''} 
        onValueChange={(value) => updateWizardData({ poolLength: parseInt(value, 10) as 25 | 50 })}
        className="space-y-4"
      >
        {POOL_OPTIONS.map((pool) => {
          const isSelected = wizardData.poolLength === pool.length;
          
          return (
            <Card 
              key={pool.length}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ poolLength: pool.length })}
            >
              <CardContent className="p-6 flex items-center space-x-4">
                <RadioGroupItem value={pool.length.toString()} id={`pool-${pool.length}`} />
                <Waves className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <Label htmlFor={`pool-${pool.length}`} className="cursor-pointer">
                    <div className="font-semibold text-lg">{pool.title}</div>
                    <p className="text-sm text-muted-foreground">{pool.description}</p>
                  </Label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <strong>Dica:</strong> Se você alterna entre piscinas de 25m e 50m, escolha a que você usa com mais frequência. Os treinos serão adaptados para o tamanho selecionado.
      </div>
    </div>
  );
}
