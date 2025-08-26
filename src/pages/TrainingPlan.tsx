import { useState } from 'react';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { useAuth } from '@/hooks/useAuth';
import { TrainingPlanWizard } from '@/components/TrainingPlanWizard';
import { WeeklyPlanView } from '@/components/WeeklyPlanView';
import { WeeklyGroupedView } from '@/components/WeeklyGroupedView';
import { PlanOverview } from '@/components/PlanOverview';
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, Target, TrendingUp, Trash2, Construction, Lock, Sparkles, ArrowLeft } from 'lucide-react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Link } from 'react-router-dom';

export default function TrainingPlan() {
  const { user } = useAuth();
  const { plan, workouts, loading, error, refreshPlan, deletePlan } = useActiveTrainingPlan();
  const [showWizard, setShowWizard] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user has access to training plans
  const hasTrainingPlanAccess = user?.email === 'admin@biopeak.com' || user?.email === 'garminteste07@teste.com';

  // Show access restriction for non-authorized users
  if (!hasTrainingPlanAccess) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        
        <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-4xl">
            <ScrollReveal>
              <div className="text-center max-w-2xl mx-auto">
                <div className="mb-8">
                  <Target className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <h1 className="text-3xl font-bold mb-4">Plano de Treino</h1>
                  <p className="text-muted-foreground mb-8">
                    Desenvolva um plano personalizado baseado no seu histórico, objetivos e disponibilidade.
                  </p>
                </div>

                <Card className="glass-card border-glass-border">
                  <CardContent className="py-12">
                    <div className="text-center space-y-6">
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="p-4 rounded-full bg-primary/10">
                          <Construction className="h-12 w-12 text-primary" />
                        </div>
                        <Lock className="h-8 w-8 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-3">
                        <h2 className="text-2xl font-bold">Feature em desenvolvimento</h2>
                        <p className="text-lg text-muted-foreground max-w-md mx-auto">
                          Aguarde novidades!
                        </p>
                      </div>
                      
                      <div className="pt-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm text-primary font-medium">
                            Funcionalidade exclusiva em breve
                          </span>
                        </div>
                      </div>

                      <div className="pt-6">
                        <Button variant="outline" asChild className="glass-card border-glass-border">
                          <Link to="/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar ao Dashboard
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-32 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Carregando plano de treino...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-32 px-4">
          <div className="container mx-auto max-w-4xl">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6">
                <p className="text-destructive text-center">{error}</p>
                <Button onClick={refreshPlan} className="w-full mt-4">
                  Tentar Novamente
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        
        <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-4xl">
            <ScrollReveal>
              <div className="text-center max-w-2xl mx-auto">
                <div className="mb-8">
                  <Target className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <h1 className="text-3xl font-bold mb-4">Crie Seu Plano de Treino</h1>
                  <p className="text-muted-foreground mb-8">
                    Desenvolva um plano personalizado baseado no seu histórico, objetivos e disponibilidade.
                    Nosso AI Coach irá criar workouts específicos com zonas de frequência cardíaca e paces ideais.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <Card>
                    <CardHeader className="text-center">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <CardTitle className="text-lg">Personalizado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Baseado no seu histórico e objetivos específicos
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="text-center">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <CardTitle className="text-lg">Progressivo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Evolução gradual com princípios de periodização
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="text-center">
                      <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <CardTitle className="text-lg">Focado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Direcionado para atingir seus objetivos específicos
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Button 
                  onClick={() => setShowWizard(true)} 
                  size="lg" 
                  className="text-lg px-8"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Criar Plano de Treino
                </Button>
              </div>
            </ScrollReveal>

            {showWizard && (
              <TrainingPlanWizard 
                open={showWizard}
                onClose={() => setShowWizard(false)}
                onComplete={() => {
                  setShowWizard(false);
                  refreshPlan();
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{plan.plan_name}</h1>
                  <p className="text-muted-foreground">
                    Plano ativo • {plan.weeks} semanas • Objetivo: {plan.goal_type}
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deletePlan();
                    } catch (error) {
                      console.error('Erro ao deletar plano:', error);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isDeleting ? 'Cancelando...' : 'Cancelar Plano'}
                </Button>
              </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="upcoming">Próximos Treinos</TabsTrigger>
                <TabsTrigger value="weekly">Plano Semanal</TabsTrigger>
                <TabsTrigger value="progress">Progresso</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <PlanOverview plan={plan} workouts={workouts} />
              </TabsContent>

              <TabsContent value="upcoming">
                <WeeklyGroupedView workouts={workouts} />
              </TabsContent>

              <TabsContent value="weekly">
                <WeeklyPlanView plan={plan} workouts={workouts} />
              </TabsContent>

              <TabsContent value="progress">
                <Card>
                  <CardHeader>
                    <CardTitle>Progresso do Plano</CardTitle>
                    <CardDescription>
                      Acompanhe sua evolução e estatísticas de treino
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                      Visualização de progresso em desenvolvimento...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}