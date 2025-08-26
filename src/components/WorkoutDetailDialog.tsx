import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { MapPin, Clock, Timer, Heart, Target, Calendar, FileText, CheckCircle, PlayCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

interface WorkoutDetailDialogProps {
  workout: TrainingWorkout | null;
  open: boolean;
  onClose: () => void;
}

export function WorkoutDetailDialog({ workout, open, onClose }: WorkoutDetailDialogProps) {
  const { markWorkoutCompleted, markWorkoutPlanned } = useActiveTrainingPlan();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!workout) return null;

  const getWorkoutTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'easy': 'bg-green-100 text-green-800 border-green-200',
      'long_run': 'bg-purple-100 text-purple-800 border-purple-200',
      'tempo': 'bg-orange-100 text-orange-800 border-orange-200',
      'interval': 'bg-red-100 text-red-800 border-red-200',
      'recovery': 'bg-gray-100 text-gray-800 border-gray-200',
      'rest': 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[type] || 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getWorkoutTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'easy': 'Corrida Leve',
      'long_run': 'Corrida Longa',
      'tempo': 'Corrida Tempo',
      'interval': 'Intervalado',
      'recovery': 'Recuperação',
      'rest': 'Descanso',
    };
    return labels[type] || type;
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

  return (
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {format(parseISO(workout.workout_date), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant={workout.status === 'completed' ? 'default' : 'secondary'}>
                {workout.status === 'completed' ? 'Completo' : 'Planejado'}
              </Badge>
              
              <Button
                size="sm"
                variant={workout.status === 'completed' ? 'outline' : 'default'}
                onClick={handleStatusToggle}
                disabled={isUpdating}
              >
                {workout.status === 'completed' ? (
                  <>
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Marcar como Planejado
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Marcar como Completo
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Description */}
          {workout.description && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm mb-1">Descrição do Treino</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {workout.description}
                    </p>
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

            {workout.target_hr_zone && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-red-100">
                      <Heart className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Zona FC</p>
                      <p className="text-lg font-semibold">
                        Zona {workout.target_hr_zone}
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}