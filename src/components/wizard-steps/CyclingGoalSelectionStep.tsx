import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { 
  Activity, 
  Scale, 
  Mountain, 
  TrendingUp, 
  RotateCcw, 
  Trophy, 
  Heart 
} from 'lucide-react';

const CYCLING_GOALS = [
  { 
    id: 'cycling_general_fitness', 
    label: 'Condicionamento Geral',
    description: '🚴 Melhorar saúde e resistência cardiovascular',
    icon: Activity
  },
  { 
    id: 'cycling_weight_loss', 
    label: 'Perda de Peso',
    description: '⚖️ Queimar calorias e reduzir peso corporal',
    icon: Scale
  },
  { 
    id: 'cycling_gran_fondo', 
    label: 'Gran Fondo / 100km',
    description: '⛰️ Preparação para provas de longa distância',
    icon: Mountain
  },
  { 
    id: 'cycling_improve_power', 
    label: 'Melhorar Potência e Tempo Médio',
    description: '⏱️ Aumentar FTP e performance geral',
    icon: TrendingUp
  },
  { 
    id: 'cycling_return', 
    label: 'Retorno ao Pedal',
    description: '🔁 Voltar a pedalar após um período parado',
    icon: RotateCcw
  },
  { 
    id: 'cycling_triathlon', 
    label: 'Triathlon / Duathlon',
    description: '🏆 Preparação específica para multiesportes',
    icon: Trophy
  },
  { 
    id: 'cycling_maintenance', 
    label: 'Manutenção e Saúde',
    description: '💪 Manter o condicionamento físico atual',
    icon: Heart
  },
];

interface CyclingGoalSelectionStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function CyclingGoalSelectionStep({ wizardData, updateWizardData }: CyclingGoalSelectionStepProps) {
  return (
    <div className="space-y-6">
      <RadioGroup 
        value={wizardData.goal} 
        onValueChange={(value) => updateWizardData({ goal: value })}
        className="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {CYCLING_GOALS.map((goal) => {
            const Icon = goal.icon;
            return (
              <Card 
                key={goal.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  wizardData.goal === goal.id 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => updateWizardData({ goal: goal.id })}
              >
                <CardContent className="flex items-start space-x-3 p-4">
                  <RadioGroupItem value={goal.id} id={goal.id} className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor={goal.id}
                      className="flex items-start space-x-3 cursor-pointer"
                    >
                      <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-foreground">{goal.label}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {goal.description}
                        </div>
                      </div>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </RadioGroup>

      {/* Custom description */}
      <div className="space-y-3">
        <Label htmlFor="goal-description" className="text-sm font-medium">
          Descrição adicional (opcional)
        </Label>
        <Textarea
          id="goal-description"
          placeholder="Ex: Quero fazer um Gran Fondo de 100km em março de 2025"
          value={wizardData.targetEventDescription || ''}
          onChange={(e) => updateWizardData({ targetEventDescription: e.target.value })}
          className="min-h-[80px] resize-none"
        />
      </div>
    </div>
  );
}