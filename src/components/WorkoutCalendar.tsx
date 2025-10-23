import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkoutCalendarProps {
  workouts: TrainingWorkout[];
  onWorkoutClick: (workout: TrainingWorkout) => void;
}

const WORKOUT_TYPE_COLORS: Record<string, string> = {
  'long_run': 'bg-blue-500 hover:bg-blue-600',
  'tempo': 'bg-orange-500 hover:bg-orange-600',
  'interval': 'bg-red-500 hover:bg-red-600',
  'easy': 'bg-green-500 hover:bg-green-600',
  'recovery': 'bg-emerald-400 hover:bg-emerald-500',
  'race_pace': 'bg-purple-500 hover:bg-purple-600',
  'fartlek': 'bg-yellow-500 hover:bg-yellow-600',
  'hill': 'bg-amber-600 hover:bg-amber-700',
  'cross_training': 'bg-cyan-500 hover:bg-cyan-600',
  'rest': 'bg-gray-400 hover:bg-gray-500'
};

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  'long_run': 'Corrida Longa',
  'tempo': 'Tempo',
  'interval': 'Intervalado',
  'easy': 'Leve',
  'recovery': 'Recuperação',
  'race_pace': 'Pace de Prova',
  'fartlek': 'Fartlek',
  'hill': 'Subida',
  'cross_training': 'Cross',
  'rest': 'Descanso'
};

export function WorkoutCalendar({ workouts, onWorkoutClick }: WorkoutCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get workouts by date
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, TrainingWorkout[]>();
    workouts.forEach(workout => {
      const dateKey = format(parseISO(workout.workout_date), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, workout]);
    });
    return map;
  }, [workouts]);

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const isOverdue = (workout: TrainingWorkout) => {
    return workout.status !== 'completed' && isBefore(parseISO(workout.workout_date), startOfDay(new Date()));
  };

  // Start calendar from Monday (day 1)
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Padding days */}
        {Array.from({ length: paddingDays }).map((_, index) => (
          <div key={`padding-${index}`} className="aspect-square" />
        ))}
        
        {/* Calendar days */}
        {daysInMonth.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayWorkouts = workoutsByDate.get(dateKey) || [];
          const isCurrentDay = isToday(day);

          return (
            <Card 
              key={dateKey} 
              className={`aspect-square relative ${isCurrentDay ? 'ring-2 ring-primary' : ''}`}
            >
              <CardContent className="p-1 h-full flex flex-col">
                <div className={`text-xs font-medium mb-1 ${isCurrentDay ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1">
                  {dayWorkouts.map((workout) => {
                    const isCompleted = workout.status === 'completed';
                    const isLate = isOverdue(workout);
                    const colorClass = WORKOUT_TYPE_COLORS[workout.workout_type] || 'bg-blue-500';
                    
                    return (
                      <button
                        key={workout.id}
                        onClick={() => onWorkoutClick(workout)}
                        className={`w-full h-6 rounded transition-all ${colorClass} relative group`}
                        title={`${WORKOUT_TYPE_LABELS[workout.workout_type] || workout.workout_type} - ${workout.title}`}
                      >
                        {isCompleted && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                        )}
                        
                        {isLate && !isCompleted && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full border border-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-3 pt-4 border-t">
        <div className="text-xs font-medium text-foreground">Legenda de Tipos de Treino</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-blue-500 flex-shrink-0" />
            <span className="text-muted-foreground">Corrida Longa</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-orange-500 flex-shrink-0" />
            <span className="text-muted-foreground">Tempo</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-red-500 flex-shrink-0" />
            <span className="text-muted-foreground">Intervalado</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-green-500 flex-shrink-0" />
            <span className="text-muted-foreground">Leve</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-emerald-400 flex-shrink-0" />
            <span className="text-muted-foreground">Recuperação</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-purple-500 flex-shrink-0" />
            <span className="text-muted-foreground">Pace de Prova</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-yellow-500 flex-shrink-0" />
            <span className="text-muted-foreground">Fartlek</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-amber-600 flex-shrink-0" />
            <span className="text-muted-foreground">Subida</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-cyan-500 flex-shrink-0" />
            <span className="text-muted-foreground">Cross Training</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-gray-400 flex-shrink-0" />
            <span className="text-muted-foreground">Descanso</span>
          </div>
        </div>
        
        <div className="text-xs font-medium text-foreground pt-2">Status</div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-muted flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-foreground" />
            </div>
            <span className="text-muted-foreground">Treino Completo</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-muted relative">
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full border border-white" />
            </div>
            <span className="text-muted-foreground">Atrasado</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded border-2 border-primary" />
            <span className="text-muted-foreground">Hoje</span>
          </div>
        </div>
      </div>
    </div>
  );
}
