import { useState } from "react";
import { Calendar, Plus, Clock, MapPin, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTargetRaces } from "@/hooks/useTargetRaces";
import { AddRaceDialog } from "./AddRaceDialog";
import { RaceCard } from "./RaceCard";

export function RaceCalendar() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { races, loading } = useTargetRaces();

  const upcomingRaces = races.filter(race => 
    race.status === 'planned' && new Date(race.race_date) >= new Date()
  );

  const completedRaces = races.filter(race => 
    race.status === 'completed'
  );

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(0)}K`;
    }
    return `${meters}m`;
  };

  const getDaysUntilRace = (raceDate: string) => {
    const today = new Date();
    const race = new Date(raceDate);
    const diffTime = race.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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
            <div className="animate-pulse">Carregando provas...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Provas
          </CardTitle>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Prova
          </Button>
        </CardHeader>
        <CardContent>
          {races.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma prova registrada</h3>
              <p className="text-muted-foreground mb-4">
                Adicione suas provas alvo para receber análises e recomendações personalizadas
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira prova
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming Races */}
              {upcomingRaces.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Próximas Provas ({upcomingRaces.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingRaces.map((race) => (
                      <RaceCard key={race.id} race={race} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Races */}
              {completedRaces.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Provas Realizadas ({completedRaces.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {completedRaces.map((race) => (
                      <RaceCard key={race.id} race={race} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddRaceDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
      />
    </div>
  );
}