import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { useProfile } from '@/hooks/useProfile';
import { CalendarIcon, Ruler, Weight, Activity, CheckCircle2 } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BiometricsStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function BiometricsStep({ wizardData, updateWizardData }: BiometricsStepProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { profile } = useProfile();

  // Pre-fill from profile if available
  useEffect(() => {
    const updates: Partial<TrainingPlanWizardData> = {};
    if (profile?.height_cm && !wizardData.heightCm) {
      updates.heightCm = profile.height_cm;
    }
    if (profile?.weight_kg && !wizardData.weightKg) {
      updates.weightKg = profile.weight_kg;
    }
    if (profile?.birth_date && !wizardData.birthDate) {
      updates.birthDate = new Date(profile.birth_date);
    }
    if (Object.keys(updates).length > 0) {
      updateWizardData(updates);
    }
  }, [profile]);

  const age = wizardData.birthDate ? differenceInYears(new Date(), wizardData.birthDate) : null;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      updateWizardData({ birthDate: date });
      setCalendarOpen(false);
    }
  };

  // Calculate BMI
  const bmi = wizardData.heightCm && wizardData.weightKg
    ? (wizardData.weightKg / Math.pow(wizardData.heightCm / 100, 2)).toFixed(1)
    : null;

  const getBmiCategory = (bmiValue: number) => {
    if (bmiValue < 18.5) return 'Abaixo do peso';
    if (bmiValue < 25) return 'Peso normal';
    if (bmiValue < 30) return 'Sobrepeso';
    return 'Obesidade';
  };

  // Estimated max HR (Tanaka formula)
  const estimatedMaxHR = age ? Math.round(208 - 0.7 * age) : null;

  const allFilled = !!wizardData.birthDate && !!wizardData.heightCm && !!wizardData.weightKg;

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Activity className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Dados Biométricos</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Estas informações são essenciais para criarmos um plano personalizado — calculamos suas zonas de treino, taxa metabólica e intensidades ideais com base nestes dados.
          </p>
        </div>
      </div>

      <div className="max-w-sm mx-auto space-y-5">
        {/* Height */}
        <div className="space-y-2">
          <Label className="text-base font-medium flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" />
            Altura (cm)
          </Label>
          <Input
            type="number"
            min={100}
            max={250}
            placeholder="Ex: 175"
            value={wizardData.heightCm || ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              updateWizardData({ heightCm: val });
            }}
          />
        </div>

        {/* Weight */}
        <div className="space-y-2">
          <Label className="text-base font-medium flex items-center gap-2">
            <Weight className="h-4 w-4 text-primary" />
            Peso (kg)
          </Label>
          <Input
            type="number"
            min={30}
            max={300}
            step={0.1}
            placeholder="Ex: 70"
            value={wizardData.weightKg || ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              updateWizardData({ weightKg: val });
            }}
          />
        </div>

        {/* Birth date */}
        <div className="space-y-2">
          <Label className="text-base font-medium flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Data de Nascimento
          </Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-10",
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
                captionLayout="dropdown-buttons"
                fromYear={1900}
                toYear={new Date().getFullYear()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Calculated metrics */}
      {allFilled && (
        <div className="max-w-sm mx-auto space-y-3">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Dados completos!
              </p>
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 space-y-1 pl-7">
              {age && (
                <p>Idade: {age} anos</p>
              )}
              {estimatedMaxHR && (
                <p>FC máxima estimada: {estimatedMaxHR} bpm (Tanaka)</p>
              )}
              {bmi && (
                <p>IMC: {bmi} ({getBmiCategory(Number(bmi))})</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Why we need this */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Por que precisamos destas informações?
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Calcular sua frequência cardíaca máxima e zonas de treino</li>
            <li>• Estimar sua taxa metabólica basal (TMB)</li>
            <li>• Personalizar intensidades e volumes de treino</li>
            <li>• Criar um perfil nutricional adequado</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
