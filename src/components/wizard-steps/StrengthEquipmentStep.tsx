import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Building2, Home, User } from 'lucide-react';

interface StrengthEquipmentStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const EQUIPMENT_OPTIONS = [
  {
    id: 'full_gym',
    title: 'Academia Completa',
    description: 'Acesso a máquinas, barras, halteres, cabos e equipamentos variados',
    icon: Building2,
    examples: 'Leg press, supino, puxador, barras olímpicas, etc.',
  },
  {
    id: 'home_basic',
    title: 'Home Gym Básico',
    description: 'Halteres, elásticos, kettlebell e/ou alguns equipamentos em casa',
    icon: Home,
    examples: 'Halteres ajustáveis, elásticos, barra fixa, etc.',
  },
  {
    id: 'bodyweight',
    title: 'Apenas Peso Corporal',
    description: 'Treino calistênico sem equipamentos',
    icon: User,
    examples: 'Flexões, agachamentos, prancha, lunges, etc.',
  },
] as const;

export function StrengthEquipmentStep({ wizardData, updateWizardData }: StrengthEquipmentStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Quais equipamentos você tem disponíveis para o treino de força?
      </p>

      <RadioGroup 
        value={wizardData.strengthEquipment || ''} 
        onValueChange={(value) => updateWizardData({ strengthEquipment: value as 'full_gym' | 'home_basic' | 'bodyweight' })}
        className="space-y-4"
      >
        {EQUIPMENT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = wizardData.strengthEquipment === option.id;
          
          return (
            <Card 
              key={option.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ strengthEquipment: option.id as 'full_gym' | 'home_basic' | 'bodyweight' })}
            >
              <CardContent className="p-4 flex items-start space-x-4">
                <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                <Icon className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1">
                  <Label htmlFor={option.id} className="cursor-pointer">
                    <div className="font-semibold">{option.title}</div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 italic">
                      Ex: {option.examples}
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
