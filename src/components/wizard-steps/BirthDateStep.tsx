import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { CalendarIcon, User, CheckCircle2 } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BirthDateStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function BirthDateStep({ wizardData, updateWizardData }: BirthDateStepProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const age = wizardData.birthDate ? differenceInYears(new Date(), wizardData.birthDate) : null;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      updateWizardData({ birthDate: date });
      setCalendarOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Data de Nascimento</h3>
          <p className="text-sm text-muted-foreground">
            Sua idade nos ajuda a calcular zonas de frequência cardíaca e personalizar o plano
          </p>
        </div>
      </div>

      {/* Date picker */}
      <div className="max-w-sm mx-auto space-y-4">
        <Label className="text-base font-medium">Selecione sua data de nascimento</Label>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-12",
                !wizardData.birthDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {wizardData.birthDate ? (
                format(wizardData.birthDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              ) : (
                <span>Selecione uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={wizardData.birthDate}
              onSelect={handleDateSelect}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Age display */}
        {age && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Idade: {age} anos
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Sua FC máxima estimada é {208 - (0.7 * age)} bpm (fórmula Tanaka)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional info */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Por que precisamos desta informação?
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Calcular sua frequência cardíaca máxima</li>
            <li>• Definir zonas de treino adequadas à sua idade</li>
            <li>• Ajustar intensidade dos exercícios</li>
            <li>• Personalizar progressão do treinamento</li>
          </ul>
        </div>
      </div>
    </div>
  );
}