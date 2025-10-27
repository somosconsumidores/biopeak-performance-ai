
import React, { useState } from 'react';
import { Calendar, Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { RaceCalendar } from '@/components/RaceCalendar';
import { PlanOverview } from '@/components/PlanOverview';
import { PremiumButton } from '@/components/PremiumButton';
import { TrainingPlanWizard } from '@/components/TrainingPlanWizard';
import { WorkoutCalendar } from '@/components/WorkoutCalendar';
import { WorkoutDetailDialog } from '@/components/WorkoutDetailDialog';
import { TrainingPlanRestricted } from '@/components/TrainingPlanRestricted';
import { useActiveTrainingPlan, TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import { useSubscription } from '@/hooks/useSubscription';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';

const TrainingPlan = () => {
  const { plan, workouts, loading, refreshPlan, deletePlan } = useActiveTrainingPlan();
  const { isSubscribed } = useSubscription();
  const { profile, flagTrainingPlanInterest } = useProfile();
  const { toast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<TrainingWorkout | null>(null);

  // Allowed emails for training plan feature
  const ALLOWED_EMAILS = [
    'augustoccguga_@hotmail.com',
    'sandro.leao@biopeak-ai.com',
    'sandro.biopeak@biopeak.com',
    'joana.vmello@gmail.com',
    'mreisl2012@gmail.com'
  ];

  const isAllowedUser = profile?.email && ALLOWED_EMAILS.includes(profile.email.toLowerCase());

  const handleWizardComplete = () => {
    setWizardOpen(false);
    refreshPlan();
    toast({
      title: "Plano criado com sucesso!",
      description: "Seu plano de treino personalizado foi gerado.",
    });
  };

  const handleNotifyClick = () => {
    flagTrainingPlanInterest();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="safe-pt-16 pb-20 md:pb-4">
        <div className="container mx-auto px-4 py-4 md:py-6 space-y-6">
          {/* Header */}
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Plano de Treino</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Gerencie seus treinos e objetivos de corrida
            </p>
          </div>

          {/* Training Plan Section */}
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Calendar className="h-5 w-5" />
                Plano de Treino Ativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Carregando plano...</p>
                  </div>
                </div>
              ) : plan ? (
                <PlanOverview 
                  plan={plan} 
                  workouts={workouts}
                  onDeletePlan={deletePlan}
                  onRefreshPlan={refreshPlan}
                />
              ) : isAllowedUser ? (
                <div className="text-center py-8">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum plano de treino ativo</h3>
                  <p className="text-muted-foreground mb-6 text-sm md:text-base px-4">
                    Crie seu primeiro plano personalizado para começar a treinar com foco
                  </p>
                  <Button 
                    className="w-full max-w-xs bg-primary hover:bg-primary/90"
                    onClick={() => setWizardOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Plano
                  </Button>
                </div>
              ) : (
                <TrainingPlanRestricted 
                  onNotifyClick={handleNotifyClick}
                  alreadyFlagged={profile?.flag_training_plan || false}
                />
              )}
            </CardContent>
          </Card>

          {/* Workout Calendar - Show when there's an active plan */}
          {plan && workouts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Calendar className="h-5 w-5" />
                  Calendário de Treinos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorkoutCalendar
                  workouts={workouts}
                  onWorkoutClick={setSelectedWorkout}
                />
              </CardContent>
            </Card>
          )}

          {/* Race Calendar - Available to all users */}
          <RaceCalendar />
          
          {/* Análise - Premium Only */}
          <div className="mt-4">
            {plan && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Target className="h-5 w-5" />
                    Análise de Progresso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    {isSubscribed ? (
                      <Button className="w-full max-w-xs">
                        <Target className="h-4 w-4 mr-2" />
                        Análise
                      </Button>
                    ) : (
                      <PremiumButton>
                        Análise
                      </PremiumButton>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Análise detalhada do seu progresso nos objetivos
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <TrainingPlanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      <WorkoutDetailDialog
        workout={selectedWorkout}
        open={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
      />
    </div>
  );
};

export default TrainingPlan;
