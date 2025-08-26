import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { CalendarIcon, Trophy, X, AlertCircle } from 'lucide-react';
import { format, differenceInWeeks, isBefore, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RaceDateStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function RaceDateStep({ wizardData, updateWizardData }: RaceDateStepProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const handleRaceToggle = (hasRace: boolean) => {
    updateWizardData({ 
      hasRaceDate: hasRace,
      raceDate: hasRace ? wizardData.raceDate : undefined
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      updateWizardData({ raceDate: date });
      setShowCalendar(false);
    }
  };

  const planEndDate = wizardData.startDate ? addWeeks(wizardData.startDate, wizardData.planDurationWeeks) : null;
  const isRaceDateValid = wizardData.raceDate && planEndDate ? 
    !isBefore(wizardData.raceDate, planEndDate) : true;
  
  const weeksUntilRace = wizardData.raceDate && wizardData.startDate ? 
    differenceInWeeks(wizardData.raceDate, wizardData.startDate) : null;

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Data da Prova</h3>
          <p className="text-sm text-muted-foreground">
            Você tem alguma prova ou evento específico como objetivo?
          </p>
        </div>
      </div>

      {/* Has race toggle */}
      <div className="max-w-md mx-auto">
        <RadioGroup 
          value={wizardData.hasRaceDate ? 'yes' : 'no'} 
          onValueChange={(value) => handleRaceToggle(value === 'yes')}
          className="space-y-3"
        >
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              !wizardData.hasRaceDate 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => handleRaceToggle(false)}
          >
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="no" id="no-race" />
              <Label htmlFor="no-race" className="cursor-pointer flex-1">
                <div className="font-medium text-foreground">Não tenho prova específica</div>
                <div className="text-sm text-muted-foreground">
                  Quero treinar para melhorar meu condicionamento em geral
                </div>
              </Label>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              wizardData.hasRaceDate 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => handleRaceToggle(true)}
          >
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="yes" id="has-race" />
              <Label htmlFor="has-race" className="cursor-pointer flex-1">
                <div className="font-medium text-foreground">Sim, tenho uma prova em mente</div>
                <div className="text-sm text-muted-foreground">
                  Quero me preparar para um evento específico
                </div>
              </Label>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {/* Race date selection */}
      {wizardData.hasRaceDate && (
        <div className="max-w-md mx-auto space-y-4">
          <Label className="text-sm font-medium">Data da prova</Label>
          
          {/* Selected date display */}
          {wizardData.raceDate && (
            <Card className={`${isRaceDateValid ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">
                      {format(wizardData.raceDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(wizardData.raceDate, "EEEE", { locale: ptBR })}
                    </div>
                    {weeksUntilRace && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {weeksUntilRace} semanas para se preparar
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateWizardData({ raceDate: undefined })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Date validation warning */}
          {wizardData.raceDate && !isRaceDateValid && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Data da prova conflita com o plano
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    A prova deve ser após o término do plano ({planEndDate ? format(planEndDate, "dd/MM/yyyy") : 'data não definida'})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Calendar toggle */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {wizardData.raceDate ? 'Alterar data' : 'Selecionar data'}
            </Button>
          </div>

          {/* Calendar */}
          {showCalendar && (
            <Card className="p-4">
              <Calendar
                mode="single"
                selected={wizardData.raceDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto mx-auto")}
              />
            </Card>
          )}
        </div>
      )}

      {/* Additional information */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            {wizardData.hasRaceDate ? 'Preparação para prova' : 'Treino sem prova específica'}
          </h4>
          {wizardData.hasRaceDate ? (
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• O plano será personalizado para seu objetivo específico</li>
              <li>• Incluiremos tapering nas últimas semanas</li>
              <li>• Foco na distância e ritmo da sua prova</li>
              <li>• Simulações de prova durante o treinamento</li>
            </ul>
          ) : (
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Foco no desenvolvimento gradual e consistente</li>
              <li>• Variedade de treinos para condicionamento geral</li>
              <li>• Flexibilidade para ajustar objetivos durante o plano</li>
              <li>• Preparação para futuras provas quando decidir participar</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}