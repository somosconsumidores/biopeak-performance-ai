import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Target, Timer, Trophy, Info, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAthleteAnalysis } from '@/hooks/useAthleteAnalysis';
import { validateRaceTime, TimeValidation } from '@/utils/raceTimeValidation';

interface RaceGoalStepProps {
  wizardData: TrainingPlanWizardData;
  onUpdate: (data: Partial<TrainingPlanWizardData>) => void;
}

export function RaceGoalStep({ wizardData, onUpdate }: RaceGoalStepProps) {
  const [timeInput, setTimeInput] = useState('');
  const { raceEstimates, loading: analysisLoading } = useAthleteAnalysis();
  
  useEffect(() => {
    if (wizardData.goalTargetTimeMinutes) {
      const hours = Math.floor(wizardData.goalTargetTimeMinutes / 60);
      const minutes = wizardData.goalTargetTimeMinutes % 60;
      setTimeInput(`${hours}:${minutes.toString().padStart(2, '0')}`);
    }
  }, [wizardData.goalTargetTimeMinutes]);

  const handleTimeChange = (value: string) => {
    setTimeInput(value);
    
    // Parse time input based on race distance
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const [, first, second] = match;
      const firstNum = parseInt(first);
      const secondNum = parseInt(second);
      
      let totalMinutes: number;
      
      // Determinar formato baseado na distância da prova
      const isShortDistance = ['5k', '10k'].includes(wizardData.goal || '');
      
      if (isShortDistance) {
        // Para 5k/10k: sempre interpretar como MM:SS
        totalMinutes = firstNum + (secondNum / 60);
      } else {
        // Para 21k/42k: sempre interpretar como H:MM
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
        return { distance: '5 km', example: '25:00 (vinte e cinco minutos)', format: 'MM:SS' };
      case '10k':
        return { distance: '10 km', example: '50:00 (cinquenta minutos)', format: 'MM:SS' };
      case 'half_marathon':
      case '21k':
        return { distance: '21 km', example: '1:45 (1 hora e 45 minutos)', format: 'H:MM' };
      case 'marathon':
      case '42k':
        return { distance: '42 km', example: '3:30 (3 horas e 30 minutos)', format: 'H:MM' };
      default:
        return { distance: 'prova', example: '1:30', format: 'H:MM' };
    }
  };

  const distanceInfo = getDistanceInfo();

  // Validação inteligente do tempo alvo usando utilitário compartilhado
  const timeValidation = useMemo((): TimeValidation | null => {
    if (!wizardData.goalTargetTimeMinutes) return null;

    // Mapear goal para distância em metros
    const distanceMap: Record<string, number> = {
      '5k': 5000,
      '10k': 10000,
      'half_marathon': 21097,
      '21k': 21097,
      'marathon': 42195,
      '42k': 42195,
    };

    const distanceMeters = distanceMap[wizardData.goal] || 10000;

    // Pegar a estimativa histórica baseada na distância
    let historicalTimeMinutes: number | undefined;
    switch (wizardData.goal) {
      case '5k':
        historicalTimeMinutes = raceEstimates.k5 ? raceEstimates.k5.seconds / 60 : undefined;
        break;
      case '10k':
        historicalTimeMinutes = raceEstimates.k10 ? raceEstimates.k10.seconds / 60 : undefined;
        break;
      case 'half_marathon':
      case '21k':
        historicalTimeMinutes = raceEstimates.k21 ? raceEstimates.k21.seconds / 60 : undefined;
        break;
      case 'marathon':
      case '42k':
        historicalTimeMinutes = raceEstimates.k42 ? raceEstimates.k42.seconds / 60 : undefined;
        break;
    }

    return validateRaceTime(
      wizardData.goalTargetTimeMinutes,
      distanceMeters,
      historicalTimeMinutes
    );
  }, [wizardData.goalTargetTimeMinutes, wizardData.goal, raceEstimates]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 DEBUG RaceGoalStep:', {
      goal: wizardData.goal,
      targetMinutes: wizardData.goalTargetTimeMinutes,
      raceEstimates,
      historicalK10: raceEstimates.k10?.seconds,
      timeValidation
    });
  }, [wizardData.goal, wizardData.goalTargetTimeMinutes, raceEstimates, timeValidation]);

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

          {/* Loading feedback */}
          {analysisLoading && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ⏳ Analisando seu histórico para validar a meta...
              </p>
            </div>
          )}

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

          {/* Validação inteligente do tempo */}
          {timeValidation && (
            <div
              className={`p-4 rounded-lg border-2 ${
                timeValidation.level === 'impossible'
                  ? 'bg-destructive/10 border-destructive'
                  : timeValidation.level === 'very_ambitious'
                  ? 'bg-orange-500/10 border-orange-500 dark:bg-orange-500/20'
                  : timeValidation.level === 'ambitious'
                  ? 'bg-yellow-500/10 border-yellow-500 dark:bg-yellow-500/20'
                  : 'bg-green-500/10 border-green-500 dark:bg-green-500/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                    timeValidation.level === 'impossible'
                      ? 'text-destructive'
                      : timeValidation.level === 'very_ambitious'
                      ? 'text-orange-600 dark:text-orange-400'
                      : timeValidation.level === 'ambitious'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                />
                <div className="space-y-1 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      timeValidation.level === 'impossible'
                        ? 'text-destructive'
                        : timeValidation.level === 'very_ambitious'
                        ? 'text-orange-900 dark:text-orange-100'
                        : timeValidation.level === 'ambitious'
                        ? 'text-yellow-900 dark:text-yellow-100'
                        : 'text-green-900 dark:text-green-100'
                    }`}
                  >
                     {timeValidation.level === 'impossible' && '⛔ Meta Impossível - BLOQUEADA'}
                    {timeValidation.level === 'very_ambitious' && '⚠️ Meta Muito Arriscada - BLOQUEADA'}
                    {timeValidation.level === 'ambitious' && '💪 Meta Desafiadora'}
                    {timeValidation.level === 'realistic' && '✅ Meta Realista'}
                  </p>
                  <p
                    className={`text-xs ${
                      timeValidation.level === 'impossible'
                        ? 'text-destructive/90'
                        : timeValidation.level === 'very_ambitious'
                        ? 'text-orange-800 dark:text-orange-200'
                        : timeValidation.level === 'ambitious'
                        ? 'text-yellow-800 dark:text-yellow-200'
                        : 'text-green-800 dark:text-green-200'
                    }`}
                  >
                    {timeValidation.message}
                  </p>
                </div>
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