import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { 
  Target, 
  Scale, 
  Trophy, 
  Timer, 
  Route, 
  Heart, 
  TrendingUp, 
  RotateCcw,
  Activity 
} from 'lucide-react';

const GOALS = [
  { 
    id: 'general_fitness', 
    label: 'Condicionamento Físico Geral',
    description: 'Melhorar saúde e resistência cardiovascular',
    icon: Heart
  },
  { 
    id: 'weight_loss', 
    label: 'Perda de Peso',
    description: 'Queimar calorias e reduzir peso corporal',
    icon: Scale
  },
  { 
    id: '5k', 
    label: 'Primeira Corrida de 5K',
    description: 'Completar seus primeiros 5 quilômetros',
    icon: Target
  },
  { 
    id: '10k', 
    label: 'Corrida de 10K',
    description: 'Treinar para uma corrida de 10 quilômetros',
    icon: Route
  },
  { 
    id: 'half_marathon', 
    label: 'Meia Maratona (21K)',
    description: 'Preparação para 21,1 quilômetros',
    icon: Trophy
  },
  { 
    id: 'marathon', 
    label: 'Maratona (42K)',
    description: 'O desafio completo de 42,2 quilômetros',
    icon: Trophy
  },
  { 
    id: 'improve_times', 
    label: 'Melhorar Tempos Atuais',
    description: 'Bater recordes pessoais e melhorar performance',
    icon: TrendingUp
  },
  { 
    id: 'return_running', 
    label: 'Retorno à Corrida',
    description: 'Voltar a correr após um período parado',
    icon: RotateCcw
  },
  { 
    id: 'maintenance', 
    label: 'Manutenção da Forma',
    description: 'Manter o condicionamento físico atual',
    icon: Activity
  },
];

interface GoalSelectionStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function GoalSelectionStep({ wizardData, updateWizardData }: GoalSelectionStepProps) {
  return (
    <div className="space-y-6">
      <RadioGroup 
        value={wizardData.goal} 
        onValueChange={(value) => updateWizardData({ goal: value })}
        className="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {GOALS.map((goal) => {
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

      {/* Custom goal description */}
      <div className="space-y-3">
        <Label htmlFor="goal-description" className="text-sm font-medium">
          Descrição adicional (opcional)
        </Label>
        <Textarea
          id="goal-description"
          placeholder="Descreva detalhes específicos do seu objetivo, como tempo desejado, data da prova, etc."
          value={wizardData.goalDescription || ''}
          onChange={(e) => updateWizardData({ goalDescription: e.target.value })}
          className="min-h-[80px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Ex: "Quero correr uma meia maratona em menos de 2h em março de 2024"
        </p>
      </div>
    </div>
  );
}