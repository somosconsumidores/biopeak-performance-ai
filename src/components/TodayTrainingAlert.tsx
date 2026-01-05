import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useActiveTrainingPlans } from '@/hooks/useActiveTrainingPlans';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar, ArrowRight, Dumbbell } from 'lucide-react';

export const TodayTrainingAlert = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { workouts, loading } = useActiveTrainingPlans();

  if (loading) return null;

  // Get today's workout
  const today = new Date().toISOString().split('T')[0];
  const todayWorkout = workouts.find(w => 
    w.workout_date === today && w.status === 'planned'
  );

  if (!todayWorkout) return null;

  return (
    <Card className="glass-card border-glass-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:shadow-xl transition-all duration-300 overflow-hidden">
      <CardContent className="p-4">
        <div className={isMobile ? "flex flex-col gap-3" : "flex items-center justify-between gap-4"}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Dumbbell className="h-5 w-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-foreground">
                  Treino de Hoje
                </h3>
                <div className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  Planejado
                </div>
              </div>
              <p className="text-base text-foreground font-semibold mb-1.5 truncate">
                {todayWorkout.title}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Agendado para hoje</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => navigate('/training')}
            className={`gap-2 shadow-lg hover:shadow-xl transition-all ${isMobile ? 'w-full' : 'shrink-0'}`}
          >
            {isMobile ? 'Iniciar Treino' : 'Realizar Treino'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
