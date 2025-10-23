import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Target, Timer, Trophy, Info, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useAthleteAnalysis } from '@/hooks/useAthleteAnalysis';
import { validateRaceTime, TimeValidation } from '@/utils/raceTimeValidation';
import { PaceStepper } from '@/components/ui/pace-stepper';

interface RaceGoalStepProps {
  wizardData: TrainingPlanWizardData;
  onUpdate: (data: Partial<TrainingPlanWizardData>) => void;
}

export function RaceGoalStep({ wizardData, onUpdate }: RaceGoalStepProps) {
  const { raceEstimates, loading: analysisLoading } = useAthleteAnalysis();
  
  // Helper para obter distância em km
  const getDistanceInKm = (goal: string): number => {
    switch (goal) {
      case '5k': return 5;
      case '10k': return 10;
      case 'half_marathon':
      case '21k': return 21.097;
      case 'marathon':
      case '42k': return 42.195;
      default: return 10;
    }
  };
  
  // Configurações de limites por distância (estilo Zepp Coach)
  const getTimeConfig = () => {
    switch (wizardData.goal) {
      case '5k':
        return { 
          distance: '5 km',
          distanceKm: 5,
          min: 15,      // 15:00 min
          max: 45,      // 45:00 min
          step: 0.5,    // 30 segundos
          format: 'MM:SS' as const,
          default: 30,  // 30:00 min
        };
      case '10k':
        return { 
          distance: '10 km',
          distanceKm: 10,
          min: 30,      // 30:00 min
          max: 90,      // 1:30 h
          step: 1,      // 1 minuto
          format: 'MM:SS' as const,
          default: 50,  // 50:00 min
        };
      case 'half_marathon':
      case '21k':
        return { 
          distance: '21 km',
          distanceKm: 21.097,
          min: 75,      // 1:15 h
          max: 240,     // 4:00 h
          step: 5,      // 5 minutos
          format: 'H:MM' as const,
          default: 120, // 2:00 h
        };
      case 'marathon':
      case '42k':
        return { 
          distance: '42 km',
          distanceKm: 42.195,
          min: 150,     // 2:30 h
          max: 480,     // 8:00 h
          step: 5,      // 5 minutos
          format: 'H:MM' as const,
          default: 240, // 4:00 h
        };
      default:
        return { 
          distance: 'prova',
          distanceKm: 10,
          min: 30,
          max: 120,
          step: 5,
          format: 'H:MM' as const,
          default: 60,
        };
    }
  };

  const timeConfig = getTimeConfig();
  
  // Inicializar com valor padrão se não houver meta definida
  useEffect(() => {
    if (!wizardData.goalTargetTimeMinutes) {
      // Usar estimativa histórica se disponível, senão usar default
      let initialValue = timeConfig.default;
      
      switch (wizardData.goal) {
        case '5k':
          initialValue = raceEstimates.k5?.seconds ? raceEstimates.k5.seconds / 60 : timeConfig.default;
          break;
        case '10k':
          initialValue = raceEstimates.k10?.seconds ? raceEstimates.k10.seconds / 60 : timeConfig.default;
          break;
        case 'half_marathon':
        case '21k':
          initialValue = raceEstimates.k21?.seconds ? raceEstimates.k21.seconds / 60 : timeConfig.default;
          break;
        case 'marathon':
        case '42k':
          initialValue = raceEstimates.k42?.seconds ? raceEstimates.k42.seconds / 60 : timeConfig.default;
          break;
      }
      
      // Garantir que está dentro dos limites
      initialValue = Math.max(timeConfig.min, Math.min(timeConfig.max, initialValue));
      onUpdate({ goalTargetTimeMinutes: initialValue });
    }
  }, [wizardData.goal, raceEstimates]);

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
            Defina um tempo objetivo para sua {timeConfig.distance} (opcional)
          </p>
        </div>
      </div>

      {/* Goal input com TimeSpinner */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Tempo Objetivo para {timeConfig.distance}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaceStepper
            value={wizardData.goalTargetTimeMinutes || timeConfig.default}
            onChange={(minutes) => onUpdate({ goalTargetTimeMinutes: minutes })}
            min={timeConfig.min}
            max={timeConfig.max}
            step={timeConfig.step}
            distance={timeConfig.distanceKm}
            format={timeConfig.format}
            label={timeConfig.distance}
          />

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