import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TrainingPlan, TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { ChevronLeft, ChevronRight, Clock, MapPin, Heart, Timer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyPlanViewProps {
  plan: TrainingPlan;
  workouts: TrainingWorkout[];
}

const DAYS_OF_WEEK = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];

export function WeeklyPlanView({ plan, workouts }: WeeklyPlanViewProps) {
  const { markWorkoutCompleted, markWorkoutPlanned } = useActiveTrainingPlan();
  const [currentPage, setCurrentPage] = useState(0);
  
  const workoutsPerPage = 7;
  const totalPages = Math.ceil(workouts.length / workoutsPerPage);
  const currentWorkouts = workouts
    .sort((a, b) => parseISO(a.workout_date).getTime() - parseISO(b.workout_date).getTime())
    .slice(currentPage * workoutsPerPage, (currentPage + 1) * workoutsPerPage);
  
  const handleWorkoutToggle = async (workout: TrainingWorkout, completed: boolean) => {
    try {
      if (completed) {
        await markWorkoutCompleted(workout.id);
      } else {
        await markWorkoutPlanned(workout.id);
      }
    } catch (error) {
      console.error('Error toggling workout:', error);
    }
  };

  const getWorkoutTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'easy': 'bg-green-100 text-green-800 border-green-200',
      'long_run': 'bg-blue-100 text-blue-800 border-blue-200',
      'tempo': 'bg-orange-100 text-orange-800 border-orange-200',
      'interval': 'bg-red-100 text-red-800 border-red-200',
      'recovery': 'bg-gray-100 text-gray-800 border-gray-200',
      'rest': 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Page Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Treinos Programados</h2>
          <p className="text-muted-foreground">
            {currentWorkouts.length} treinos desta página
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium px-3">
            {currentPage + 1} / {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Workouts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentWorkouts.map((workout) => (
          <Card key={workout.id} className={`${workout.status === 'completed' ? 'ring-1 ring-green-500/20' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {format(parseISO(workout.workout_date), 'dd/MM/yyyy')}
                </CardTitle>
                <Checkbox
                  checked={workout.status === 'completed'}
                  onCheckedChange={(checked) => 
                    handleWorkoutToggle(workout, checked as boolean)
                  }
                />
              </div>
              <Badge 
                variant="outline" 
                className={getWorkoutTypeColor(workout.workout_type)}
              >
                {workout.workout_type}
              </Badge>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">{workout.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {workout.description}
                  </p>
                </div>
                
                <div className="space-y-1 text-xs">
                  {workout.duration_minutes && (
                    <div className="flex items-center space-x-1">
                      <Timer className="h-3 w-3" />
                      <span>{workout.duration_minutes} min</span>
                    </div>
                  )}
                  
                  {workout.distance_meters && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>{(workout.distance_meters / 1000).toFixed(1)} km</span>
                    </div>
                  )}
                  
                  {workout.target_pace_min_km && (
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {Math.floor(workout.target_pace_min_km)}:{String(Math.round((workout.target_pace_min_km % 1) * 60)).padStart(2, '0')} min/km
                      </span>
                    </div>
                  )}
                  
                  {workout.target_hr_zone && (
                    <div className="flex items-center space-x-1">
                      <Heart className="h-3 w-3" />
                      <span>Zona {workout.target_hr_zone}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      {workouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Treinos</p>
                <p className="text-xl font-bold">{workouts.length}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Completos</p>
                <p className="text-xl font-bold text-green-600">
                  {workouts.filter(w => w.status === 'completed').length}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Distância Total</p>
                <p className="text-xl font-bold">
                  {workouts.reduce((sum, w) => sum + ((w.distance_meters || 0) / 1000), 0).toFixed(1)} km
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Tempo Total</p>
                <p className="text-xl font-bold">
                  {Math.round(workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) / 60)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}