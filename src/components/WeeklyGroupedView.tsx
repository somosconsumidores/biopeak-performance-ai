import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import { WorkoutDetailDialog } from './WorkoutDetailDialog';
import { Calendar, MapPin, Clock, Timer, Heart } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, differenceInWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyGroupedViewProps {
  workouts: TrainingWorkout[];
  sportType?: string;
}

interface GroupedWorkout extends TrainingWorkout {
  dayName: string;
  shortDate: string;
}

export function WeeklyGroupedView({ workouts, sportType = 'running' }: WeeklyGroupedViewProps) {
  const [selectedWorkout, setSelectedWorkout] = useState<TrainingWorkout | null>(null);

  const groupWorkoutsByWeek = () => {
    const groups: { [key: string]: GroupedWorkout[] } = {};
    
    const sortedWorkouts = workouts
      .map(workout => ({
        ...workout,
        parsedDate: parseISO(workout.workout_date),
        dayName: format(parseISO(workout.workout_date), 'EEEE', { locale: ptBR }),
        shortDate: format(parseISO(workout.workout_date), 'dd/MM', { locale: ptBR })
      }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    sortedWorkouts.forEach(workout => {
      const weekStart = startOfWeek(workout.parsedDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(workout.parsedDate, { weekStartsOn: 0 });
      const weekKey = `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`;
      
      if (!groups[weekKey]) {
        groups[weekKey] = [];
      }
      
      groups[weekKey].push({
        ...workout,
        dayName: workout.dayName,
        shortDate: workout.shortDate
      });
    });

    return groups;
  };

  const weekGroups = groupWorkoutsByWeek();
  const weekKeys = Object.keys(weekGroups).sort((a, b) => {
    const dateA = parseISO(weekGroups[a][0].workout_date);
    const dateB = parseISO(weekGroups[b][0].workout_date);
    return dateA.getTime() - dateB.getTime();
  });

  const getWorkoutTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'easy': 'bg-green-500',
      'long_run': 'bg-purple-500',
      'tempo': 'bg-orange-500',
      'interval': 'bg-red-500',
      'recovery': 'bg-gray-500',
      'rest': 'bg-gray-400',
    };
    return colors[type] || 'bg-blue-500';
  };

  const getWorkoutTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'easy': 'Easy Run',
      'long_run': 'Long Run',
      'tempo': 'Tempo',
      'interval': 'Intervals',
      'recovery': 'Recovery',
      'rest': 'Rest',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Próximos Treinos</h2>
        <p className="text-muted-foreground">
          {workouts.length} treinos programados
        </p>
      </div>

      {weekKeys.map((weekKey, weekIndex) => {
        const weekWorkouts = weekGroups[weekKey];
        const totalDistance = weekWorkouts.reduce((sum, w) => sum + ((w.distance_meters || 0) / 1000), 0);
        const completedCount = weekWorkouts.filter(w => w.status === 'completed').length;
        
        return (
          <Card key={weekKey} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {weekKey}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Semana {weekIndex + 1}
                  </p>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>Total Treinos: {weekWorkouts.length}</span>
                    <span>Distância: {totalDistance.toFixed(1)}km</span>
                  </div>
                  {completedCount > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      {completedCount} completos
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {weekWorkouts.map((workout) => (
                  <div 
                    key={workout.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                      workout.status === 'completed' ? 'ring-1 ring-green-500/20 bg-green-50/50' : ''
                    }`}
                    onClick={() => setSelectedWorkout(workout)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-8 rounded-full ${getWorkoutTypeColor(workout.workout_type)}`} />
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm capitalize">
                            {workout.dayName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getWorkoutTypeLabel(workout.workout_type)}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1">
                          {workout.title}
                        </p>
                        
                        <div className="flex items-center space-x-3 mt-1 text-xs text-muted-foreground">
                          {workout.distance_meters && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{(workout.distance_meters / 1000).toFixed(1)}km</span>
                            </div>
                          )}
                          
                          {workout.duration_minutes && (
                            <div className="flex items-center space-x-1">
                              <Timer className="h-3 w-3" />
                              <span>{workout.duration_minutes}min</span>
                            </div>
                          )}
                          
                          {workout.target_pace_min_km && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {Math.floor(workout.target_pace_min_km)}:{String(Math.round((workout.target_pace_min_km % 1) * 60)).padStart(2, '0')}/km
                              </span>
                            </div>
                          )}
                          
                          {workout.target_hr_zone && (
                            <div className="flex items-center space-x-1">
                              <Heart className="h-3 w-3" />
                              <span>Z{workout.target_hr_zone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium">{workout.shortDate}</p>
                      {workout.status === 'completed' && (
                        <Badge variant="default" className="text-xs mt-1">
                          Completo
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <WorkoutDetailDialog 
        workout={selectedWorkout}
        open={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        sportType={sportType}
      />
    </div>
  );
}