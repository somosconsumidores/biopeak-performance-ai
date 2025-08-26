import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { CalendarIcon, Play, FastForward } from 'lucide-react';
import { format, addDays, addWeeks, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StartDateStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function StartDateStep({ wizardData, updateWizardData }: StartDateStepProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const quickStartOptions = [
    {
      label: 'Hoje',
      date: new Date(),
      description: 'Começar imediatamente',
      icon: Play
    },
    {
      label: 'Amanhã',
      date: addDays(new Date(), 1),
      description: 'Dar um tempo para se preparar',
      icon: FastForward
    },
    {
      label: 'Próxima semana',
      date: addWeeks(new Date(), 1),
      description: 'Começar na próxima segunda-feira',
      icon: CalendarIcon
    },
    {
      label: 'Em 2 semanas',
      date: addWeeks(new Date(), 2),
      description: 'Mais tempo para se organizar',
      icon: CalendarIcon
    },
  ];

  const formatSelectedDate = (date: Date) => {
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <CalendarIcon className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Data de Início</h3>
          <p className="text-sm text-muted-foreground">
            Quando você gostaria de começar seu plano de treino?
          </p>
        </div>
      </div>

      {/* Selected date display */}
      {wizardData.startDate && (
        <Card className="max-w-sm mx-auto bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold text-primary">
              {formatSelectedDate(wizardData.startDate)}
            </div>
            <div className="text-sm text-muted-foreground">
              {format(wizardData.startDate, "EEEE", { locale: ptBR })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick start options */}
      <div className="max-w-md mx-auto space-y-3">
        <Label className="text-sm font-medium">Opções rápidas</Label>
        <div className="grid gap-3">
          {quickStartOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = wizardData.startDate && 
              format(wizardData.startDate, 'yyyy-MM-dd') === format(option.date, 'yyyy-MM-dd');
            
            return (
              <Card 
                key={option.label}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => updateWizardData({ startDate: option.date })}
              >
                <CardContent className="flex items-center space-x-3 p-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(option.date, "dd/MM", { locale: ptBR })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Custom date picker */}
      <div className="max-w-md mx-auto">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Ou escolha uma data específica</Label>
          
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {showCalendar ? 'Fechar calendário' : 'Abrir calendário'}
            </Button>
          </div>

          {showCalendar && (
            <Card className="p-4">
              <Calendar
                mode="single"
                selected={wizardData.startDate}
                onSelect={(date) => {
                  if (date) {
                    updateWizardData({ startDate: date });
                    setShowCalendar(false);
                  }
                }}
                disabled={(date) => date < new Date()}
                initialFocus
                className="pointer-events-auto mx-auto"
              />
            </Card>
          )}
        </div>
      </div>

      {/* Additional tips */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Dicas para escolher a data
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Considere sua agenda e compromissos próximos</li>
            <li>• Começar na segunda-feira pode ser psicologicamente motivador</li>
            <li>• Evite períodos de muito estresse ou viagens</li>
            <li>• Você pode ajustar o plano se necessário após iniciar</li>
          </ul>
        </div>
      </div>
    </div>
  );
}