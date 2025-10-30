import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { Calendar, ArrowRight, Dumbbell } from 'lucide-react';

export const TodayTrainingAlert = () => {
  const navigate = useNavigate();
  const { workouts, loading } = useActiveTrainingPlan();

  if (loading) return null;

  // Get today's workout
  const today = new Date().toISOString().split('T')[0];
  const todayWorkout = workouts.find(w => 
    w.workout_date === today && w.status === 'planned'
  );

  if (!todayWorkout) return null;

  return (
    <Card className="glass-card border-glass-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:shadow-2xl transition-all duration-300 overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
              <Dumbbell className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Treino de Hoje
                </h3>
                <div className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  Planejado
                </div>
              </div>
              <p className="text-sm sm:text-base text-foreground/90 font-medium mb-1 truncate">
                {todayWorkout.title}
              </p>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Você tem um treino agendado para hoje</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => navigate('/training')}
            className="shrink-0 gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            <span className="hidden sm:inline">Realizar Treino</span>
            <span className="sm:hidden">Iniciar</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
