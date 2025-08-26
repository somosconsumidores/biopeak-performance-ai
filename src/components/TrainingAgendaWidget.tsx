import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { WorkoutDetailDialog } from './WorkoutDetailDialog';
import { Calendar, MapPin, Clock, ChevronRight, PlayCircle } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export function TrainingAgendaWidget() {
  const { plan, workouts, loading } = useActiveTrainingPlan();
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>Agenda de Treinos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Carregando agenda...</p>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>Agenda de Treinos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Nenhum plano de treino ativo</p>
            <Button asChild size="sm">
              <Link to="/training-plan">Criar Plano</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  
  const upcomingWorkouts = next7Days
    .map(date => {
      const workout = workouts.find(w => 
        isSameDay(parseISO(w.workout_date), date) && 
        w.status !== 'completed'
      );
      return workout ? { ...workout, date } : null;
    })
    .filter(Boolean)
    .slice(0, 3);

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

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, 'EEEE', { locale: ptBR });
  };

  return (
    <>
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Agenda de Treinos</span>
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/training-plan">
                Ver Todos
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingWorkouts.length === 0 ? (
            <div className="text-center py-4">
              <PlayCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum treino nos próximos dias
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingWorkouts.map((workout) => (
                <div 
                  key={workout.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedWorkout(workout)}
                >
                  <div className={`w-1 h-12 rounded-full ${getWorkoutTypeColor(workout.workout_type)}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">
                        {getDateLabel(workout.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(workout.date, 'dd/MM')}
                      </p>
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate mb-1">
                      {workout.title}
                    </p>
                    
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      {workout.distance_meters && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{(workout.distance_meters / 1000).toFixed(1)}km</span>
                        </div>
                      )}
                      
                      {workout.duration_minutes && (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{workout.duration_minutes}min</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Badge variant="outline" className="text-xs">
                    {workout.workout_type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WorkoutDetailDialog 
        workout={selectedWorkout}
        open={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
      />
    </>
  );
}