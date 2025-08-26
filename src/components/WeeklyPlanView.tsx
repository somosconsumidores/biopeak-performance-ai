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
  const { completeWorkout, uncompleteWorkout } = useActiveTrainingPlan();
  const [currentWeek, setCurrentWeek] = useState(1);
  
  const totalWeeks = plan.weeks;
  const weekWorkouts = workouts.filter(w => w.week_number === currentWeek);
  
  const handleWorkoutToggle = async (workout: TrainingWorkout, completed: boolean) => {
    try {
      if (completed) {
        await completeWorkout(workout.id);
      } else {
        await uncompleteWorkout(workout.id);
      }
    } catch (error) {
      console.error('Error toggling workout:', error);
    }
  };

  const getWorkoutForDay = (dayOfWeek: number) => {
    return weekWorkouts.find(w => w.day_of_week === dayOfWeek);
  };

  const getWorkoutTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Easy Run': 'bg-green-100 text-green-800 border-green-200',
      'Long Run': 'bg-blue-100 text-blue-800 border-blue-200',
      'Tempo Run': 'bg-orange-100 text-orange-800 border-orange-200',
      'Interval': 'bg-red-100 text-red-800 border-red-200',
      'Recovery': 'bg-gray-100 text-gray-800 border-gray-200',
      'Rest': 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Semana {currentWeek}</h2>
          <p className="text-muted-foreground">
            {weekWorkouts.length} treinos programados
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium px-3">
            {currentWeek} / {totalWeeks}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(Math.min(totalWeeks, currentWeek + 1))}
            disabled={currentWeek >= totalWeeks}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {DAYS_OF_WEEK.map((day, index) => {
          const workout = getWorkoutForDay(index);
          
          return (
            <Card key={index} className={`min-h-[200px] ${workout ? 'ring-1 ring-primary/20' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{day}</CardTitle>
                {workout && (
                  <CardDescription className="text-xs">
                    {format(parseISO(workout.scheduled_date), 'dd/MM')}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="pt-0">
                {workout ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant="outline" 
                        className={getWorkoutTypeColor(workout.workout_type)}
                      >
                        {workout.workout_type}
                      </Badge>
                      <Checkbox
                        checked={workout.is_completed}
                        onCheckedChange={(checked) => 
                          handleWorkoutToggle(workout, checked as boolean)
                        }
                      />
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-1">{workout.workout_name}</h4>
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
                      
                      {workout.distance_km && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{workout.distance_km} km</span>
                        </div>
                      )}
                      
                      {workout.target_pace_min_km && (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{workout.target_pace_min_km.toFixed(2)} min/km</span>
                        </div>
                      )}
                      
                      {workout.target_heart_rate_zone && (
                        <div className="flex items-center space-x-1">
                          <Heart className="h-3 w-3" />
                          <span>Zona {workout.target_heart_rate_zone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">Descanso</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Week Summary */}
      {weekWorkouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Treinos</p>
                <p className="text-xl font-bold">{weekWorkouts.length}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Completos</p>
                <p className="text-xl font-bold text-green-600">
                  {weekWorkouts.filter(w => w.is_completed).length}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Distância Total</p>
                <p className="text-xl font-bold">
                  {weekWorkouts.reduce((sum, w) => sum + (w.distance_km || 0), 0).toFixed(1)} km
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Tempo Total</p>
                <p className="text-xl font-bold">
                  {Math.round(weekWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) / 60)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}