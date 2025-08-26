import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrainingPlan, TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import { Calendar, Target, Clock, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PlanOverviewProps {
  plan: TrainingPlan;
  workouts: TrainingWorkout[];
}

export function PlanOverview({ plan, workouts }: PlanOverviewProps) {
  const completedWorkouts = workouts.filter(w => w.status === 'completed').length;
  const totalWorkouts = workouts.length;
  const completionPercentage = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

  const startDate = parseISO(plan.start_date);
  const endDate = parseISO(plan.end_date);
  const today = new Date();
  const daysElapsed = differenceInDays(today, startDate);
  const totalDays = differenceInDays(endDate, startDate);
  const timeProgress = Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100));

  const upcomingWorkouts = workouts
    .filter(w => w.status !== 'completed' && parseISO(w.workout_date) >= today)
    .sort((a, b) => parseISO(a.workout_date).getTime() - parseISO(b.workout_date).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedWorkouts}</p>
                <p className="text-sm text-muted-foreground">Treinos Completos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalWorkouts}</p>
                <p className="text-sm text-muted-foreground">Total de Treinos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{plan.weeks}</p>
                <p className="text-sm text-muted-foreground">Semanas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{Math.round(completionPercentage)}%</p>
                <p className="text-sm text-muted-foreground">Completo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Progresso de Treinos</CardTitle>
            <CardDescription>
              {completedWorkouts} de {totalWorkouts} treinos completos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              {Math.round(completionPercentage)}% do plano concluído
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progresso Temporal</CardTitle>
            <CardDescription>
              Tempo decorrido do plano
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={timeProgress} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              {Math.round(timeProgress)}% do tempo decorrido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Plano</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Objetivo</h4>
              <Badge variant="outline">{plan.goal_type}</Badge>
            </div>
            <div>
              <h4 className="font-medium mb-2">Status</h4>
              <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                {plan.status === 'active' ? 'Ativo' : plan.status}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Data de Início</h4>
              <p className="text-muted-foreground">
                {format(startDate, 'dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Data de Término</h4>
              <p className="text-muted-foreground">
                {format(endDate, 'dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })}
              </p>
            </div>
          </div>

          {plan.target_event_date && (
            <div>
              <h4 className="font-medium mb-2">Data da Prova</h4>
              <p className="text-muted-foreground">
                {format(parseISO(plan.target_event_date), 'dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })}
              </p>
            </div>
          )}

          {(plan.target_time_minutes_min || plan.target_time_minutes_max) && (
            <div className="md:col-span-2">
              <h4 className="font-medium mb-2">Tempo Alvo Esperado</h4>
              <div className="flex items-center space-x-2">
                {plan.target_time_minutes_min && plan.target_time_minutes_max ? (
                  <Badge variant="outline" className="text-sm">
                    {Math.floor(plan.target_time_minutes_min / 60)}h{String(plan.target_time_minutes_min % 60).padStart(2, '0')}min - {Math.floor(plan.target_time_minutes_max / 60)}h{String(plan.target_time_minutes_max % 60).padStart(2, '0')}min
                  </Badge>
                ) : plan.target_time_minutes_min ? (
                  <Badge variant="outline" className="text-sm">
                    Melhor que {Math.floor(plan.target_time_minutes_min / 60)}h{String(plan.target_time_minutes_min % 60).padStart(2, '0')}min
                  </Badge>
                ) : plan.target_time_minutes_max ? (
                  <Badge variant="outline" className="text-sm">
                    Até {Math.floor(plan.target_time_minutes_max / 60)}h{String(plan.target_time_minutes_max % 60).padStart(2, '0')}min
                  </Badge>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Workouts */}
      {upcomingWorkouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos Treinos</CardTitle>
            <CardDescription>
              Seus treinos programados para os próximos dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingWorkouts.map((workout) => (
                <div key={workout.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{workout.title}</h4>
                    <p className="text-sm text-muted-foreground">{workout.workout_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {format(parseISO(workout.workout_date), 'dd/MM', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}