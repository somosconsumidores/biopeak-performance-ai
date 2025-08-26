import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { MapPin, Clock, AlertCircle } from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Segunda-feira' },
  { id: 'tuesday', label: 'Terça-feira' },
  { id: 'wednesday', label: 'Quarta-feira' },
  { id: 'thursday', label: 'Quinta-feira' },
  { id: 'friday', label: 'Sexta-feira' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
];

interface LongRunDayStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function LongRunDayStep({ wizardData, updateWizardData }: LongRunDayStepProps) {
  const availableDaysForLongRun = DAYS_OF_WEEK.filter(day => 
    wizardData.availableDays.includes(day.id)
  );

  const isCurrentSelectionValid = wizardData.availableDays.includes(wizardData.longRunDay);

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <MapPin className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Dia da Corrida Longa</h3>
          <p className="text-sm text-muted-foreground">
            Qual dia você prefere para fazer o treino mais longo da semana?
          </p>
        </div>
      </div>

      {/* Validation warning */}
      {!isCurrentSelectionValid && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Dia inválido selecionado
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                O dia da corrida longa deve estar entre seus dias disponíveis
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Day selection */}
      <div className="max-w-md mx-auto">
        <RadioGroup 
          value={wizardData.longRunDay} 
          onValueChange={(value) => updateWizardData({ longRunDay: value })}
          className="space-y-3"
        >
          {availableDaysForLongRun.map((day) => {
            const isRecommended = day.id === 'saturday' || day.id === 'sunday';
            return (
              <Card 
                key={day.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  wizardData.longRunDay === day.id 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                } ${isRecommended ? 'border-green-200 dark:border-green-800' : ''}`}
                onClick={() => updateWizardData({ longRunDay: day.id })}
              >
                <CardContent className="flex items-center space-x-3 p-4">
                  <RadioGroupItem value={day.id} id={day.id} />
                  <Label htmlFor={day.id} className="cursor-pointer flex-1 flex items-center justify-between">
                    <span className="font-medium text-foreground">{day.label}</span>
                    {isRecommended && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                        Recomendado
                      </span>
                    )}
                  </Label>
                </CardContent>
              </Card>
            );
          })}
        </RadioGroup>

        {availableDaysForLongRun.length === 0 && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Nenhum dia disponível
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Volte e selecione pelo menos um dia disponível para treinar
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Information about long runs */}
      <div className="max-w-md mx-auto space-y-4">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Por que o fim de semana é recomendado?
              </h4>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>• Mais tempo disponível para treinos longos</li>
                <li>• Melhor recuperação no dia seguinte</li>
                <li>• Menos pressa e estresse</li>
                <li>• Mais flexibilidade de horário</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            O que é a corrida longa?
          </h4>
          <p className="text-xs text-muted-foreground">
            É o treino mais longo da semana, fundamental para desenvolver resistência, 
            queimar gordura e preparar o corpo para distâncias maiores. Geralmente feito 
            em ritmo confortável e conversacional.
          </p>
        </div>
      </div>
    </div>
  );
}