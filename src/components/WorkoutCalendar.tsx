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
                        className={`w-full text-left px-1.5 py-1 rounded text-xs transition-all ${colorClass} text-white relative group`}
                        title={workout.title}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[10px] md:text-xs">
                            {WORKOUT_TYPE_LABELS[workout.workout_type] || workout.workout_type}
                          </span>
                          {isCompleted && (
                            <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                          )}
                        </div>
                        
                        {isLate && !isCompleted && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
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
      <div className="flex flex-wrap gap-2 pt-4 border-t">
        <div className="flex items-center gap-1 text-xs">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Completo</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <div className="w-3 h-3 rounded-full bg-red-500 relative">
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-600 rounded-full" />
          </div>
          <span className="text-muted-foreground">Atrasado</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <div className="w-3 h-3 rounded border-2 border-primary" />
          <span className="text-muted-foreground">Hoje</span>
        </div>
      </div>
    </div>
  );
}
