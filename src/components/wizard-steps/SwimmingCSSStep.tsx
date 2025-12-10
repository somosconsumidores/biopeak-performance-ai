import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Calculator, Clock, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SwimmingCSSStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

// Calculate CSS from 400m and 200m times
function calculateCSS(time400m: string, time200m: string): number | undefined {
  const parseTime = (time: string): number | undefined => {
    const parts = time.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1]; // MM:SS to seconds
    }
    return undefined;
  };

  const t400 = parseTime(time400m);
  const t200 = parseTime(time200m);

  if (t400 && t200 && t400 > t200) {
    // CSS = (400m - 200m distance) / (T400 - T200 time)
    // Speed in m/s, then convert to seconds per 100m
    const speedMs = 200 / (t400 - t200);
    const secondsPer100m = 100 / speedMs;
    return Math.round(secondsPer100m);
  }
  return undefined;
}

function formatCSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}/100m`;
}

export function SwimmingCSSStep({ wizardData, updateWizardData }: SwimmingCSSStepProps) {
  const [mode, setMode] = useState<'calculate' | 'estimate'>('calculate');

  const handleTimeChange = (field: 'time400m' | 'time200m', value: string) => {
    const updates: Partial<TrainingPlanWizardData> = { [field]: value };
    
    // Recalculate CSS if both times are present
    const t400 = field === 'time400m' ? value : wizardData.time400m;
    const t200 = field === 'time200m' ? value : wizardData.time200m;
    
    if (t400 && t200) {
      const css = calculateCSS(t400, t200);
      if (css) {
        updates.cssSecondsPerHundred = css;
        updates.hasCssTest = true;
      }
    }
    
    updateWizardData(updates);
  };

  const handleEstimateCSS = (seconds: number) => {
    updateWizardData({
      cssSecondsPerHundred: seconds,
      hasCssTest: false,
    });
  };

  // CSS estimates based on level
  const levelEstimates: Record<string, number> = {
    beginner: 165, // 2:45/100m
    intermediate: 120, // 2:00/100m
    advanced: 95, // 1:35/100m
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground text-center">
          Vamos definir seu CSS (Critical Swim Speed)
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>O CSS é equivalente ao limiar de lactato na natação. É a velocidade máxima que você consegue manter por um período prolongado.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as 'calculate' | 'estimate')}
        className="flex justify-center gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="calculate" id="calculate" />
          <Label htmlFor="calculate" className="cursor-pointer">Calcular com teste</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="estimate" id="estimate" />
          <Label htmlFor="estimate" className="cursor-pointer">Usar estimativa</Label>
        </div>
      </RadioGroup>

      {mode === 'calculate' ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Calculator className="h-5 w-5" />
              <span className="font-medium">Teste T400/T200</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Faça um aquecimento de 400m, depois nade 400m no melhor tempo possível. 
              Descanse 10-15 minutos e nade 200m no melhor tempo possível.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time400m">Tempo 400m (MM:SS)</Label>
                <Input
                  id="time400m"
                  placeholder="07:30"
                  value={wizardData.time400m || ''}
                  onChange={(e) => handleTimeChange('time400m', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time200m">Tempo 200m (MM:SS)</Label>
                <Input
                  id="time200m"
                  placeholder="03:30"
                  value={wizardData.time200m || ''}
                  onChange={(e) => handleTimeChange('time200m', e.target.value)}
                />
              </div>
            </div>

            {wizardData.cssSecondsPerHundred && wizardData.hasCssTest && (
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Seu CSS calculado:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCSS(wizardData.cssSecondsPerHundred)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Estimativa baseada no nível</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Selecione a estimativa mais próxima do seu ritmo confortável em treinos longos:
            </p>

            <RadioGroup
              value={wizardData.cssSecondsPerHundred?.toString() || ''}
              onValueChange={(v) => handleEstimateCSS(parseInt(v, 10))}
              className="space-y-3"
            >
              {[
                { seconds: 180, label: '3:00/100m - Iniciante' },
                { seconds: 150, label: '2:30/100m - Iniciante/Intermediário' },
                { seconds: 120, label: '2:00/100m - Intermediário' },
                { seconds: 105, label: '1:45/100m - Intermediário/Avançado' },
                { seconds: 90, label: '1:30/100m - Avançado' },
                { seconds: 75, label: '1:15/100m - Elite' },
              ].map((opt) => (
                <div
                  key={opt.seconds}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    wizardData.cssSecondsPerHundred === opt.seconds
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleEstimateCSS(opt.seconds)}
                >
                  <RadioGroupItem value={opt.seconds.toString()} id={`css-${opt.seconds}`} />
                  <Label htmlFor={`css-${opt.seconds}`} className="cursor-pointer flex-1">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
