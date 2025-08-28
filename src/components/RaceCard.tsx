
import { useState } from "react";
import { Calendar, Clock, MapPin, Target, BarChart3, MoreHorizontal, Edit, Trash } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TargetRace, useTargetRaces } from "@/hooks/useTargetRaces";
import { RaceAnalysisDialog } from "./RaceAnalysisDialog";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RaceCardProps {
  race: TargetRace;
  onUpdate: () => void;
}

export function RaceCard({ race, onUpdate }: RaceCardProps) {
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const { deleteRace, updateRace } = useTargetRaces();

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(0)}K`;
    }
    return `${meters}m`;
  };

  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.floor((totalMinutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getDaysUntilRace = (raceDate: string) => {
    const today = new Date();
    const race = new Date(raceDate);
    const diffTime = race.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja remover esta prova?')) {
      await deleteRace(race.id);
      onUpdate();
    }
  };

  const handleStatusChange = async () => {
    const newStatus = race.status === 'planned' ? 'completed' : 'planned';
    await updateRace(race.id, { status: newStatus });
    onUpdate();
  };

  const daysUntil = getDaysUntilRace(race.race_date);
  const isExpired = isPast(parseISO(race.race_date)) && race.status === 'planned';

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base md:text-lg truncate mb-1">
                {race.race_name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{format(parseISO(race.race_date), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-md">
                <DropdownMenuItem onClick={handleStatusChange}>
                  <Edit className="h-4 w-4 mr-2" />
                  {race.status === 'planned' ? 'Marcar como realizada' : 'Marcar como planejada'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash className="h-4 w-4 mr-2" />
                  Remover prova
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">{formatDistance(race.distance_meters)}</span>
            </div>
            {race.target_time_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">{formatTime(race.target_time_minutes)}</span>
              </div>
            )}
            {race.race_location && (
              <div className="flex items-center gap-2 col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground truncate">{race.race_location}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <Badge 
                variant={race.status === 'completed' ? 'default' : isExpired ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {race.status === 'completed' ? 'Realizada' : 
                 isExpired ? 'Expirada' : 
                 `${daysUntil} dias`}
              </Badge>
            </div>
            {race.status === 'planned' && !isExpired && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAnalysisDialog(true)}
                className="text-xs px-2 py-1 h-auto"
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Análise
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <RaceAnalysisDialog
        open={showAnalysisDialog}
        onOpenChange={setShowAnalysisDialog}
        race={race}
      />
    </>
  );
}
