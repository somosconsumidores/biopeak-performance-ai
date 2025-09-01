
import { useState } from "react";
import { Calendar, Plus, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTargetRaces } from "@/hooks/useTargetRaces";
import { useAuth } from "@/hooks/useAuth";
import { AddRaceDialog } from "./AddRaceDialog";
import { RaceCard } from "./RaceCard";

export function RaceCalendar() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { races, loading, refetch } = useTargetRaces();
  const { user } = useAuth();

  // Lista de usuários autorizados para o calendário de provas
  const authorizedEmails = ['garminteste07@teste.com', 'admin@biopeak.com', 'sandro.leao@biopeak-ai.com'];
  const isAuthorized = user?.email && authorizedEmails.includes(user.email);

  const upcomingRaces = races.filter(race => 
    race.status === 'planned' && new Date(race.race_date) >= new Date()
  );

  const completedRaces = races.filter(race => 
    race.status === 'completed'
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Provas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Carregando provas...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se o usuário não está autorizado, mostra tela de bloqueio
  if (!isAuthorized) {
    return (
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
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Calendar className="h-5 w-5" />
            Calendário de Provas
          </CardTitle>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Prova
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {races.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma prova registrada</h3>
              <p className="text-muted-foreground mb-6 text-sm md:text-base px-4">
                Adicione suas provas alvo para receber análises e recomendações personalizadas
              </p>
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="w-full max-w-xs"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira prova
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming Races */}
              {upcomingRaces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="text-base md:text-lg font-semibold">
                      Próximas Provas ({upcomingRaces.length})
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {upcomingRaces.map((race) => (
                      <RaceCard key={race.id} race={race} onUpdate={refetch} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Races */}
              {completedRaces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-base md:text-lg font-semibold">
                      Provas Realizadas ({completedRaces.length})
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {completedRaces.map((race) => (
                      <RaceCard key={race.id} race={race} onUpdate={refetch} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog só aparece se o usuário está autorizado */}
      {isAuthorized && (
        <AddRaceDialog 
          open={showAddDialog} 
          onOpenChange={setShowAddDialog}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
