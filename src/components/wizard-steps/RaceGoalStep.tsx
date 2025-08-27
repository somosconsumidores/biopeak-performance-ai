import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Target, Timer, Trophy, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RaceGoalStepProps {
  wizardData: TrainingPlanWizardData;
  onUpdate: (data: Partial<TrainingPlanWizardData>) => void;
}

export function RaceGoalStep({ wizardData, onUpdate }: RaceGoalStepProps) {
  const [timeInput, setTimeInput] = useState('');
  
  useEffect(() => {
    if (wizardData.goalTargetTimeMinutes) {
      const hours = Math.floor(wizardData.goalTargetTimeMinutes / 60);
      const minutes = wizardData.goalTargetTimeMinutes % 60;
      setTimeInput(`${hours}:${minutes.toString().padStart(2, '0')}`);
    }
  }, [wizardData.goalTargetTimeMinutes]);

  const handleTimeChange = (value: string) => {
    setTimeInput(value);
    
    // Parse time input (format: HH:MM or MM:SS)
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const [, first, second] = match;
      const firstNum = parseInt(first);
      const secondNum = parseInt(second);
      
      let totalMinutes: number;
      
      // If first number is > 60, assume it's minutes:seconds format
      if (firstNum > 60 || (firstNum <= 60 && secondNum < 60 && firstNum < 10)) {
        // Minutes:seconds format (e.g., 25:30 for 5K)
        totalMinutes = firstNum + (secondNum / 60);
      } else {
        // Hours:minutes format (e.g., 1:30 for half marathon)
        totalMinutes = (firstNum * 60) + secondNum;
      }
      
      onUpdate({ goalTargetTimeMinutes: Math.round(totalMinutes) });
    } else {
      onUpdate({ goalTargetTimeMinutes: undefined });
    }
  };

  const getDistanceInfo = () => {
    switch (wizardData.goal) {
      case '5k':
        return { distance: '5 km', example: '25:00 (25 minutos)', format: 'MM:SS' };
      case '10k':
        return { distance: '10 km', example: '50:00 (50 minutos)', format: 'MM:SS ou H:MM' };
      case 'half_marathon':
      case '21k':
        return { distance: '21 km', example: '1:45 (1h45min)', format: 'H:MM' };
      case 'marathon':
      case '42k':
        return { distance: '42 km', example: '3:30 (3h30min)', format: 'H:MM' };
      default:
        return { distance: 'prova', example: '1:30', format: 'H:MM' };
    }
  };

  const distanceInfo = getDistanceInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Meta da Prova</h3>
          <p className="text-sm text-muted-foreground">
            Defina um tempo objetivo para sua {distanceInfo.distance} (opcional)
          </p>
        </div>
      </div>

      {/* Goal input */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Tempo Objetivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-time">
              Tempo alvo para {distanceInfo.distance}
            </Label>
            <Input
              id="target-time"
              placeholder={`Ex: ${distanceInfo.example}`}
              value={timeInput}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="text-center font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground text-center">
              Formato: {distanceInfo.format}
            </p>
          </div>

          {wizardData.goalTargetTimeMinutes && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="font-medium">Meta definida:</span>
                <Badge variant="secondary">
                  {Math.floor(wizardData.goalTargetTimeMinutes / 60)}:{(wizardData.goalTargetTimeMinutes % 60).toString().padStart(2, '0')}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="glass-card bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Por que definir uma meta?
              </p>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Treinos personalizados para atingir seu objetivo</li>
                <li>• Paces específicos calculados automaticamente</li>
                <li>• Progressão estruturada rumo à meta</li>
                <li>• Simulações de prova durante o plano</li>
              </ul>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                Se não souber um tempo específico, nosso algoritmo calculará uma meta realista baseada no seu histórico.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}