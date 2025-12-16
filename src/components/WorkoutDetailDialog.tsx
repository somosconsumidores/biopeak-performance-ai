import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingWorkout, TrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { MapPin, Clock, Timer, Heart, Target, Calendar, FileText, CheckCircle, PlayCircle, HelpCircle, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useState } from 'react';
import { ExerciseExplanationDialog } from './ExerciseExplanationDialog';
import { extractExercisesFromDescription, findExercise, ExerciseInfo } from '@/data/strengthExercises';
import { RescheduleWorkoutDialog } from './RescheduleWorkoutDialog';
import { useActiveTrainingPlans } from '@/hooks/useActiveTrainingPlans';
import { useToast } from '@/hooks/use-toast';

interface WorkoutDetailDialogProps {
  workout: TrainingWorkout | null;
  open: boolean;
  onClose: () => void;
  sportType?: string;
}

export function WorkoutDetailDialog({ workout, open, onClose, sportType = 'running' }: WorkoutDetailDialogProps) {
  const { markWorkoutCompleted, markWorkoutPlanned } = useActiveTrainingPlan();
  const { allPlans, workouts, rescheduleWorkout } = useActiveTrainingPlans();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseInfo | null>(null);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);

  const handleExerciseClick = (exerciseName: string) => {
    const exercise = findExercise(exerciseName);
    if (exercise) {
      setSelectedExercise(exercise);
      setExerciseDialogOpen(true);
    }
  };

  if (!workout) return null;

  const getWorkoutTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      // Running
      'easy': 'bg-green-100 text-green-800 border-green-200',
      'long_run': 'bg-purple-100 text-purple-800 border-purple-200',
      'tempo': 'bg-orange-100 text-orange-800 border-orange-200',
      'interval': 'bg-red-100 text-red-800 border-red-200',
      'recovery': 'bg-gray-100 text-gray-800 border-gray-200',
      'rest': 'bg-gray-100 text-gray-800 border-gray-200',
      // Cycling
      'endurance': 'bg-blue-100 text-blue-800 border-blue-200',
      'sweet_spot': 'bg-orange-100 text-orange-800 border-orange-200',
      'threshold': 'bg-red-100 text-red-800 border-red-200',
      'vo2max': 'bg-purple-100 text-purple-800 border-purple-200',
      'over_under': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'neuromuscular': 'bg-pink-100 text-pink-800 border-pink-200',
      'high_cadence': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'low_cadence': 'bg-amber-100 text-amber-800 border-amber-200',
      'long_endurance': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'long_brick': 'bg-violet-100 text-violet-800 border-violet-200',
      'event_simulation': 'bg-rose-100 text-rose-800 border-rose-200',
      'strength_endurance': 'bg-stone-100 text-stone-800 border-stone-200',
    };
    return colors[type] || 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getWorkoutTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      // Running
      'easy': 'Corrida Leve',
      'long_run': 'Corrida Longa',
      'tempo': 'Corrida Tempo',
      'interval': 'Intervalado',
      'recovery': 'Recuperação',
      'rest': 'Descanso',
      // Cycling
      'endurance': 'Endurance',
      'sweet_spot': 'Sweet Spot',
      'threshold': 'Limiar (FTP)',
      'vo2max': 'VO2 Max',
      'over_under': 'Over/Under',
      'neuromuscular': 'Sprint/Neuro',
      'high_cadence': 'Cadência Alta',
      'low_cadence': 'Força/Baixa Cadência',
      'long_endurance': 'Pedal Longo',
      'long_brick': 'Longo + Intensidade',
      'event_simulation': 'Simulação de Prova',
      'strength_endurance': 'Resistência Muscular',
    };
    return labels[type] || type;
  };

  const getHRZoneInfo = (zone: string) => {
    const zoneMap: Record<string, { name: string; intensity: string; paceRange: string; bpmRange: string; description: string }> = {
      '1': {
        name: 'Zona 1 - Recuperação',
        intensity: '50-60% FCM',
        paceRange: '7:00-8:00 min/km',
        bpmRange: '100-120 bpm',
        description: 'Ritmo muito leve para recuperação ativa'
      },
      '2': {
        name: 'Zona 2 - Aeróbica Leve',
        intensity: '60-70% FCM',
        paceRange: '6:00-7:00 min/km',
        bpmRange: '120-140 bpm',
        description: 'Ritmo confortável onde você consegue conversar facilmente'
      },
      '3': {
        name: 'Zona 3 - Aeróbica',
        intensity: '70-80% FCM',
        paceRange: '5:15-6:00 min/km',
        bpmRange: '140-160 bpm',
        description: 'Ritmo moderado, conversação um pouco difícil'
      },
      '4': {
        name: 'Zona 4 - Limiar',
        intensity: '80-90% FCM',
        paceRange: '4:30-5:15 min/km',
        bpmRange: '160-175 bpm',
        description: 'Ritmo desconfortável mas sustentável por 20-40 minutos'
      },
      '5': {
        name: 'Zona 5 - Anaeróbica',
        intensity: '90-100% FCM',
        paceRange: '3:45-4:30 min/km',
        bpmRange: '175-190 bpm',
        description: 'Esforço máximo, sustentável apenas por curtos períodos'
      }
    };
    return zoneMap[zone] || null;
  };

  const enhanceWorkoutDescription = (description: string, workout: TrainingWorkout): string => {
    let enhanced = description;

    // Adiciona informações sobre aquecimento
    if (description.toLowerCase().includes('aquecimento')) {
      enhanced = enhanced.replace(
        /aquecimento/gi,
        'Aquecimento (10-15 min em ritmo leve, Zona 1-2, ~7:00 min/km)'
      );
    }

    // Adiciona informações sobre ritmo limiar
    if (description.toLowerCase().includes('limiar') || description.toLowerCase().includes('tempo')) {
      const limiarInfo = ' (Zona 4: 4:30-5:15 min/km, 160-175 bpm)';
      if (!enhanced.includes(limiarInfo)) {
        enhanced = enhanced.replace(
          /(ritmo limiar|limiar|tempo)/gi,
          `$1${limiarInfo}`
        );
      }
    }

    // Adiciona informações sobre ritmo leve/fácil
    if (description.toLowerCase().includes('ritmo leve') || description.toLowerCase().includes('fácil')) {
      enhanced = enhanced.replace(
        /(ritmo leve|fácil)/gi,
        '$1 (Zona 2: 6:00-7:00 min/km, 120-140 bpm)'
      );
    }

    // Adiciona informações sobre intervalos
    if (description.toLowerCase().includes('interval') || description.toLowerCase().includes('tiros')) {
      enhanced = enhanced.replace(
        /(interval|tiros)/gi,
        '$1 (Zona 5: esforço máximo, 3:45-4:30 min/km)'
      );
    }

    // Adiciona informações sobre recuperação
    if (description.toLowerCase().includes('recuperação')) {
      enhanced = enhanced.replace(
        /recuperação/gi,
        'recuperação (Zona 1: muito leve, 7:00-8:00 min/km)'
      );
    }

    return enhanced;
  };

  const handleStatusToggle = async () => {
    setIsUpdating(true);
    try {
      if (workout.status === 'completed') {
        await markWorkoutPlanned(workout.id);
      } else {
        await markWorkoutCompleted(workout.id);
      }
    } catch (error) {
      console.error('Error updating workout status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReschedule = async (workoutId: string, newDate: string, strategy: 'swap' | 'replace' | 'push') => {
    try {
      await rescheduleWorkout(workoutId, newDate, strategy);
      toast({
        title: 'Treino reagendado',
        description: `Treino movido para ${format(parseISO(newDate), "dd 'de' MMMM", { locale: ptBR })}`,
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erro ao reagendar',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Find the plan for this workout
  const workoutPlan = allPlans.find(p => p.id === workout?.plan_id) || null;

  const hrZoneInfo = workout.target_hr_zone ? getHRZoneInfo(workout.target_hr_zone) : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{workout.title}</DialogTitle>
            <Badge 
              variant="outline" 
              className={getWorkoutTypeColor(workout.workout_type)}
            >
              {getWorkoutTypeLabel(workout.workout_type)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date and Status */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {format(parseISO(workout.workout_date), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })}
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={workout.status === 'completed' ? 'default' : 'secondary'}>
                {workout.status === 'completed' ? 'Completo' : 'Planejado'}
              </Badge>
              
              {/* Reschedule button - only for planned workouts */}
              {workout.status === 'planned' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRescheduleDialogOpen(true)}
                  className="whitespace-nowrap flex items-center gap-1.5"
                >
                  <CalendarDays className="h-4 w-4 flex-shrink-0" />
                  <span>Reagendar</span>
                </Button>
              )}
              
              <Button
                size="sm"
                variant={workout.status === 'completed' ? 'outline' : 'default'}
                onClick={handleStatusToggle}
                disabled={isUpdating}
                className="whitespace-nowrap flex items-center gap-1.5 min-w-[120px]"
              >
                {workout.status === 'completed' ? (
                  <>
                    <PlayCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Planejar</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Concluir</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Description */}
          {workout.description && (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-base mb-2 text-foreground">Descrição do Treino</h4>
                    {sportType === 'strength' ? (
                      <StrengthWorkoutDescription 
                        description={workout.description} 
                        onExerciseClick={handleExerciseClick}
                      />
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {enhanceWorkoutDescription(workout.description, workout)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workout Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workout.distance_meters && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Distância</p>
                      <p className="text-lg font-semibold">
                        {(workout.distance_meters / 1000).toFixed(1)} km
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {workout.duration_minutes && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-green-100">
                      <Timer className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duração</p>
                      <p className="text-lg font-semibold">
                        {workout.duration_minutes} minutos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {workout.target_pace_min_km && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-orange-100">
                      <Clock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pace Alvo</p>
                      <p className="text-lg font-semibold">
                        {Math.floor(workout.target_pace_min_km)}:{String(Math.round((workout.target_pace_min_km % 1) * 60)).padStart(2, '0')} min/km
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {workout.target_hr_zone && hrZoneInfo && (
              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-full bg-red-100 flex-shrink-0">
                      <Heart className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Zona de Frequência Cardíaca</p>
                        <p className="text-lg font-semibold text-foreground">
                          {hrZoneInfo.name}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Intensidade</p>
                          <Badge variant="outline" className="font-mono text-xs">
                            {hrZoneInfo.intensity}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Pace Esperado</p>
                          <Badge variant="outline" className="font-mono text-xs">
                            {hrZoneInfo.paceRange}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Faixa BPM</p>
                          <Badge variant="outline" className="font-mono text-xs">
                            {hrZoneInfo.bpmRange}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground italic pt-1">
                        {hrZoneInfo.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Training Guidelines */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start space-x-2">
                <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-2">Orientações do Treino</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {sportType === 'cycling' ? (
                      <>
                        {workout.workout_type === 'endurance' && (
                          <p>• Mantenha uma potência constante em Z2, ritmo confortável e sustentável</p>
                        )}
                        {workout.workout_type === 'sweet_spot' && (
                          <p>• Mantenha 88-93% do FTP, esforço moderado mas controlado</p>
                        )}
                        {workout.workout_type === 'threshold' && (
                          <p>• Esforço no limiar (95-105% FTP), desconfortável mas sustentável</p>
                        )}
                        {workout.workout_type === 'vo2max' && (
                          <p>• Intervalos intensos (106-120% FTP), recupere completamente entre séries</p>
                        )}
                        {workout.workout_type === 'over_under' && (
                          <p>• Alterne entre acima e abaixo do FTP, controle a respiração</p>
                        )}
                        {workout.workout_type === 'neuromuscular' && (
                          <p>• Sprints máximos e explosivos, recuperação completa entre séries</p>
                        )}
                        {workout.workout_type === 'high_cadence' && (
                          <p>• Mantenha cadência de 100-110 RPM, foque na técnica de pedalada</p>
                        )}
                        {workout.workout_type === 'low_cadence' && (
                          <p>• Cadência baixa (50-60 RPM), simule subidas, desenvolva força</p>
                        )}
                        {(workout.workout_type === 'long_endurance' || workout.workout_type === 'long_brick') && (
                          <p>• Foque na resistência aeróbica, mantenha ritmo constante e se alimente durante o treino</p>
                        )}
                        {workout.workout_type === 'event_simulation' && (
                          <p>• Simule o ritmo de prova, pratique alimentação e hidratação</p>
                        )}
                        {workout.workout_type === 'recovery' && (
                          <p>• Pedale muito leve em Z1, foque na recuperação ativa</p>
                        )}
                        
                        <p>• Faça aquecimento progressivo de 10-15 minutos antes de intervalos</p>
                        <p>• Mantenha cadência adequada (85-95 RPM para endurance)</p>
                        <p>• Hidrate-se regularmente, especialmente em treinos longos</p>
                      </>
                    ) : (
                      <>
                        {workout.workout_type === 'easy' && (
                          <p>• Mantenha um ritmo confortável onde você consegue manter uma conversa</p>
                        )}
                        {workout.workout_type === 'long_run' && (
                          <p>• Foque na resistência, mantenha um pace constante e confortável</p>
                        )}
                        {workout.workout_type === 'tempo' && (
                          <p>• Mantenha um esforço controlado, ligeiramente desconfortável mas sustentável</p>
                        )}
                        {workout.workout_type === 'interval' && (
                          <p>• Alterne entre esforços intensos e recuperação ativa</p>
                        )}
                        {workout.workout_type === 'recovery' && (
                          <p>• Corrida muito leve para recuperação ativa, foque no bem-estar</p>
                        )}
                        
                        {workout.target_hr_zone && (
                          <p>• Monitore sua frequência cardíaca e mantenha na zona {workout.target_hr_zone}</p>
                        )}
                        
                        <p>• Faça aquecimento adequado antes e alongamento após o treino</p>
                        <p>• Hidrate-se adequadamente durante e após o exercício</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exercise Explanation Dialog for Strength Workouts */}
        <ExerciseExplanationDialog
          exercise={selectedExercise}
          open={exerciseDialogOpen}
          onClose={() => setExerciseDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>

    {/* Reschedule Workout Dialog */}
    <RescheduleWorkoutDialog
      workout={workout}
      plan={workoutPlan as any}
      allWorkouts={workouts as any}
      open={rescheduleDialogOpen}
      onClose={() => setRescheduleDialogOpen(false)}
      onReschedule={handleReschedule}
    />
    </>
  );
}

// Component for rendering strength workout descriptions with clickable exercises
function StrengthWorkoutDescription({ 
  description, 
  onExerciseClick 
}: { 
  description: string; 
  onExerciseClick: (name: string) => void;
}) {
  const exerciseNames = extractExercisesFromDescription(description);
  // Convert exercise names to ExerciseInfo objects
  const exercises = exerciseNames
    .map(name => findExercise(name))
    .filter((ex): ex is ExerciseInfo => ex !== null);
  
  // Split description by lines and render each line with clickable exercises
  const lines = description.split('\n');
  
  return (
    <div className="text-sm text-foreground leading-relaxed space-y-2">
      {lines.map((line, lineIndex) => {
        // Check if this line contains any exercise
        const exercisesInLine = exercises.filter(ex => 
          line.toLowerCase().includes(ex.name.toLowerCase()) ||
          ex.alternativeNames.some(alt => line.toLowerCase().includes(alt.toLowerCase()))
        );
        
        if (exercisesInLine.length === 0) {
          return <p key={lineIndex}>{line}</p>;
        }
        
        // Render line with clickable exercise names
        let parts: (string | React.ReactNode)[] = [line];
        
        exercisesInLine.forEach((exercise, exIndex) => {
          const newParts: (string | React.ReactNode)[] = [];
          
          parts.forEach((part, partIndex) => {
            if (typeof part !== 'string') {
              newParts.push(part);
              return;
            }
            
            // Find all possible matches (main name or alternatives)
            const allNames = [exercise.name, ...exercise.alternativeNames];
            let matchFound = false;
            
            for (const name of allNames) {
              const regex = new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              const splitParts = part.split(regex);
              
              if (splitParts.length > 1) {
                splitParts.forEach((splitPart, splitIndex) => {
                  if (splitPart.toLowerCase() === name.toLowerCase()) {
                    newParts.push(
                      <button
                        key={`${lineIndex}-${exIndex}-${partIndex}-${splitIndex}`}
                        onClick={() => onExerciseClick(exercise.name)}
                        className="inline-flex items-center gap-0.5 text-primary hover:text-primary/80 underline underline-offset-2 decoration-dotted font-medium transition-colors"
                      >
                        {splitPart}
                        <HelpCircle className="h-3 w-3" />
                      </button>
                    );
                  } else if (splitPart) {
                    newParts.push(splitPart);
                  }
                });
                matchFound = true;
                break;
              }
            }
            
            if (!matchFound) {
              newParts.push(part);
            }
          });
          
          parts = newParts;
        });
        
        return <p key={lineIndex}>{parts}</p>;
      })}
      
      {exercises.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          Clique nos exercícios sublinhados para ver instruções detalhadas
        </p>
      )}
    </div>
  );
}