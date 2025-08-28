
import React from 'react';
import { Calendar, Plus, Target, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RaceCalendar } from '@/components/RaceCalendar';
import { PlanOverview } from '@/components/PlanOverview';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { useAuth } from '@/hooks/useAuth';

const TrainingPlan = () => {
  const { loading } = useActiveTrainingPlan();
  const { user } = useAuth();

  // Lista de usuários autorizados para o calendário de provas
  const authorizedEmails = ['garminteste07@teste.com', 'admin@biopeak.com'];
  const isAuthorized = user?.email && authorizedEmails.includes(user.email);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
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
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum plano de treino ativo</h3>
                <p className="text-muted-foreground mb-6 text-sm md:text-base px-4">
                  Crie seu primeiro plano personalizado para começar a treinar com foco
                </p>
                <Button 
                  className="w-full max-w-xs bg-primary hover:bg-primary/90"
                  disabled
                >
                  Criar Plano
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Feature em desenvolvimento
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Race Calendar - Only for authorized users */}
        {isAuthorized ? (
          <RaceCalendar />
        ) : (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Calendar className="h-5 w-5" />
                Calendário de Provas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Feature em desenvolvimento</h3>
                <p className="text-muted-foreground mb-6 text-sm md:text-base px-4">
                  O calendário de provas estará disponível em breve para todos os usuários
                </p>
                <Button 
                  className="w-full max-w-xs"
                  disabled
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Prova
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TrainingPlan;
