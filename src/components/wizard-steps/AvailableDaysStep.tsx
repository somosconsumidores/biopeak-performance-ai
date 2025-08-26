import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Calendar, AlertCircle } from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Segunda-feira', short: 'SEG' },
  { id: 'tuesday', label: 'Terça-feira', short: 'TER' },
  { id: 'wednesday', label: 'Quarta-feira', short: 'QUA' },
  { id: 'thursday', label: 'Quinta-feira', short: 'QUI' },
  { id: 'friday', label: 'Sexta-feira', short: 'SEX' },
  { id: 'saturday', label: 'Sábado', short: 'SÁB' },
  { id: 'sunday', label: 'Domingo', short: 'DOM' },
];

interface AvailableDaysStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function AvailableDaysStep({ wizardData, updateWizardData }: AvailableDaysStepProps) {
  const handleDayToggle = (dayId: string, checked: boolean) => {
    const newAvailableDays = checked
      ? [...wizardData.availableDays, dayId]
      : wizardData.availableDays.filter(id => id !== dayId);
    
    updateWizardData({ availableDays: newAvailableDays });
  };

  const isInsufficient = wizardData.availableDays.length < wizardData.weeklyFrequency;
  const selectedCount = wizardData.availableDays.length;

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Dias Disponíveis</h3>
          <p className="text-sm text-muted-foreground">
            Selecione os dias da semana em que você pode treinar
          </p>
        </div>
      </div>

      {/* Requirement info */}
      <div className={`p-4 rounded-lg border ${
        isInsufficient 
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
          : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
      }`}>
        <div className="flex items-center gap-2">
          {isInsufficient ? (
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              isInsufficient 
                ? 'text-amber-800 dark:text-amber-200'
                : 'text-green-800 dark:text-green-200'
            }`}>
              {isInsufficient 
                ? `Selecione pelo menos ${wizardData.weeklyFrequency} dias`
                : `${selectedCount} dias selecionados`
              }
            </p>
            <p className={`text-xs ${
              isInsufficient 
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              Para {wizardData.weeklyFrequency} treinos por semana, você precisa de pelo menos {wizardData.weeklyFrequency} dias disponíveis
            </p>
          </div>
        </div>
      </div>

      {/* Days selection */}
      <div className="max-w-md mx-auto space-y-3">
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = wizardData.availableDays.includes(day.id);
          return (
            <Card 
              key={day.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => handleDayToggle(day.id, !isSelected)}
            >
              <CardContent className="flex items-center space-x-3 p-4">
                <Checkbox
                  id={day.id}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleDayToggle(day.id, !!checked)}
                />
                <Label htmlFor={day.id} className="cursor-pointer flex-1 flex items-center justify-between">
                  <span className="font-medium text-foreground">{day.label}</span>
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                    {day.short}
                  </span>
                </Label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick select options */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">Seleção rápida</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateWizardData({ availableDays: ['monday', 'wednesday', 'friday'] })}
              className="text-xs p-2 rounded bg-background hover:bg-muted/50 transition-colors"
            >
              Seg/Qua/Sex
            </button>
            <button
              onClick={() => updateWizardData({ availableDays: ['tuesday', 'thursday', 'saturday'] })}
              className="text-xs p-2 rounded bg-background hover:bg-muted/50 transition-colors"
            >
              Ter/Qui/Sáb
            </button>
            <button
              onClick={() => updateWizardData({ availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] })}
              className="text-xs p-2 rounded bg-background hover:bg-muted/50 transition-colors"
            >
              Dias de semana
            </button>
            <button
              onClick={() => updateWizardData({ availableDays: ['saturday', 'sunday'] })}
              className="text-xs p-2 rounded bg-background hover:bg-muted/50 transition-colors"
            >
              Fins de semana
            </button>
          </div>
        </div>
      </div>

      {/* Additional tips */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Dicas para escolher os dias
          </h4>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <li>• Deixe pelo menos 1 dia de descanso entre treinos intensos</li>
            <li>• Reserve o fim de semana para treinos mais longos</li>
            <li>• Considere sua rotina de trabalho e compromissos</li>
            <li>• Você pode ajustar durante o plano se necessário</li>
          </ul>
        </div>
      </div>
    </div>
  );
}